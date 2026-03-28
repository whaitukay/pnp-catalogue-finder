import * as FileSystem from "expo-file-system/legacy";

import {
  DEFAULT_EXPORT_FIELDS,
  EXPORT_FIELD_OPTIONS,
} from "../types";
import type {
  AppSettings,
  CatalogueDump,
  ExportFieldKey,
  ManifestCache,
  ManifestEntry,
  ProductCache,
  ProductRow,
  PromotionWindow,
} from "../types";

const DOCUMENT_DIR = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? "";

if (!DOCUMENT_DIR) {
  throw new Error("Expo file storage is unavailable in this environment.");
}

const ROOT_DIR = `${DOCUMENT_DIR}catalogue-helper/`;
const CACHE_DIR = `${ROOT_DIR}cache/`;
const DUMPS_DIR = `${ROOT_DIR}dumps/`;
const EXPORTS_DIR = `${ROOT_DIR}exports/`;
const SETTINGS_URI = `${ROOT_DIR}settings.json`;
const PRODUCT_CACHE_URI = `${CACHE_DIR}product-details.json`;
const MANIFEST_URI = `${CACHE_DIR}catalogue-manifests.json`;

export const DEFAULT_SETTINGS: AppSettings = {
  storeCode: "WC21",
  hideExpiredCatalogues: false,
  exportFields: DEFAULT_EXPORT_FIELDS,
};

const DEFAULT_PRODUCT_CACHE: ProductCache = {
  version: 1,
  items: {},
};

const DEFAULT_MANIFEST_CACHE: ManifestCache = {
  version: 1,
  catalogues: {},
};

const EXPORT_FIELD_SET = new Set<ExportFieldKey>(
  EXPORT_FIELD_OPTIONS.map((item) => item.key),
);

type CsvFieldDefinition = {
  header: string;
  getValue: (row: ProductRow, dump: CatalogueDump) => string;
};

async function ensureDirectory(uri: string): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  } catch {
    // Directory already exists or is unavailable for creation.
  }
}

async function readJson<T>(uri: string, fallback: T): Promise<T> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return fallback;
    }
    const raw = await FileSystem.readAsStringAsync(uri);
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(uri: string, value: unknown): Promise<void> {
  await ensureStorage();
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(value, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNullableText(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function parseDateValue(value: string | null | undefined, endOfDay = false): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = Date.parse(
      endOfDay ? `${trimmed}T23:59:59.999` : `${trimmed}T00:00:00.000`,
    );
    return Number.isNaN(parsed) ? null : parsed;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function minDate(values: Array<string | null | undefined>): string | null {
  const dated = values
    .map((value) => ({
      value: value ?? null,
      millis: parseDateValue(value ?? null),
    }))
    .filter((item): item is { value: string; millis: number } => {
      return Boolean(item.value) && item.millis != null;
    })
    .sort((left, right) => left.millis - right.millis);

  return dated[0]?.value ?? null;
}

function maxDate(values: Array<string | null | undefined>): string | null {
  const dated = values
    .map((value) => ({
      value: value ?? null,
      millis: parseDateValue(value ?? null, true),
    }))
    .filter((item): item is { value: string; millis: number } => {
      return Boolean(item.value) && item.millis != null;
    })
    .sort((left, right) => right.millis - left.millis);

  return dated[0]?.value ?? null;
}

function isExpired(endDate: string | null | undefined): boolean {
  const millis = parseDateValue(endDate ?? null, true);
  return millis != null && millis < Date.now();
}

function formatDateForCsv(value: string | null | undefined): string {
  return normalizeText(value);
}

/** PnP-style offsets at end: `Z`, `±HH:MM`, `±HHMM`. */
function hasExplicitTimezone(value: string): boolean {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim());
}

/**
 * If the string has no timezone, treat it as **SAST wall time** (GMT+2).
 * If it is Zulu/UTC (`Z`, `±00:00`), keep it — `Date` + Johannesburg formatting apply the offset.
 */
function normalizeIsoForSaParsing(value: string): string {
  const t = value.trim();
  if (!t) {
    return t;
  }
  if (hasExplicitTimezone(t)) {
    return t;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return `${t}T12:00:00+02:00`;
  }
  if (t.includes("T")) {
    return `${t}+02:00`;
  }
  return t;
}

const CSV_CALENDAR_TIME_ZONE = "Africa/Johannesburg";

/** ISO timestamps → `YYYY-MM-DD` in South Africa local calendar for spreadsheet-friendly CSV cells. */
function formatDateOnlyForCsv(value: string | null | undefined): string {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return "";
  }
  const iso = normalizeIsoForSaParsing(trimmed);
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return trimmed;
  }
  const instant = new Date(parsed);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CSV_CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function formatPromotionRange(promotion: PromotionWindow): string {
  const start = formatDateForCsv(promotion.startDate);
  const end = formatDateForCsv(promotion.endDate);

  if (start && end) {
    return `${start} -> ${end}`;
  }
  if (start) {
    return `Starts ${start}`;
  }
  if (end) {
    return `Ends ${end}`;
  }
  return promotion.text || "";
}

function buildPromotionRangesText(promotions: PromotionWindow[]): string {
  const parts = promotions
    .map((promotion) => formatPromotionRange(promotion))
    .filter(Boolean);
  return Array.from(new Set(parts)).join(" | ");
}

function csvCell(value: string | number | boolean): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function normalizeExportFields(value: unknown): ExportFieldKey[] {
  if (!Array.isArray(value)) {
    return DEFAULT_EXPORT_FIELDS;
  }

  const fields = value.filter((item): item is ExportFieldKey => {
    return typeof item === "string" && EXPORT_FIELD_SET.has(item as ExportFieldKey);
  });

  return fields.length > 0 ? Array.from(new Set(fields)) : DEFAULT_EXPORT_FIELDS;
}

function normalizeSettings(raw: unknown): AppSettings {
  return {
    storeCode: normalizeText((raw as AppSettings | null)?.storeCode) || DEFAULT_SETTINGS.storeCode,
    hideExpiredCatalogues: Boolean(
      (raw as AppSettings | null)?.hideExpiredCatalogues ?? DEFAULT_SETTINGS.hideExpiredCatalogues,
    ),
    exportFields: normalizeExportFields((raw as AppSettings | null)?.exportFields),
  };
}

function normalizePromotion(promotion: unknown): PromotionWindow {
  return {
    text: normalizeText((promotion as PromotionWindow | null)?.text),
    startDate: normalizeNullableText((promotion as PromotionWindow | null)?.startDate),
    endDate: normalizeNullableText((promotion as PromotionWindow | null)?.endDate),
  };
}

function normalizeRow(row: unknown): ProductRow {
  const raw = row as ProductRow | null;
  const promotions = Array.isArray(raw?.promotions)
    ? raw.promotions.map((promotion) => normalizePromotion(promotion))
    : [];
  const promotionStartDate =
    normalizeNullableText(raw?.promotionStartDate) ??
    minDate(promotions.map((promotion) => promotion.startDate));
  const promotionEndDate =
    normalizeNullableText(raw?.promotionEndDate) ??
    maxDate(promotions.map((promotion) => promotion.endDate));

  return {
    position:
      typeof raw?.position === "number" && Number.isFinite(raw.position)
        ? raw.position
        : 0,
    catalogueSlug: normalizeText(raw?.catalogueSlug),
    name: normalizeText(raw?.name),
    productCode: normalizeText(raw?.productCode),
    baseProduct: normalizeText(raw?.baseProduct),
    barcode: normalizeText(raw?.barcode),
    price: normalizeText(raw?.price),
    promotion: normalizeText(raw?.promotion),
    promotionStartDate,
    promotionEndDate,
    promotionRanges:
      normalizeText(raw?.promotionRanges) || buildPromotionRangesText(promotions),
    promotions,
    productUrl: normalizeText(raw?.productUrl),
    barcodeFound: Boolean(raw?.barcodeFound ?? normalizeText(raw?.barcode)),
    error: normalizeText(raw?.error),
  };
}

function normalizeDumpValue(dump: unknown): CatalogueDump {
  const raw = dump as CatalogueDump | null;
  const rows = Array.isArray(raw?.rows) ? raw.rows.map((row) => normalizeRow(row)) : [];
  const promotionStartDate =
    normalizeNullableText(raw?.promotionStartDate) ??
    minDate(rows.map((row) => row.promotionStartDate));
  const promotionEndDate =
    normalizeNullableText(raw?.promotionEndDate) ??
    maxDate(rows.map((row) => row.promotionEndDate));
  const barcodeCount =
    typeof raw?.barcodeCount === "number" && Number.isFinite(raw.barcodeCount)
      ? raw.barcodeCount
      : rows.filter((row) => row.barcodeFound).length;

  return {
    catalogueId: normalizeText(raw?.catalogueId),
    storeCode: normalizeText(raw?.storeCode),
    label: normalizeText(raw?.label),
    slug: normalizeText(raw?.slug),
    query: normalizeText(raw?.query),
    sourceUrl: normalizeText(raw?.sourceUrl),
    discoveredFrom: normalizeText(raw?.discoveredFrom),
    exportedAt:
      typeof raw?.exportedAt === "number" && Number.isFinite(raw.exportedAt)
        ? raw.exportedAt
        : Date.now(),
    itemCount:
      typeof raw?.itemCount === "number" && Number.isFinite(raw.itemCount)
        ? raw.itemCount
        : rows.length,
    barcodeCount,
    promotionStartDate,
    promotionEndDate,
    expired:
      typeof raw?.expired === "boolean" ? raw.expired : isExpired(promotionEndDate),
    csvUri: normalizeText(raw?.csvUri),
    rows,
  };
}

function normalizeManifestEntry(entry: unknown): ManifestEntry {
  const raw = entry as ManifestEntry | null;
  return {
    catalogueId: normalizeText(raw?.catalogueId),
    storeCode: normalizeText(raw?.storeCode),
    label: normalizeText(raw?.label),
    slug: normalizeText(raw?.slug),
    query: normalizeText(raw?.query),
    itemCount:
      typeof raw?.itemCount === "number" && Number.isFinite(raw.itemCount)
        ? raw.itemCount
        : 0,
    barcodeCount:
      typeof raw?.barcodeCount === "number" && Number.isFinite(raw.barcodeCount)
        ? raw.barcodeCount
        : 0,
    productCodes: Array.isArray(raw?.productCodes)
      ? raw.productCodes.map((item) => normalizeText(item)).filter(Boolean)
      : [],
    exportedAt:
      typeof raw?.exportedAt === "number" && Number.isFinite(raw.exportedAt)
        ? raw.exportedAt
        : 0,
    sourceUrl: normalizeText(raw?.sourceUrl),
    discoveredFrom: normalizeText(raw?.discoveredFrom),
    promotionStartDate: normalizeNullableText(raw?.promotionStartDate),
    promotionEndDate: normalizeNullableText(raw?.promotionEndDate),
    expired:
      typeof raw?.expired === "boolean"
        ? raw.expired
        : isExpired(normalizeNullableText(raw?.promotionEndDate)),
    csvUri: normalizeText(raw?.csvUri),
    dumpUri: normalizeText(raw?.dumpUri),
  };
}

function normalizeManifestCache(raw: unknown): ManifestCache {
  const catalogues = Object.fromEntries(
    Object.entries((raw as ManifestCache | null)?.catalogues ?? {}).map(([key, value]) => [
      key,
      normalizeManifestEntry(value),
    ]),
  );

  return {
    version:
      typeof (raw as ManifestCache | null)?.version === "number"
        ? (raw as ManifestCache).version
        : DEFAULT_MANIFEST_CACHE.version,
    catalogues,
  };
}

function sortTimestamp(entry: ManifestEntry): number {
  return (
    parseDateValue(entry.promotionStartDate) ??
    parseDateValue(entry.promotionEndDate, true) ??
    entry.exportedAt
  );
}

function buildDumpPaths(
  dump: CatalogueDump,
): { baseName: string; csvUri: string; dumpUri: string } {
  const baseName = `${safeFileName(dump.storeCode)}-${safeFileName(
    dump.label || dump.slug || "catalogue-specials",
  )}`;

  return {
    baseName,
    csvUri: dump.csvUri || `${EXPORTS_DIR}${baseName}-barcodes.csv`,
    dumpUri: `${DUMPS_DIR}${baseName}-dump.json`,
  };
}

const CSV_FIELD_DEFINITIONS: Record<ExportFieldKey, CsvFieldDefinition> = {
  position: {
    header: "position",
    getValue: (row) => String(row.position),
  },
  catalogueLabel: {
    header: "catalogue_label",
    getValue: (_row, dump) => dump.label,
  },
  catalogueSlug: {
    header: "catalogue_slug",
    getValue: (_row, dump) => dump.slug,
  },
  catalogueStartDate: {
    header: "catalogue_start_date",
    getValue: (_row, dump) => formatDateOnlyForCsv(dump.promotionStartDate),
  },
  catalogueEndDate: {
    header: "catalogue_end_date",
    getValue: (_row, dump) => formatDateOnlyForCsv(dump.promotionEndDate),
  },
  name: {
    header: "name",
    getValue: (row) => row.name,
  },
  productCode: {
    header: "product_code",
    getValue: (row) => row.productCode,
  },
  baseProduct: {
    header: "base_product",
    getValue: (row) => row.baseProduct,
  },
  barcode: {
    header: "barcode",
    getValue: (row) => row.barcode,
  },
  price: {
    header: "price",
    getValue: (row) => row.price,
  },
  promotion: {
    header: "promotion",
    getValue: (row) => row.promotion,
  },
  promotionStartDate: {
    header: "promotion_start_date",
    getValue: (row) => formatDateOnlyForCsv(row.promotionStartDate),
  },
  promotionEndDate: {
    header: "promotion_end_date",
    getValue: (row) => formatDateOnlyForCsv(row.promotionEndDate),
  },
  promotionRanges: {
    header: "promotion_ranges",
    getValue: (row) => row.promotionRanges,
  },
  productUrl: {
    header: "product_url",
    getValue: (row) => row.productUrl,
  },
  barcodeFound: {
    header: "barcode_found",
    getValue: (row) => (row.barcodeFound ? "yes" : "no"),
  },
  error: {
    header: "error",
    getValue: (row) => row.error,
  },
};

function buildCsv(dump: CatalogueDump, fields: ExportFieldKey[]): string {
  const selectedFields = fields.length > 0 ? fields : DEFAULT_EXPORT_FIELDS;
  const header = selectedFields.map((field) => CSV_FIELD_DEFINITIONS[field].header);
  const lines = [
    header.join(","),
    ...dump.rows.map((row) =>
      selectedFields
        .map((field) => CSV_FIELD_DEFINITIONS[field].getValue(row, dump))
        .map(csvCell)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

async function writeCsvForDump(
  dump: CatalogueDump,
  csvUri: string,
  fields: ExportFieldKey[],
): Promise<void> {
  await FileSystem.writeAsStringAsync(csvUri, buildCsv(dump, fields), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export function safeFileName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "catalogue-specials"
  );
}

export async function ensureStorage(): Promise<void> {
  await Promise.all([
    ensureDirectory(ROOT_DIR),
    ensureDirectory(CACHE_DIR),
    ensureDirectory(DUMPS_DIR),
    ensureDirectory(EXPORTS_DIR),
  ]);
}

export async function loadSettings(): Promise<AppSettings> {
  const raw = await readJson(SETTINGS_URI, DEFAULT_SETTINGS);
  return normalizeSettings(raw);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJson(SETTINGS_URI, normalizeSettings(settings));
}

export async function loadProductCache(): Promise<ProductCache> {
  return readJson(PRODUCT_CACHE_URI, DEFAULT_PRODUCT_CACHE);
}

export async function saveProductCache(cache: ProductCache): Promise<void> {
  await writeJson(PRODUCT_CACHE_URI, cache);
}

export async function loadManifestCache(): Promise<ManifestCache> {
  const raw = await readJson(MANIFEST_URI, DEFAULT_MANIFEST_CACHE);
  return normalizeManifestCache(raw);
}

export async function saveManifestCache(cache: ManifestCache): Promise<void> {
  await writeJson(MANIFEST_URI, normalizeManifestCache(cache));
}

export async function fileExists(uri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists;
}

export async function saveDump(
  dump: CatalogueDump,
): Promise<{ dump: CatalogueDump; dumpUri: string; csvUri: string }> {
  await ensureStorage();

  const settings = await loadSettings();
  const normalizedDump = normalizeDumpValue(dump);
  const { csvUri, dumpUri } = buildDumpPaths(normalizedDump);
  const persistedDump: CatalogueDump = {
    ...normalizedDump,
    csvUri,
  };

  await writeCsvForDump(persistedDump, csvUri, settings.exportFields);
  await writeJson(dumpUri, persistedDump);

  return {
    dump: persistedDump,
    dumpUri,
    csvUri,
  };
}

export async function rebuildAllCsvExports(): Promise<number> {
  await ensureStorage();

  const settings = await loadSettings();
  const manifest = await loadManifestCache();
  let rewrittenCount = 0;

  for (const [catalogueId, entry] of Object.entries(manifest.catalogues)) {
    if (!entry.dumpUri) {
      continue;
    }

    const dump = await loadDumpByUri(entry.dumpUri);
    if (!dump) {
      continue;
    }

    const persisted = await saveDump({
      ...dump,
      csvUri: entry.csvUri || dump.csvUri,
    });

    manifest.catalogues[catalogueId] = {
      ...entry,
      csvUri: persisted.csvUri,
      dumpUri: persisted.dumpUri,
      promotionStartDate: persisted.dump.promotionStartDate,
      promotionEndDate: persisted.dump.promotionEndDate,
      expired: persisted.dump.expired,
      itemCount: persisted.dump.itemCount,
      barcodeCount: persisted.dump.barcodeCount,
      exportedAt: persisted.dump.exportedAt,
    };

    await writeCsvForDump(persisted.dump, persisted.csvUri, settings.exportFields);
    rewrittenCount += 1;
  }

  await saveManifestCache(manifest);
  return rewrittenCount;
}

export async function loadDumpByUri(uri: string): Promise<CatalogueDump | null> {
  const raw = await readJson<CatalogueDump | null>(uri, null);
  return raw ? normalizeDumpValue(raw) : null;
}

export async function loadDump(catalogueId: string): Promise<CatalogueDump | null> {
  const manifest = await loadManifestCache();
  const entry = manifest.catalogues[catalogueId];
  if (!entry) {
    return null;
  }
  return loadDumpByUri(entry.dumpUri);
}

export async function listCachedCatalogues(storeCode?: string): Promise<ManifestEntry[]> {
  const manifest = await loadManifestCache();

  return Object.values(manifest.catalogues)
    .filter((entry) => (storeCode ? entry.storeCode === storeCode : true))
    .sort((left, right) => {
      const timestampDiff = sortTimestamp(right) - sortTimestamp(left);
      if (timestampDiff !== 0) {
        return timestampDiff;
      }
      return right.exportedAt - left.exportedAt || left.label.localeCompare(right.label);
    });
}

export function defaultEmailSubject(entry: ManifestEntry | CatalogueDump): string {
  return `Catalogue export: ${entry.label}`;
}

export function defaultEmailBody(entry: ManifestEntry | CatalogueDump): string {
  return `Attached is the CSV export for ${entry.label}.`;
}
