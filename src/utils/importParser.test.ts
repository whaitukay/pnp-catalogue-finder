import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const fsMock = vi.hoisted(() => ({
  documentDirectory: "file:///mock-docs/",
  cacheDirectory: "file:///mock-cache/",
  EncodingType: { UTF8: "utf8", Base64: "base64" },
  readAsStringAsync: vi.fn(async () => ""),
  makeDirectoryAsync: vi.fn(async () => undefined),
  getInfoAsync: vi.fn(async () => ({ exists: true })),
  writeAsStringAsync: vi.fn(async () => undefined),
  deleteAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-file-system/legacy", () => ({
  ...fsMock,
}));

import { parseImportFile } from "./importParser";

describe("importParser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("parses CSV imports with a header row", async () => {
    fsMock.readAsStringAsync.mockResolvedValueOnce(
      [
        "baseProduct,barcode",
        "000000000000886223,6001000000001",
        "123,",
      ].join("\n"),
    );

    const imported = await parseImportFile("file:///mock.csv", "Book1.csv");

    expect(imported.id).toBe("book1-1774838400000");
    expect(imported.itemCount).toBe(2);
    expect(imported.barcodeCount).toBe(1);
    expect(imported.items).toEqual([
      {
        position: 1,
        baseProduct: "000000000000886223",
        barcode: "6001000000001",
        barcodeFound: true,
      },
      {
        position: 2,
        baseProduct: "000000000123",
        barcode: "",
        barcodeFound: false,
      },
    ]);
  });

  it("parses CSV imports without a header row", async () => {
    fsMock.readAsStringAsync.mockResolvedValueOnce(
      [
        "000000000000886223,6001000000001",
        "000000000000123456,",
      ].join("\n"),
    );

    const imported = await parseImportFile("file:///mock.csv", "Products.csv");
    expect(imported.itemCount).toBe(2);
    expect(imported.items[0]).toMatchObject({
      baseProduct: "000000000000886223",
      barcode: "6001000000001",
      barcodeFound: true,
    });
  });

  it("parses XLSX imports", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Base Product", "Barcode"],
      ["000000000000886223", "6001000000001"],
      ["000000000000123456", ""],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    const encoded = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });

    fsMock.readAsStringAsync.mockResolvedValueOnce(encoded);

    const imported = await parseImportFile("file:///mock.xlsx", "Book1.xlsx");
    expect(imported.itemCount).toBe(2);
    expect(imported.barcodeCount).toBe(1);
    expect(imported.items[0]).toMatchObject({
      baseProduct: "000000000000886223",
      barcode: "6001000000001",
      barcodeFound: true,
    });
  });
});
