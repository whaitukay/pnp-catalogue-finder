import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";

import { safeFileName } from "../services/catalogueStore";
import type { ImportedCatalogue, ImportedItem } from "../types";

const BASE_PRODUCT_LENGTH = 18;

function stripFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0) {
    return filename;
  }
  return filename.slice(0, lastDot);
}

function normalizeDigitsCell(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
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

function inferColumnIndexes(headerRow: unknown[]): {
  baseProductIndex: number;
  barcodeIndex: number;
} {
  const normalized = headerRow.map((value) => String(value ?? "").trim().toLowerCase());
  const baseProductIndex = normalized.findIndex((value) => {
    return value.includes("base") || value.includes("product");
  });
  const barcodeIndex = normalized.findIndex((value) => value.includes("barcode"));

  return {
    baseProductIndex: baseProductIndex >= 0 ? baseProductIndex : 0,
    barcodeIndex: barcodeIndex >= 0 ? barcodeIndex : 1,
  };
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
  const { baseProductIndex, barcodeIndex } = hasHeaderRow
    ? inferColumnIndexes(rows[0])
    : { baseProductIndex: 0, barcodeIndex: 1 };
  const dataRows = hasHeaderRow ? rows.slice(1) : rows;

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
