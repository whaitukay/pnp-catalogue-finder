import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportedCatalogue } from "../types";

type FsInfo = { exists: boolean };

const fsMock = vi.hoisted(() => {
  const files = new Map<string, string>();

  return {
    __files: files,
    documentDirectory: "file:///mock-docs/",
    cacheDirectory: "file:///mock-cache/",
    EncodingType: { UTF8: "utf8", Base64: "base64" },
    makeDirectoryAsync: vi.fn(async () => undefined),
    getInfoAsync: vi.fn(async (uri: string): Promise<FsInfo> => {
      return { exists: files.has(uri) };
    }),
    readAsStringAsync: vi.fn(async (uri: string) => files.get(uri) ?? ""),
    writeAsStringAsync: vi.fn(async (uri: string, content: string) => {
      files.set(uri, content);
    }),
    deleteAsync: vi.fn(async (uri: string, options?: { idempotent?: boolean }) => {
      if (!files.has(uri)) {
        if (options?.idempotent) {
          return;
        }
        throw new Error("File does not exist");
      }
      files.delete(uri);
    }),
  };
});

vi.mock("expo-file-system/legacy", () => ({
  ...fsMock,
}));

import { deleteImport, listImports, loadImport, saveImport } from "./catalogueStore";

describe("catalogueStore imports", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("persists imported catalogues and lists them newest-first", async () => {
    const first: ImportedCatalogue = {
      id: "import-a",
      name: "Import A",
      importedAt: 1000,
      itemCount: 2,
      barcodeCount: 1,
      items: [
        {
          position: 1,
          baseProduct: "000000000001",
          barcode: "6001000000001",
          barcodeFound: true,
        },
        {
          position: 2,
          baseProduct: "000000000002",
          barcode: "",
          barcodeFound: false,
        },
      ],
    };

    const second: ImportedCatalogue = {
      id: "import-b",
      name: "Import B",
      importedAt: 2000,
      itemCount: 1,
      barcodeCount: 1,
      items: [
        {
          position: 1,
          baseProduct: "000000000003",
          barcode: "73513537",
          barcodeFound: true,
        },
      ],
    };

    await saveImport(first);
    await saveImport(second);

    const listing = await listImports();
    expect(listing.map((item) => item.id)).toEqual(["import-b", "import-a"]);
    expect(listing[0]).toMatchObject({
      name: "Import B",
      itemCount: 1,
      barcodeCount: 1,
    });
  });

  it("loads and deletes imports by id", async () => {
    const imported: ImportedCatalogue = {
      id: "import-a",
      name: "Import A",
      importedAt: 1000,
      itemCount: 1,
      barcodeCount: 1,
      items: [
        {
          position: 1,
          baseProduct: "000000000001",
          barcode: "6001000000001",
          barcodeFound: true,
        },
      ],
    };

    await saveImport(imported);

    const loaded = await loadImport("import-a");
    expect(loaded).not.toBeNull();
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0]).toMatchObject({ baseProduct: "000000000001" });

    await deleteImport("import-a");
    expect(await loadImport("import-a")).toBeNull();
    expect(await listImports()).toEqual([]);
  });
});
