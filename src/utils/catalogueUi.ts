import { DEFAULT_EXPORT_FIELDS } from "../types";
import type {
  CatalogueListing,
  CatalogueTarget,
  ExportFieldKey,
  ManifestEntry,
  ProductRow,
} from "../types";
import { catalogueIdForTarget } from "../services/pnp";
import { coalesceCatalogueImageUrl } from "./catalogueImageUrl";
import {
  formatDateDdMmYyyy,
  formatDateRangeDdMmYyyy,
  getCatalogueTimingStatus,
} from "./dateUtils";

export type { CatalogueTimingStatus } from "./dateUtils";
export { getCatalogueTimingStatus } from "./dateUtils";

export type DirectoryItem = CatalogueListing & {
  pullSource: string;
};

export function normalizeStoreCode(value: string): string {
  return value.trim().toUpperCase() || "WC21";
}


export function formatTimestamp(value: number | null): string {
  if (!value || Number.isNaN(value)) {
    return "Unknown";
  }
  return new Date(value).toLocaleString();
}

export function formatPromotionDate(value: number | null): string {
  return value != null ? formatDateDdMmYyyy(value) : "Unknown";
}

export function formatDateStamp(value: number | null): string {
  return formatDateDdMmYyyy(value);
}

export function formatDateStampRange(
  startDate: number | null,
  endDate: number | null,
): string {
  return formatDateRangeDdMmYyyy(startDate, endDate);
}

export function formatDateRange(
  startDate: number | null,
  endDate: number | null,
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
    item.catalogueStartDate ?? item.catalogueEndDate ?? item.exportedAt ?? 0
  );
}

export function buildDirectoryItems(
  siteTargets: CatalogueTarget[],
  cachedCatalogues: ManifestEntry[],
  storeCode: string,
  hideExpiredCatalogues: boolean,
  provisionalWindows?: Record<
    string,
    { promotionStartDate: number | null; promotionEndDate: number | null }
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
    const catalogueStartDate =
      target.catalogueStartDate ?? cached?.catalogueStartDate ?? null;
    const catalogueEndDate =
      target.catalogueEndDate ?? cached?.catalogueEndDate ?? null;
    const promotionEndDate =
      cached?.promotionEndDate ?? provisional?.promotionEndDate ?? null;
    const effectiveEndDate = promotionEndDate ?? catalogueEndDate;
    usedIds.add(catalogueId);

    merged.push({
      catalogueId,
      storeCode,
      label: cached?.label || target.label,
      slug: cached?.slug || target.slug || target.label,
      query: target.query,
      sourceUrl: target.sourceUrl || cached?.sourceUrl || "",
      discoveredFrom: target.discoveredFrom || cached?.discoveredFrom || "",
      catalogueImageUrl: coalesceCatalogueImageUrl(
        target.catalogueImageUrl,
        cached?.catalogueImageUrl,
      ),
      siteOrder: target.siteOrder ?? null,
      fromSite: true,
      fromCache: Boolean(cached),
      itemCount: cached?.itemCount ?? null,
      barcodeCount: cached?.barcodeCount ?? null,
      exportedAt: cached?.exportedAt ?? null,
      catalogueStartDate,
      catalogueEndDate,
      promotionStartDate: cached?.promotionStartDate ?? provisional?.promotionStartDate ?? null,
      promotionEndDate,
      expired: getCatalogueTimingStatus(null, effectiveEndDate) === "expired",
      csvUri: cached?.csvUri || "",
      dumpUri: cached?.dumpUri || "",
      pullSource: target.sourceUrl || target.query || target.slug || target.label,
    });
  }

  for (const cached of cachedCatalogues) {
    if (usedIds.has(cached.catalogueId)) {
      continue;
    }

    const effectiveEndDate = cached.promotionEndDate ?? cached.catalogueEndDate;

    merged.push({
      catalogueId: cached.catalogueId,
      storeCode: cached.storeCode,
      label: cached.label,
      slug: cached.slug,
      query: cached.query,
      sourceUrl: cached.sourceUrl,
      discoveredFrom: cached.discoveredFrom,
      catalogueImageUrl: cached.catalogueImageUrl,
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
      expired: getCatalogueTimingStatus(null, effectiveEndDate) === "expired",
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
