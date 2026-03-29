import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueDump } from "../types";

const catalogueStoreMocks = vi.hoisted(() => {
  return {
    fileExists: vi.fn(async () => false),
    loadDumpByUri: vi.fn(async () => null),
    loadManifestCache: vi.fn(async () => ({ catalogues: {} })),
    loadProductCache: vi.fn(async () => ({ version: 1, items: {} })),
    saveDump: vi.fn(async (dump: CatalogueDump) => ({
      dump,
      csvUri: "file://mock.csv",
      dumpUri: "file://mock.json",
    })),
    saveManifestCache: vi.fn(async (_cache: unknown) => undefined),
    saveProductCache: vi.fn(async () => undefined),
  };
});

vi.mock("./catalogueStore", () => catalogueStoreMocks);

import { extractValidityDates, probeCatalogueWindow, pullCatalogueTarget } from "./pnp";

describe("pnp mapper regression coverage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-27T20:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("maps catalogue search payload into rows as expected", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/products/search?")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              pagination: { totalPages: 1, totalResults: 1 },
              products: [
                {
                  code: "000000000000886223_EA",
                  name: "PnP Beef Burger 400g",
                  url: "/pnp-beef-burger-400g/p/000000000000886223_EA",
                  price: { formattedValue: "R55.99" },
                  potentialPromotions: [
                    {
                      promotionTextMessage: "Combo For R100.00 ",
                      startDate: "2026-03-26T22:00:00+0000",
                      endDate: "2026-03-27T21:59:59+0000",
                    },
                  ],
                },
              ],
            }),
        };
      }

      if (url.includes("/products/000000000000886223_EA?")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              code: "000000000000886223_EA",
              baseProduct: "000000000000886223",
              name: "PnP Beef Burger 400g",
              url: "/pnp-beef-burger-400g/p/000000000000886223_EA",
              price: { formattedValue: "R55.99" },
              productDetailsDisplayInfoResponse: {
                productDetailDisplayInfos: [
                  {
                    displayInfoFields: [
                      {
                        name: "Barcode",
                        values: [{ value: "6001000000001" }],
                      },
                    ],
                  },
                ],
              },
            }),
        };
      }

      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ errors: [{ message: "Not Found" }] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const outcome = await pullCatalogueTarget(
      {
        slug: "burger-fridays",
        label: "burger-fridays",
        query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
      },
      "WC21",
      true,
    );

    expect(outcome.result.status).toBe("exported");
    expect(outcome.dump.catalogueId).toBe("WC21:burger-fridays");
    expect(outcome.dump.itemCount).toBe(1);
    expect(outcome.dump.barcodeCount).toBe(1);
    expect(outcome.dump.catalogueStartDate).toBe(Date.parse("2026-03-26T22:00:00.000Z"));
    expect(outcome.dump.catalogueEndDate).toBe(Date.parse("2026-03-27T21:59:59.000Z"));
    expect(outcome.dump.expired).toBe(false);

    expect(outcome.dump.rows).toHaveLength(1);
    expect(outcome.dump.rows[0]).toMatchObject({
      position: 1,
      catalogueSlug: "burger-fridays",
      name: "PnP Beef Burger 400g",
      productCode: "000000000000886223_EA",
      baseProduct: "000000000000886223",
      barcode: "6001000000001",
      price: "R55.99",
      promotion: "Combo For R100.00",
      productUrl: "https://www.pnp.co.za/pnp-beef-burger-400g/p/000000000000886223_EA",
      barcodeFound: true,
      error: "",
      promotionStartDate: Date.parse("2026-03-26T22:00:00.000Z"),
      promotionEndDate: Date.parse("2026-03-27T21:59:59.000Z"),
      promotionRanges:
        "2026-03-27 -> 2026-03-27 [Combo For R100.00]",
    });
  });

  it("persists catalogue listing metadata when exporting", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/products/search?")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              pagination: { totalPages: 1, totalResults: 1 },
              products: [
                {
                  code: "000000000000886223_EA",
                  name: "PnP Beef Burger 400g",
                  url: "/pnp-beef-burger-400g/p/000000000000886223_EA",
                  price: { formattedValue: "R55.99" },
                  potentialPromotions: [],
                },
              ],
            }),
        };
      }

      if (url.includes("/products/000000000000886223_EA?")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              code: "000000000000886223_EA",
              baseProduct: "000000000000886223",
              name: "PnP Beef Burger 400g",
              url: "/pnp-beef-burger-400g/p/000000000000886223_EA",
              price: { formattedValue: "R55.99" },
              productDetailsDisplayInfoResponse: {
                productDetailDisplayInfos: [
                  {
                    displayInfoFields: [
                      {
                        name: "Barcode",
                        values: [{ value: "6001000000001" }],
                      },
                    ],
                  },
                ],
              },
            }),
        };
      }

      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ errors: [{ message: "Not Found" }] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    catalogueStoreMocks.loadManifestCache.mockImplementation(async () => ({
      catalogues: {},
    }));

    await pullCatalogueTarget(
      {
        slug: "burger-fridays",
        label: "Pick n Pay Burger Fridays",
        query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
        sourceUrl: "https://www.pnp.co.za/c/burger-fridays",
        discoveredFrom: "unit-test",
        catalogueImageUrl: "https://cdn.example.com/burger-fridays.jpg",
        catalogueStartDate: Date.parse("2026-03-25T22:00:00.000Z"),
        catalogueEndDate: Date.parse("2026-03-29T21:59:59.999Z"),
      },
      "WC21",
      true,
    );

    expect(catalogueStoreMocks.saveManifestCache).toHaveBeenCalledTimes(1);
    const savedManifest = catalogueStoreMocks.saveManifestCache.mock.calls[0]?.[0] as {
      catalogues?: Record<string, unknown>;
    };
    expect(savedManifest?.catalogues?.["WC21:burger-fridays"]).toMatchObject({
      label: "Pick n Pay Burger Fridays",
      slug: "burger-fridays",
      sourceUrl: "https://www.pnp.co.za/c/burger-fridays",
      discoveredFrom: "unit-test",
      catalogueImageUrl: "https://cdn.example.com/burger-fridays.jpg",
      catalogueStartDate: Date.parse("2026-03-25T22:00:00.000Z"),
      catalogueEndDate: Date.parse("2026-03-29T21:59:59.999Z"),
    });
  });

  it("preserves cached catalogue metadata when refreshed listing data is incomplete", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/products/search?")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              pagination: { totalPages: 1, totalResults: 1 },
              products: [
                {
                  code: "000000000000886223_EA",
                  name: "PnP Beef Burger 400g",
                  url: "/pnp-beef-burger-400g/p/000000000000886223_EA",
                  price: { formattedValue: "R55.99" },
                  potentialPromotions: [],
                },
              ],
            }),
        };
      }

      if (url.includes("/products/000000000000886223_EA?")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              code: "000000000000886223_EA",
              baseProduct: "000000000000886223",
              name: "PnP Beef Burger 400g",
              url: "/pnp-beef-burger-400g/p/000000000000886223_EA",
              price: { formattedValue: "R55.99" },
              productDetailsDisplayInfoResponse: {
                productDetailDisplayInfos: [
                  {
                    displayInfoFields: [
                      {
                        name: "Barcode",
                        values: [{ value: "6001000000001" }],
                      },
                    ],
                  },
                ],
              },
            }),
        };
      }

      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ errors: [{ message: "Not Found" }] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const existingStart = Date.parse("2026-03-25T22:00:00.000Z");
    const existingEnd = Date.parse("2026-03-29T21:59:59.999Z");
    const existingPromotionEnd = Date.parse("2026-03-27T21:59:59.000Z");

    catalogueStoreMocks.loadManifestCache.mockImplementation(async () => ({
      catalogues: {
        "WC21:burger-fridays": {
          catalogueId: "WC21:burger-fridays",
          storeCode: "WC21",
          label: "Pick n Pay Burger Fridays",
          slug: "burger-fridays",
          query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
          itemCount: 1,
          barcodeCount: 1,
          productCodes: ["000000000000886223_EA"],
          exportedAt: Date.parse("2026-03-26T10:00:00.000Z"),
          sourceUrl: "https://www.pnp.co.za/c/burger-fridays",
          discoveredFrom: "cms",
          catalogueImageUrl: "https://cdn.example.com/burger-fridays.jpg",
          catalogueStartDate: existingStart,
          catalogueEndDate: existingEnd,
          promotionStartDate: existingStart,
          promotionEndDate: existingPromotionEnd,
          expired: false,
          csvUri: "file://mock.csv",
          dumpUri: "file://mock.json",
        },
      },
    }));

    await pullCatalogueTarget(
      {
        slug: "burger-fridays",
        label: "burger-fridays",
        query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
      },
      "WC21",
      true,
    );

    const savedManifest = catalogueStoreMocks.saveManifestCache.mock.calls[0]?.[0] as {
      catalogues?: Record<string, unknown>;
    };
    expect(savedManifest?.catalogues?.["WC21:burger-fridays"]).toMatchObject({
      label: "Pick n Pay Burger Fridays",
      slug: "burger-fridays",
      sourceUrl: "https://www.pnp.co.za/c/burger-fridays",
      discoveredFrom: "cms",
      catalogueImageUrl: "https://cdn.example.com/burger-fridays.jpg",
      catalogueStartDate: existingStart,
      catalogueEndDate: existingEnd,
      promotionEndDate: existingEnd,
    });
  });

  it("probes a catalogue window from a lightweight search call", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/products/search?") && url.includes("fields=products(potentialPromotions(FULL))")) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              pagination: { totalPages: 1, totalResults: 1 },
              products: [
                {
                  potentialPromotions: [
                    {
                      promotionTextMessage: "Combo For R100.00 ",
                      startDate: "2026-03-26T22:00:00+0000",
                      endDate: "2026-03-27T21:59:59+0000",
                    },
                  ],
                },
              ],
            }),
        };
      }

      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ errors: [{ message: "Not Found" }] }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const window = await probeCatalogueWindow(
      {
        slug: "burger-fridays",
        label: "burger-fridays",
        query: ":relevance:allCategories:burger-fridays:isOnPromotion:On Promotion",
      },
      "WC21",
    );

    expect(window.promotionStartDate).toBe(Date.parse("2026-03-26T22:00:00.000Z"));
    expect(window.promotionEndDate).toBe(Date.parse("2026-03-27T21:59:59.000Z"));
  });
});

describe("extractValidityDates", () => {
  it("infers the start year for cross-year ranges when the CMS omits it", () => {
    const html =
      '<p class="cat-validity-date">Valid 28 December - 3 January 2026</p>';

    expect(extractValidityDates(html)).toEqual({
      validityStartDate: "28 December 2025",
      validityEndDate: "3 January 2026",
    });
  });

  it("preserves explicit start year for cross-year ranges", () => {
    const html =
      '<p class="cat-validity-date">Valid 28 December 2025 - 3 January 2026</p>';

    expect(extractValidityDates(html)).toEqual({
      validityStartDate: "28 December 2025",
      validityEndDate: "3 January 2026",
    });
  });

  it("copies the end year onto the start date for same-year ranges", () => {
    const html = '<p class="cat-validity-date">Valid 26 March - 29 March 2026</p>';

    expect(extractValidityDates(html)).toEqual({
      validityStartDate: "26 March 2026",
      validityEndDate: "29 March 2026",
    });
  });
});
