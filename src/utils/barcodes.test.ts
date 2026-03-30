import { describe, expect, it } from "vitest";

import { normalizeBarcodeForRendering } from "./barcodes";

describe("barcodes", () => {
  it("renders 2* 13-digit scale codes as Code 128 without mutation", () => {
    expect(normalizeBarcodeForRendering("2009692000000")).toEqual({
      format: "CODE128",
      value: "2009692000000",
    });
  });

  it("accepts valid EAN-13 inputs", () => {
    expect(normalizeBarcodeForRendering("6001000000001")).toEqual({
      format: "EAN13",
      value: "6001000000001",
    });
  });

  it("rejects non-2* EAN-13 inputs with an invalid check digit", () => {
    expect(normalizeBarcodeForRendering("6001000000002")).toBeNull();
  });

  it("normalizes UPC-A to EAN-13 when the UPC check digit is valid", () => {
    expect(normalizeBarcodeForRendering("036000291452")).toEqual({
      format: "EAN13",
      value: "0036000291452",
    });
  });

  it("accepts valid EAN-8 inputs", () => {
    expect(normalizeBarcodeForRendering("73513537")).toEqual({
      format: "EAN8",
      value: "73513537",
    });
  });
});
