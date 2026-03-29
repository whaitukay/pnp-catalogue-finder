export type CatalogueTimingStatus = "future" | "active" | "expired" | "unknown";

const SAST_OFFSET_MINUTES = 120;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function sastCalendarParts(timestamp: number): {
  year: number;
  month: number;
  day: number;
} {
  const shifted = new Date(timestamp + SAST_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function sastTimestampFromCalendar(
  year: number,
  month: number,
  day: number,
  options?: { endOfDay?: boolean },
): number {
  const endOfDay = options?.endOfDay === true;
  const hour = endOfDay ? 23 : 0;
  const minute = endOfDay ? 59 : 0;
  const second = endOfDay ? 59 : 0;
  const millisecond = endOfDay ? 999 : 0;

  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  return utcMillis - SAST_OFFSET_MINUTES * 60_000;
}

const MONTH_KEYS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

function monthIndexFromName(value: string): number | null {
  const key = value.trim().slice(0, 3).toLowerCase();
  const index = MONTH_KEYS.indexOf(key as (typeof MONTH_KEYS)[number]);
  return index === -1 ? null : index + 1;
}

function hasExplicitTimezone(value: string): boolean {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim());
}

function normalizeIsoTimezone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  // Normalize `±HHMM` offsets to `±HH:MM` to keep parsing consistent across JS engines.
  const offsetMatch = trimmed.match(/([+-]\d{2})(\d{2})$/);
  if (offsetMatch) {
    return `${trimmed.slice(0, -5)}${offsetMatch[1]}:${offsetMatch[2]}`;
  }

  return trimmed;
}

/**
* Parse catalogue and promotion date inputs into a numeric timestamp.
*
* Semantics:
* - When an input has an explicit timezone (e.g. `Z`, `+02:00`), that instant is preserved.
* - When an input has no timezone (`YYYY-MM-DD`, CMS `D Month YYYY`, or timezoneless ISO), it is treated
*   as South Africa wall time (GMT+2).
* - For calendar-only inputs, `endOfDay` controls whether the timestamp represents start or end of day.
*/
export function parseDateTimestamp(
  value: unknown,
  options?: { endOfDay?: boolean },
): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000_000_000) {
      return value;
    }
    if (absolute >= 1_000_000_000) {
      return value * 1000;
    }
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{13}$/.test(trimmed)) {
    const millis = Number(trimmed);
    return Number.isFinite(millis) ? millis : null;
  }

  if (/^\d{10}$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  }

  const calendarMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (calendarMatch) {
    return sastTimestampFromCalendar(
      Number(calendarMatch[1]),
      Number(calendarMatch[2]),
      Number(calendarMatch[3]),
      options,
    );
  }

  const cmsMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (cmsMatch) {
    const month = monthIndexFromName(cmsMatch[2]);
    if (!month) {
      return null;
    }

    return sastTimestampFromCalendar(
      Number(cmsMatch[3]),
      month,
      Number(cmsMatch[1]),
      options,
    );
  }

  const normalizedIso = normalizeIsoTimezone(trimmed);
  const isoToParse = hasExplicitTimezone(normalizedIso)
    ? normalizedIso
    : `${normalizedIso}+02:00`;

  const parsed = Date.parse(isoToParse);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

export function getCatalogueTimingStatus(
  startTimestamp: number | null,
  endTimestamp: number | null,
  nowTimestamp: number = Date.now(),
): CatalogueTimingStatus {
  if (startTimestamp != null && startTimestamp > nowTimestamp) {
    return "future";
  }

  if (endTimestamp != null && endTimestamp < nowTimestamp) {
    return "expired";
  }

  if (startTimestamp != null || endTimestamp != null) {
    return "active";
  }

  return "unknown";
}

export function formatDateDdMmYyyy(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }

  const parts = sastCalendarParts(value);
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

export function formatDateRangeDdMmYyyy(
  startTimestamp: number | null,
  endTimestamp: number | null,
): string {
  if (startTimestamp != null && endTimestamp != null) {
    return `${formatDateDdMmYyyy(startTimestamp)} - ${formatDateDdMmYyyy(endTimestamp)}`;
  }
  if (startTimestamp != null) {
    return formatDateDdMmYyyy(startTimestamp);
  }
  if (endTimestamp != null) {
    return formatDateDdMmYyyy(endTimestamp);
  }
  return "-";
}

export function formatDateYyyyMmDd(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "";
  }

  const parts = sastCalendarParts(value);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}
