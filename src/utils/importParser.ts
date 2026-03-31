import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

import { safeFileName } from "./fileNames";
import type { ImportedCatalogue, ImportedItem } from "../types";

const BASE_PRODUCT_LENGTH = 18;

const SCIENTIFIC_NOTATION_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)[eE][+-]?\d+$/;

function stripFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) {
    return filename;
  }
  return filename.slice(0, lastDot);
}

export function normalizeDigitsCell(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  if (SCIENTIFIC_NOTATION_PATTERN.test(text)) {
    throw new Error(
      "Import contains values in scientific notation (Excel numeric format). " +
        "Format the Base Product/Barcode columns as text and re-export the file.",
    );
  }

  const cleaned = text.replace(/\.0$/, "");
  return cleaned.replace(/\D+/g, "");
}

function normalizeBaseProduct(value: unknown): string {
  const digits = normalizeDigitsCell(value);
  if (!digits) {
    return "";
  }

  if (digits.length > 0 && digits.length < BASE_PRODUCT_LENGTH) {
    return digits.padStart(BASE_PRODUCT_LENGTH, "0");
  }

  return digits;
}

function headerLooksLikeData(headerRow: unknown[]): boolean {
  const first = normalizeDigitsCell(headerRow[0]);
  return Boolean(first);
}

function inferColumnIndexesFromHeaderRow(headerRow: unknown[]): {
  baseProductIndex: number;
  barcodeIndex: number;
} {
  const normalized = headerRow.map((value) => String(value ?? "").trim().toLowerCase());
  const baseProductIndex = normalized.findIndex((value) => {
    return value.includes("base") || value.includes("product");
  });
  const barcodeIndex = normalized.findIndex((value) => {
    return (
      value.includes("barcode") ||
      value.includes("ean") ||
      value.includes("gtin") ||
      value.includes("upc")
    );
  });

  const resolvedBaseProductIndex = baseProductIndex >= 0 ? baseProductIndex : 0;
  let resolvedBarcodeIndex = barcodeIndex >= 0 ? barcodeIndex : 1;
  if (resolvedBarcodeIndex === resolvedBaseProductIndex) {
    resolvedBarcodeIndex = resolvedBaseProductIndex === 0 ? 1 : 0;
  }

  return {
    baseProductIndex: resolvedBaseProductIndex,
    barcodeIndex: resolvedBarcodeIndex,
  };
}

function looksLikeBarcodeCell(value: unknown): boolean {
  const digits = normalizeDigitsCell(value);
  return digits.length >= 12 && digits.length <= 14;
}

function inferColumnIndexesFromDataRows(dataRows: unknown[][]): {
  baseProductIndex: number;
  barcodeIndex: number;
} {
  const sampleRows = dataRows.slice(0, 25);
  let leftBarcodeScore = 0;
  let rightBarcodeScore = 0;
  let hasSecondColumn = false;

  for (const row of sampleRows) {
    if (looksLikeBarcodeCell(row[0])) {
      leftBarcodeScore += 1;
    }
    if (String(row[1] ?? "").trim()) {
      hasSecondColumn = true;
    }
    if (looksLikeBarcodeCell(row[1])) {
      rightBarcodeScore += 1;
    }
  }

  if (!hasSecondColumn) {
    return { baseProductIndex: 0, barcodeIndex: 1 };
  }

  if (leftBarcodeScore > rightBarcodeScore) {
    return { baseProductIndex: 1, barcodeIndex: 0 };
  }

  if (rightBarcodeScore > leftBarcodeScore) {
    return { baseProductIndex: 0, barcodeIndex: 1 };
  }

  const firstDataRow = sampleRows.find((row) => {
    return String(row[0] ?? "").trim() || String(row[1] ?? "").trim();
  });
  if (!firstDataRow) {
    return { baseProductIndex: 0, barcodeIndex: 1 };
  }

  const leftDigits = normalizeDigitsCell(firstDataRow[0]);
  const rightDigits = normalizeDigitsCell(firstDataRow[1]);

  const leftLooksLikeBarcode = looksLikeBarcodeCell(firstDataRow[0]);
  const rightLooksLikeBarcode = looksLikeBarcodeCell(firstDataRow[1]);

  if (leftLooksLikeBarcode && rightDigits.length > 0 && rightDigits.length < BASE_PRODUCT_LENGTH) {
    return { baseProductIndex: 1, barcodeIndex: 0 };
  }

  if (rightLooksLikeBarcode && leftDigits.length > 0 && leftDigits.length < BASE_PRODUCT_LENGTH) {
    return { baseProductIndex: 0, barcodeIndex: 1 };
  }

  return { baseProductIndex: 0, barcodeIndex: 1 };
}

function parseWorksheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];

  return rows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim()));
}

export async function parseImportFile(
  uri: string,
  filename: string,
  mimeType?: string,
): Promise<ImportedCatalogue> {
  const lowered = filename.toLowerCase();
  const extensionIndex = lowered.lastIndexOf(".");
  const extension = extensionIndex >= 0 ? lowered.slice(extensionIndex + 1) : "";
  const isCsv =
    mimeType?.toLowerCase().includes("csv") || extension === "csv" || extension === "txt";
  const importedAt = Date.now();
  const name = stripFileExtension(filename).trim() || "Imported catalogue";
  const id = `${safeFileName(name)}-${importedAt}`;

  let workbook: XLSX.WorkBook;

  if (isCsv) {
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    workbook = XLSX.read(raw, { type: "string" });
  } else {
    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    workbook = XLSX.read(raw, { type: "base64" });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Import file contained no worksheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Import file contained no readable worksheet data.");
  }

  const rows = parseWorksheetRows(sheet);
  if (rows.length === 0) {
    throw new Error("Import file contained no rows.");
  }

  const hasHeaderRow = !headerLooksLikeData(rows[0]);
  const dataRows = hasHeaderRow ? rows.slice(1) : rows;
  const { baseProductIndex, barcodeIndex } = hasHeaderRow
    ? inferColumnIndexesFromHeaderRow(rows[0])
    : inferColumnIndexesFromDataRows(dataRows);

  const items: ImportedItem[] = [];
  for (const row of dataRows) {
    const baseProduct = normalizeBaseProduct(row[baseProductIndex]);
    if (!baseProduct) {
      continue;
    }

    const barcode = normalizeDigitsCell(row[barcodeIndex]);
    items.push({
      position: items.length + 1,
      baseProduct,
      barcode,
      barcodeFound: /\d/.test(barcode),
    });
  }

  const barcodeCount = items.filter((item) => item.barcodeFound).length;

  return {
    id,
    name,
    importedAt,
    itemCount: items.length,
    barcodeCount,
    items,
  };
}
