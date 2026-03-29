import { describe, expect, it } from "vitest";

import {
  formatDateDdMmYyyy,
  formatDateRangeDdMmYyyy,
  formatDateYyyyMmDd,
  getCatalogueTimingStatus,
  parseDateTimestamp,
} from "./dateUtils";

describe("dateUtils", () => {
  it("parses CMS calendar dates as South Africa (GMT+2) start/end of day timestamps", () => {
    expect(parseDateTimestamp("26 March 2026")).toBe(
      Date.parse("2026-03-25T22:00:00.000Z"),
    );
    expect(parseDateTimestamp("29 March 2026", { endOfDay: true })).toBe(
      Date.parse("2026-03-29T21:59:59.999Z"),
    );
  });

  it("parses YYYY-MM-DD inputs as South Africa (GMT+2) calendar dates", () => {
    expect(parseDateTimestamp("2026-03-29")).toBe(Date.parse("2026-03-28T22:00:00.000Z"));
    expect(parseDateTimestamp("2026-03-29", { endOfDay: true })).toBe(
      Date.parse("2026-03-29T21:59:59.999Z"),
    );
  });

  it("treats timezoneless ISO strings as South Africa (GMT+2) wall time", () => {
    expect(parseDateTimestamp("2026-03-29T10:30:00")).toBe(
      Date.parse("2026-03-29T08:30:00.000Z"),
    );
  });

  it("respects explicit timezones and normalizes PnP-style offsets", () => {
    expect(parseDateTimestamp("2026-03-26T22:00:00+0000")).toBe(
      Date.parse("2026-03-26T22:00:00.000Z"),
    );
    expect(parseDateTimestamp("2026-03-26T22:00:00Z")).toBe(
      Date.parse("2026-03-26T22:00:00.000Z"),
    );
  });

  it("formats timestamps as DD/MM/YYYY for UI and YYYY-MM-DD for CSV", () => {
    const timestamp = Date.parse("2026-03-29T21:59:59.999Z");
    expect(formatDateDdMmYyyy(timestamp)).toBe("29/03/2026");
    expect(formatDateRangeDdMmYyyy(timestamp, timestamp)).toBe("29/03/2026 - 29/03/2026");
    expect(formatDateYyyyMmDd(timestamp)).toBe("2026-03-29");
  });

  it("determines future/active/expired catalogue timing status", () => {
    const now = Date.parse("2026-03-27T20:00:00.000Z");
    const start = Date.parse("2026-03-25T22:00:00.000Z");
    const end = Date.parse("2026-03-29T21:59:59.999Z");

    expect(getCatalogueTimingStatus(start, end, now)).toBe("active");
    expect(getCatalogueTimingStatus(end, null, now)).toBe("future");
    expect(getCatalogueTimingStatus(null, start, now)).toBe("expired");
    expect(getCatalogueTimingStatus(null, null, now)).toBe("unknown");
  });
});
