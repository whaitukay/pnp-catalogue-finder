import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueDump } from "../types";

const fsMock = vi.hoisted(() => {
  const files = new Map<string, string>();

  return {
    files,
    documentDirectory: "file:///mock-docs/",
    cacheDirectory: "file:///mock-cache/",
    EncodingType: { UTF8: "utf8" },
    makeDirectoryAsync: vi.fn(async () => undefined),
    getInfoAsync: vi.fn(async (uri: string) => ({ exists: files.has(uri) })),
    readAsStringAsync: vi.fn(async (uri: string) => files.get(uri) ?? ""),
    writeAsStringAsync: vi.fn(async (uri: string, content: string) => {
      files.set(uri, content);
    }),
  };
});

vi.mock("expo-file-system/legacy", () => ({
  ...fsMock,
}));

import { ensureCsvForDump, saveDump } from "./catalogueStore";

const EXPORTS_DIR = "file:///mock-docs/catalogue-helper/exports/";
const MANIFEST_URI = "file:///mock-docs/catalogue-helper/cache/catalogue-manifests.json";

describe("catalogueStore CSV dump", () => {
  beforeEach(() => {
    fsMock.files.clear();
  });

  it("defers csv writing until ensureCsvForDump is called", async () => {
    const dump: CatalogueDump = {
      catalogueId: "WC21:burger-fridays",
      storeCode: "WC21",
      label: "burger-fridays",
      slug: "burger-fridays",
      query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
      sourceUrl:
        "https://www.pnp.co.za/Burger-Fridays/c/burger-fridays?q=%3Arelevance%3AallCategories%3Aburger-fridays%3AisOnPromotion%3AOn%2BPromotion",
      discoveredFrom: "sample",
      exportedAt: 1_774_608_000_000,
      itemCount: 1,
      barcodeCount: 1,
      catalogueStartDate: Date.parse("2026-03-26T22:00:00.000Z"),
      catalogueEndDate: Date.parse("2026-03-27T21:59:59.000Z"),
      expired: false,
      rows: [
        {
          position: 1,
          catalogueSlug: "burger-fridays",
          name: "PnP Beef Burger 400g",
          productCode: "000000000000886223_EA",
          baseProduct: "000000000000886223",
          barcode: "6001000000001",
          price: "R55.99",
          promotion: "Combo For R100.00",
          promotionRanges:
            "2026-03-26T22:00:00+0000 -> 2026-03-27T21:59:59+0000 [Combo For R100.00]",
          productUrl: "https://www.pnp.co.za/pnp-beef-burger-400g/p/000000000000886223_EA",
          barcodeFound: true,
          error: "",
        },
      ],
    };

    const persisted = await saveDump(dump);

    expect(persisted.csvUri).toBe(
      "file:///mock-docs/catalogue-helper/exports/wc21-wc21-burger-fridays-barcodes.csv",
    );

    const csvUri = persisted.csvUri;
    if (!csvUri) {
      throw new Error("Expected saveDump to return a csvUri path.");
    }

    expect(fsMock.files.has(csvUri)).toBe(false);
    expect(fsMock.files.has(persisted.dumpUri)).toBe(true);
    expect(persisted.dump.csvUri).toBeUndefined();

    const ensuredCsvUri = await ensureCsvForDump(persisted.dumpUri, csvUri);
    expect(ensuredCsvUri).toBe(csvUri);
    expect(fsMock.files.has(ensuredCsvUri)).toBe(true);

    const csvContent = fsMock.files.get(ensuredCsvUri) ?? "";

    expect(csvContent).toContain(
      ["position",
      "catalogue_label",
      "catalogue_start_date",
      "catalogue_end_date",
      "name",
      "base_product",
      "barcode",
      "price",
      "promotion",
      "product_url",].join(",")
    );
    expect(csvContent).toContain('"1","burger-fridays","2026-03-27","2026-03-27"');
    expect(csvContent).toContain('"PnP Beef Burger 400g","000000000000886223"');
    expect(csvContent).toContain('"R55.99","Combo For R100.00"');
    expect(csvContent).toMatch(
      /"Combo For R100\.00"/,
    );
  });

  it("rejects traversal csvUri hints under the exports directory", async () => {
    const dump: CatalogueDump = {
      catalogueId: "WC21:burger-fridays",
      storeCode: "WC21",
      label: "burger-fridays",
      slug: "burger-fridays",
      query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
      sourceUrl:
        "https://www.pnp.co.za/Burger-Fridays/c/burger-fridays?q=%3Arelevance%3AallCategories%3Aburger-fridays%3AisOnPromotion%3AOn%2BPromotion",
      discoveredFrom: "sample",
      exportedAt: 1_774_608_000_000,
      itemCount: 1,
      barcodeCount: 1,
      catalogueStartDate: Date.parse("2026-03-26T22:00:00.000Z"),
      catalogueEndDate: Date.parse("2026-03-27T21:59:59.000Z"),
      expired: false,
      rows: [],
    };

    const persisted = await saveDump(dump);
    const csvUri = persisted.csvUri;
    if (!csvUri) {
      throw new Error("Expected saveDump to return a csvUri path.");
    }

    const traversalHint = `${EXPORTS_DIR}../dumps/evil.csv`;

    const ensuredCsvUri = await ensureCsvForDump(persisted.dumpUri, traversalHint);
    expect(ensuredCsvUri).toBe(csvUri);
    expect(fsMock.files.has(ensuredCsvUri)).toBe(true);
    expect(fsMock.files.has(traversalHint)).toBe(false);
  });

  it("prefers an existing dump csvUri over a missing hint", async () => {
    const dump: CatalogueDump = {
      catalogueId: "WC21:burger-fridays",
      storeCode: "WC21",
      label: "burger-fridays",
      slug: "burger-fridays",
      query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
      sourceUrl:
        "https://www.pnp.co.za/Burger-Fridays/c/burger-fridays?q=%3Arelevance%3AallCategories%3Aburger-fridays%3AisOnPromotion%3AOn%2BPromotion",
      discoveredFrom: "sample",
      exportedAt: 1_774_608_000_000,
      itemCount: 1,
      barcodeCount: 1,
      catalogueStartDate: Date.parse("2026-03-26T22:00:00.000Z"),
      catalogueEndDate: Date.parse("2026-03-27T21:59:59.000Z"),
      expired: false,
      rows: [],
    };

    const persisted = await saveDump(dump);
    const dumpContent = fsMock.files.get(persisted.dumpUri) ?? "";
    const existingCsvUri = `${EXPORTS_DIR}existing.csv`;
    const hintCsvUri = `${EXPORTS_DIR}hint.csv`;

    fsMock.files.set(existingCsvUri, "existing");
    fsMock.files.set(
      persisted.dumpUri,
      JSON.stringify({
        ...(JSON.parse(dumpContent) as CatalogueDump),
        csvUri: existingCsvUri,
      }),
    );

    const ensuredCsvUri = await ensureCsvForDump(persisted.dumpUri, hintCsvUri);
    expect(ensuredCsvUri).toBe(existingCsvUri);
    expect(fsMock.files.has(hintCsvUri)).toBe(false);
  });

  it("guards rebuildAllCsvExports against traversal csvUri overrides", async () => {
    const dump: CatalogueDump = {
      catalogueId: "WC21:burger-fridays",
      storeCode: "WC21",
      label: "burger-fridays",
      slug: "burger-fridays",
      query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
      sourceUrl:
        "https://www.pnp.co.za/Burger-Fridays/c/burger-fridays?q=%3Arelevance%3AallCategories%3Aburger-fridays%3AisOnPromotion%3AOn%2BPromotion",
      discoveredFrom: "sample",
      exportedAt: 1_774_608_000_000,
      itemCount: 1,
      barcodeCount: 1,
      catalogueStartDate: Date.parse("2026-03-26T22:00:00.000Z"),
      catalogueEndDate: Date.parse("2026-03-27T21:59:59.000Z"),
      expired: false,
      rows: [],
    };

    const persisted = await saveDump(dump);
    const csvUri = persisted.csvUri;
    if (!csvUri) {
      throw new Error("Expected saveDump to return a csvUri path.");
    }

    fsMock.files.set(
      MANIFEST_URI,
      JSON.stringify({
        version: 1,
        catalogues: {
          [dump.catalogueId]: {
            catalogueId: dump.catalogueId,
            storeCode: dump.storeCode,
            label: dump.label,
            slug: dump.slug,
            query: dump.query,
            itemCount: dump.itemCount,
            barcodeCount: dump.barcodeCount,
            productCodes: [],
            exportedAt: dump.exportedAt,
            sourceUrl: dump.sourceUrl,
            discoveredFrom: dump.discoveredFrom,
            catalogueImageUrl: null,
            catalogueStartDate: dump.catalogueStartDate,
            catalogueEndDate: dump.catalogueEndDate,
            expired: dump.expired,
            csvUri: `${EXPORTS_DIR}../dumps/evil.csv`,
            dumpUri: persisted.dumpUri,
          },
        },
      }),
    );

    const { rebuildAllCsvExports } = await import("./catalogueStore");
    const rewritten = await rebuildAllCsvExports();
    expect(rewritten).toBe(1);

    expect(fsMock.files.has(csvUri)).toBe(true);
    expect(fsMock.files.has(`${EXPORTS_DIR}../dumps/evil.csv`)).toBe(false);

    const manifestRaw = fsMock.files.get(MANIFEST_URI) ?? "";
    const manifest = JSON.parse(manifestRaw) as {
      catalogues: Record<string, { csvUri?: string }>;
    };
    expect(manifest.catalogues[dump.catalogueId]?.csvUri).toBe(csvUri);
  });
});
