import { DEFAULT_EXPORT_FIELDS } from "../types";
import type {
  CatalogueListing,
  CatalogueTarget,
  ExportFieldKey,
  ManifestEntry,
  ProductRow,
} from "../types";
import { catalogueIdForTarget } from "../services/pnp";

export type DirectoryItem = CatalogueListing & {
  pullSource: string;
};

export type CatalogueTimingStatus = "future" | "active" | "expired" | "unknown";

export function normalizeStoreCode(value: string): string {
  return value.trim().toUpperCase() || "WC21";
}

export function parseDateString(value: string | null | undefined): number | null{
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(trimmed)) {
    const parsed = Date.parse(`${trimmed} GMT+2`);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function parseDateValue(
  value: string | null | undefined,
  endOfDay = false,
): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = Date.parse(
      endOfDay ? `${trimmed}T23:59:59.999` : `${trimmed}T12:00:00.000`,
    );
    return Number.isNaN(parsed) ? null : parsed;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isExpiredCatalogue(endDate: string | null | undefined): boolean {
  const parsed = parseDateValue(endDate, true);
  return parsed != null && parsed < Date.now();
}

export function getCatalogueTimingStatus(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): CatalogueTimingStatus {
  const now = Date.now();
  const startMillis = parseDateValue(startDate);
  const endMillis = parseDateValue(endDate, true);

  if (startMillis != null && startMillis > now) {
    return "future";
  }

  if (endMillis != null && endMillis < now) {
    return "expired";
  }

  if (startMillis != null || endMillis != null) {
    return "active";
  }

  return "unknown";
}

export function formatTimestamp(value: number | null | undefined): string {
  if (!value || Number.isNaN(value)) {
    return "Unknown";
  }
  return new Date(value).toLocaleString();
}

export function formatPromotionDate(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = Date.parse(`${value}T12:00:00.000`);
    return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleDateString();
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleString();
}

export function formatDateStamp(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = Date.parse(`${value}T12:00:00.000`);
    return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleDateString();
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleDateString();
}

export function formatDateStampRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const start = formatDateStamp(startDate);
  const end = formatDateStamp(endDate);

  if (startDate && endDate) {
    return `${start} - ${end}`;
  }
  if (startDate) {
    return start;
  }
  if (endDate) {
    return end;
  }
  return "-";
}

export function formatDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  if (startDate && endDate) {
    return `${formatPromotionDate(startDate)} to ${formatPromotionDate(endDate)}`;
  }
  if (startDate) {
    return `Starts ${formatPromotionDate(startDate)}`;
  }
  if (endDate) {
    return `Ends ${formatPromotionDate(endDate)}`;
  }
  return "No promotion dates found yet";
}

export function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice(page * pageSize, page * pageSize + pageSize);
}

export function totalPages(totalItems: number, pageSize: number): number {
  return totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0;
}

export function rowMatchesSearch(row: ProductRow, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [
    row.name,
    row.productCode,
    row.baseProduct,
    row.barcode,
    row.price,
    row.promotion,
    row.promotionRanges,
    row.productUrl,
  ].some((value) => value.toLowerCase().includes(query));
}

function directorySortValue(item: DirectoryItem): number {
  return (
    parseDateString(item.catalogueStartDate) ??
    parseDateString(item.catalogueEndDate) ??
    item.exportedAt ??
    0
  );
}

export function buildDirectoryItems(
  siteTargets: CatalogueTarget[],
  cachedCatalogues: ManifestEntry[],
  storeCode: string,
  hideExpiredCatalogues: boolean,
  provisionalWindows?: Record<
    string,
    { promotionStartDate: string | null; promotionEndDate: string | null }
  >,
): DirectoryItem[] {
  const cachedById = new Map(
    cachedCatalogues.map((entry) => [entry.catalogueId, entry] as const),
  );
  const usedIds = new Set<string>();
  const merged: DirectoryItem[] = [];

  for (const target of siteTargets) {
    const catalogueId = catalogueIdForTarget(storeCode, target);
    const cached = cachedById.get(catalogueId);
    const provisional = provisionalWindows?.[catalogueId];
    usedIds.add(catalogueId);

    merged.push({
      catalogueId,
      storeCode,
      label: cached?.label || target.label,
      slug: cached?.slug || target.slug || target.label,
      query: target.query,
      sourceUrl: target.sourceUrl || cached?.sourceUrl || "",
      discoveredFrom: target.discoveredFrom || cached?.discoveredFrom || "",
      siteOrder: target.siteOrder ?? null,
      fromSite: true,
      fromCache: Boolean(cached),
      itemCount: cached?.itemCount ?? null,
      barcodeCount: cached?.barcodeCount ?? null,
      exportedAt: cached?.exportedAt ?? null,
      catalogueStartDate: target.catalogueStartDate,
      catalogueEndDate: target.catalogueEndDate,
      promotionStartDate: cached?.promotionStartDate ?? provisional?.promotionStartDate ?? null,
      promotionEndDate: cached?.promotionEndDate ?? provisional?.promotionEndDate ?? null,
      expired: cached?.expired ?? isExpiredCatalogue(cached?.promotionEndDate),
      csvUri: cached?.csvUri || "",
      dumpUri: cached?.dumpUri || "",
      pullSource: target.sourceUrl || target.query || target.slug || target.label,
    });
  }

  for (const cached of cachedCatalogues) {
    if (usedIds.has(cached.catalogueId)) {
      continue;
    }

    merged.push({
      catalogueId: cached.catalogueId,
      storeCode: cached.storeCode,
      label: cached.label,
      slug: cached.slug,
      query: cached.query,
      sourceUrl: cached.sourceUrl,
      discoveredFrom: cached.discoveredFrom,
      siteOrder: null,
      fromSite: false,
      fromCache: true,
      itemCount: cached.itemCount,
      barcodeCount: cached.barcodeCount,
      exportedAt: cached.exportedAt,
      catalogueEndDate: cached.catalogueEndDate,
      catalogueStartDate: cached.catalogueStartDate,
      promotionStartDate: cached.promotionStartDate,
      promotionEndDate: cached.promotionEndDate,
      expired: cached.expired || isExpiredCatalogue(cached.promotionEndDate),
      csvUri: cached.csvUri,
      dumpUri: cached.dumpUri,
      pullSource: cached.sourceUrl || cached.query || cached.slug || cached.label,
    });
  }

  const visible = hideExpiredCatalogues
    ? merged.filter((item) => !item.expired)
    : merged;

  return visible.sort((left, right) => {
    if (left.fromSite && right.fromSite) {
      const siteOrderDiff =
        (left.siteOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.siteOrder ?? Number.MAX_SAFE_INTEGER);
      if (siteOrderDiff !== 0) {
        return siteOrderDiff;
      }
    }

    if (left.fromSite !== right.fromSite) {
      return left.fromSite ? -1 : 1;
    }

    const timeDiff = directorySortValue(right) - directorySortValue(left);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    return left.label.localeCompare(right.label);
  });
}

export function nextSelectedEmailId(
  entries: ManifestEntry[],
  hideExpiredCatalogues: boolean,
  preferredId: string | null,
): string | null {
  const visible = hideExpiredCatalogues
    ? entries.filter((entry) => !entry.expired)
    : entries;

  if (preferredId && visible.some((entry) => entry.catalogueId === preferredId)) {
    return preferredId;
  }

  return visible[0]?.catalogueId ?? null;
}

export function normalizeExportFields(fields: ExportFieldKey[]): ExportFieldKey[] {
  return fields.length > 0 ? Array.from(new Set(fields)) : DEFAULT_EXPORT_FIELDS;
}
