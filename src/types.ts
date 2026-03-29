export type PromotionWindow = {
  text: string;
  startDate: number | null;
  endDate: number | null;
};

export type ExportFieldKey =
  | "position"
  | "catalogueLabel"
  | "catalogueSlug"
  | "catalogueStartDate"
  | "catalogueEndDate"
  | "name"
  | "productCode"
  | "baseProduct"
  | "barcode"
  | "price"
  | "promotion"
  | "promotionStartDate"
  | "promotionEndDate"
  | "promotionRanges"
  | "productUrl"
  | "barcodeFound"
  | "error";

export type ExportFieldOption = {
  key: ExportFieldKey;
  label: string;
  description: string;
};

export const EXPORT_FIELD_OPTIONS: ExportFieldOption[] = [
  {
    key: "position",
    label: "Position",
    description: "Catalogue order for the item.",
  },
  {
    key: "catalogueLabel",
    label: "Catalogue label",
    description: "Human-readable catalogue name.",
  },
  {
    key: "catalogueSlug",
    label: "Catalogue slug",
    description: "Slug or category code for the catalogue.",
  },
  {
    key: "catalogueStartDate",
    label: "Catalogue start date",
    description: "Earliest promotion start found in the dump.",
  },
  {
    key: "catalogueEndDate",
    label: "Catalogue end date",
    description: "Latest promotion end found in the dump.",
  },
  {
    key: "name",
    label: "Product name",
    description: "Resolved product name from the listing.",
  },
  {
    key: "productCode",
    label: "Product code",
    description: "Pick n Pay product code.",
  },
  {
    key: "baseProduct",
    label: "Base product",
    description: "Base product code from product detail.",
  },
  {
    key: "barcode",
    label: "Barcode",
    description: "Resolved unit barcode.",
  },
  {
    key: "price",
    label: "Price",
    description: "Formatted price from the listing or detail view.",
  },
  {
    key: "promotion",
    label: "Promotion text",
    description: "Joined promotion messages.",
  },
  {
    key: "promotionStartDate",
    label: "Promotion start",
    description: "Earliest promotion start for the item.",
  },
  {
    key: "promotionEndDate",
    label: "Promotion end",
    description: "Latest promotion end for the item.",
  },
  {
    key: "promotionRanges",
    label: "Promotion ranges",
    description: "All promotion windows for the item.",
  },
  {
    key: "productUrl",
    label: "Product URL",
    description: "PnP product page URL.",
  },
  {
    key: "barcodeFound",
    label: "Barcode found",
    description: "Yes or no flag for barcode resolution.",
  },
  {
    key: "error",
    label: "Error",
    description: "Lookup error captured while resolving the item.",
  },
];

export const DEFAULT_EXPORT_FIELDS: ExportFieldKey[] = [
  "position",
  "catalogueLabel",
  "catalogueStartDate",
  "catalogueEndDate",
  "name",
  "baseProduct",
  "barcode",
  "price",
  "promotion",
  "productUrl",
];

export type CatalogueTarget = {
  slug?: string | null;
  query: string;
  label: string;
  sourceUrl?: string;
  discoveredFrom?: string;
  siteOrder?: number | null;
  catalogueStartDate?: number | null;
  catalogueEndDate?: number | null;
  // Semantics:
  // - undefined: keep any existing/cached thumbnail
  // - string: set/override to this URL
  // - null: explicitly clear any existing/cached thumbnail
  catalogueImageUrl?: string | null;
};

export type ProductDetail = {
  code: string;
  baseProduct: string;
  barcode: string;
  name: string;
  url: string;
  price: string;
  cachedAt: number;
  error?: string;
};

export type ProductRow = {
  position: number;
  catalogueSlug: string;
  name: string;
  productCode: string;
  baseProduct: string;
  barcode: string;
  price: string;
  promotion: string;
  promotionStartDate: number | null;
  promotionEndDate: number | null;
  promotionRanges: string;
  promotions: PromotionWindow[];
  productUrl: string;
  barcodeFound: boolean;
  error: string;
};

export type CatalogueDump = {
  catalogueId: string;
  storeCode: string;
  label: string;
  slug: string;
  query: string;
  sourceUrl: string;
  discoveredFrom: string;
  exportedAt: number;
  itemCount: number;
  barcodeCount: number;
  catalogueStartDate: number | null;
  catalogueEndDate: number | null;
  expired: boolean;
  csvUri: string;
  rows: ProductRow[];
};

export type ManifestEntry = {
  catalogueId: string;
  storeCode: string;
  label: string;
  slug: string;
  query: string;
  itemCount: number;
  barcodeCount: number;
  productCodes: string[];
  exportedAt: number;
  sourceUrl: string;
  discoveredFrom: string;
  catalogueImageUrl: string | null;
  catalogueStartDate: number | null;
  catalogueEndDate: number | null;
  promotionStartDate: number | null;
  promotionEndDate: number | null;
  expired: boolean;
  csvUri: string;
  dumpUri: string;
};

export type CatalogueListing = {
  catalogueId: string;
  storeCode: string;
  label: string;
  slug: string;
  query: string;
  sourceUrl: string;
  discoveredFrom: string;
  catalogueImageUrl: string | null;
  siteOrder: number | null;
  fromSite: boolean;
  fromCache: boolean;
  itemCount: number | null;
  barcodeCount: number | null;
  exportedAt: number | null;
  catalogueStartDate: number | null;
  catalogueEndDate: number | null;
  promotionStartDate: number | null;
  promotionEndDate: number | null;
  expired: boolean;
  csvUri: string;
  dumpUri: string;
};

export type ProductCache = {
  version: number;
  items: Record<string, ProductDetail>;
};

export type ManifestCache = {
  version: number;
  catalogues: Record<string, ManifestEntry>;
};

export type AppSettings = {
  storeCode: string;
  hideExpiredCatalogues: boolean;
  exportFields: ExportFieldKey[];
};

export type SyncItemResult = {
  catalogueId: string;
  catalogueSlug: string;
  catalogueStartDate: number | null;
  catalogueEndDate: number | null;
  status: "exported" | "skipped" | "failed";
  itemCount: number;
  barcodesFound: number;
  missingBarcodes: number;
  sourceUrl: string;
  discoveredFrom: string;
  promotionStartDate: number | null;
  promotionEndDate: number | null;
  expired: boolean;
  message?: string;
};

export type SyncSummary = {
  results: SyncItemResult[];
  exportedCount: number;
  skippedCount: number;
  failedCount: number;
};
