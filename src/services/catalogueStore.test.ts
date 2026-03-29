import { describe, expect, it, vi } from "vitest";
import type { CatalogueDump } from "../types";

const fsMock = vi.hoisted(() => ({
  documentDirectory: "file:///mock-docs/",
  cacheDirectory: "file:///mock-cache/",
  EncodingType: { UTF8: "utf8" },
  makeDirectoryAsync: vi.fn(async () => undefined),
  getInfoAsync: vi.fn(async () => ({ exists: false })),
  readAsStringAsync: vi.fn(async () => ""),
  writeAsStringAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-file-system/legacy", () => ({
  ...fsMock,
}));

import { saveDump } from "./catalogueStore";

describe("catalogueStore CSV dump", () => {
  it("writes csv output for a sample catalogue dump", async () => {
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
      csvUri: "",
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
          promotionStartDate: Date.parse("2026-03-26T22:00:00.000Z"),
          promotionEndDate: Date.parse("2026-03-27T21:59:59.000Z"),
          promotionRanges:
            "2026-03-26T22:00:00+0000 -> 2026-03-27T21:59:59+0000 [Combo For R100.00]",
          promotions: [
            {
              text: "Combo For R100.00",
              startDate: Date.parse("2026-03-26T22:00:00.000Z"),
              endDate: Date.parse("2026-03-27T21:59:59.000Z"),
            },
          ],
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

    const writeCalls = fsMock.writeAsStringAsync.mock.calls as unknown as Array<
      [string, string]
    >;
    const csvWrite = writeCalls.find(
      ([uri]) =>
        uri ===
        "file:///mock-docs/catalogue-helper/exports/wc21-wc21-burger-fridays-barcodes.csv",
    );
    expect(csvWrite).toBeTruthy();
    const csvContent = csvWrite ? String(csvWrite[1]) : "";

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
});
