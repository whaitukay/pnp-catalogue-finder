import { describe, expect, it } from "vitest";

import { ean13ToRawSbs, normalizeBarcodeForRendering } from "./barcodes";

describe("barcodes", () => {
  it("renders 2* 13-digit scale codes ending in 000000 as EAN-13 even with an invalid check digit", () => {
    expect(normalizeBarcodeForRendering("2009692000000")).toEqual({
      format: "EAN13",
      value: "2009692000000",
    });
  });

  it("treats 2* EAN-13 values with a valid check digit as EAN-13", () => {
    expect(normalizeBarcodeForRendering("2000000000008")).toEqual({
      format: "EAN13",
      value: "2000000000008",
    });
  });

  it("rejects non-scale 2* EAN-13 values with an invalid check digit", () => {
    expect(normalizeBarcodeForRendering("2000000000007")).toBeNull();
  });

  it("accepts valid EAN-13 inputs", () => {
    expect(normalizeBarcodeForRendering("6001000000001")).toEqual({
      format: "EAN13",
      value: "6001000000001",
    });
  });

  it("strips non-digit formatting characters before validating", () => {
    expect(normalizeBarcodeForRendering("6001-0000-0000-1")).toEqual({
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

  it("normalizes 7-digit EAN-8 bodies by appending the computed check digit", () => {
    expect(normalizeBarcodeForRendering("5512345")).toEqual({
      format: "EAN8",
      value: "55123457",
    });
  });

  it("rejects invalid EAN-8 inputs", () => {
    expect(normalizeBarcodeForRendering("73513538")).toBeNull();
  });

  it("treats non-UPCA 12-digit inputs as EAN-13 bodies with a computed check digit", () => {
    expect(normalizeBarcodeForRendering("123456789013")).toEqual({
      format: "EAN13",
      value: "1234567890135",
    });
  });

  it("encodes EAN-13 values into a BWIPP raw SBS string", () => {
    const sbs = ean13ToRawSbs("2009692000000");
    expect(sbs).not.toBeNull();
    expect(sbs).toMatch(/^[1-9]+$/);
    expect(
      sbs!
        .split("")
        .map((digit) => Number(digit))
        .reduce((sum, value) => sum + value, 0),
    ).toBe(95);
  });

  it("produces the expected SBS output for a known EAN-13 input", () => {
    const cases: Array<{ ean: string; sbs: string }> = [
      {
        ean: "0000000000000",
        sbs: "11132113211321132113211321111111321132113211321132113211111",
      },
      {
        ean: "1000000000000",
        sbs: "11132113211112332111123112311111321132113211321132113211111",
      },
      {
        ean: "2000000000000",
        sbs: "11132113211112311233211112311111321132113211321132113211111",
      },
      {
        ean: "3000000000000",
        sbs: "11132113211112311231123321111111321132113211321132113211111",
      },
      {
        ean: "4000000000000",
        sbs: "11132111123321132111123112311111321132113211321132113211111",
      },
      {
        ean: "5000000000000",
        sbs: "11132111123112332113211112311111321132113211321132113211111",
      },
      {
        ean: "6000000000000",
        sbs: "11132111123112311233211321111111321132113211321132113211111",
      },
      {
        ean: "7000000000000",
        sbs: "11132111123321111233211112311111321132113211321132113211111",
      },
      {
        ean: "8000000000000",
        sbs: "11132111123321111231123321111111321132113211321132113211111",
      },
      {
        ean: "9000000000000",
        sbs: "11132111123112332111123321111111321132113211321132113211111",
      },
      {
        ean: "6001000000001",
        sbs: "11132111123122211233211321111111321132113211321132112221111",
      },
    ];

    for (const { ean, sbs } of cases) {
      expect(ean13ToRawSbs(ean)).toBe(sbs);
    }
  });

  it("rejects invalid input when encoding raw EAN-13 SBS strings", () => {
    expect(ean13ToRawSbs("200969200000")).toBeNull();
    expect(ean13ToRawSbs("2009692000000A")).toBeNull();
  });
});
