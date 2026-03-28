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
    saveManifestCache: vi.fn(async () => undefined),
    saveProductCache: vi.fn(async () => undefined),
  };
});

vi.mock("./catalogueStore", () => catalogueStoreMocks);

import { probeCatalogueWindow, pullCatalogueTarget } from "./pnp";

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
    expect(outcome.dump.promotionStartDate).toBe("2026-03-26T22:00:00.000Z");
    expect(outcome.dump.promotionEndDate).toBe("2026-03-27T21:59:59.000Z");
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
      promotionStartDate: "2026-03-26T22:00:00.000Z",
      promotionEndDate: "2026-03-27T21:59:59.000Z",
      promotionRanges:
        "2026-03-26T22:00:00.000Z -> 2026-03-27T21:59:59.000Z [Combo For R100.00]",
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

    expect(window.promotionStartDate).toBe("2026-03-26T22:00:00.000Z");
    expect(window.promotionEndDate).toBe("2026-03-27T21:59:59.000Z");
  });
});
