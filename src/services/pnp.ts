import { parse } from "node-html-parser";
import he from "he";
import {
  fileExists,
  loadDumpByUri,
  loadManifestCache,
  loadProductCache,
  saveDump,
  saveManifestCache,
  saveProductCache,
} from "./catalogueStore";
import { coalesceCatalogueImageUrl } from "../utils/catalogueImageUrl";
import {
  formatDateYyyyMmDd,
  parseDateTimestamp,
} from "../utils/dateUtils";
import type {
  CatalogueDump,
  CatalogueTarget,
  ProductDetail,
  ProductRow,
  PromotionWindow,
  SyncItemResult,
  SyncSummary,
} from "../types";


const BASE_URL = "https://www.pnp.co.za";
const SEARCH_ENDPOINT = `${BASE_URL}/pnphybris/v2/pnp-spa/products/search`;
const DETAIL_ENDPOINT = `${BASE_URL}/pnphybris/v2/pnp-spa/products`;
const CMS_PAGE_ENDPOINT = `${BASE_URL}/pnphybris/v2/pnp-spa/cms/pages`;
const SEARCH_FIELDS =
  "products(code,name,price(FULL),potentialPromotions(FULL),url),pagination(DEFAULT),currentQuery";
const PROBE_SEARCH_FIELDS =
  "products(potentialPromotions(FULL)),pagination(DEFAULT)";
const DETAIL_FIELDS =
  "code,baseProduct,name,url,price(FULL),productDetailsDisplayInfoResponse,classifications";
const DEFAULT_HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
  "user-agent": "catalogue-helper-mobile/0.1",
};

const START_DATE_KEYS = [
  "start",
  "startdate",
  "validfrom",
  "fromdate",
  "from",
  "effectivestart",
  "promotionstart",
  "displayfrom",
];

const END_DATE_KEYS = [
  "end",
  "enddate",
  "validto",
  "todate",
  "to",
  "effectiveend",
  "promotionend",
  "expiry",
  "expiration",
  "expire",
  "displayto",
];

type SearchProduct = {
  code: string;
  name: string;
  price: string;
  url: string;
  promotion: string;
  promotionStartDate: number | null;
  promotionEndDate: number | null;
  promotionRanges: string;
  promotions: PromotionWindow[];
};

type ExportOutcome = {
  result: SyncItemResult;
  dump: CatalogueDump | null;
};

type FractionalProgress = (progress: number) => void;
type CountProgress = (current: number, total: number) => void;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "Unknown error");
}

function encodeParams(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

async function requestJson(
  url: string,
  init: RequestInit,
  retries = 3,
  timeoutMs = 10_000,
): Promise<any> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...DEFAULT_HEADERS,
          ...(init.headers ?? {}),
        },
      });
      const raw = await response.text();
      const payload = raw ? JSON.parse(raw) : {};

      if (!response.ok) {
        throw new Error(
          payload?.errors?.[0]?.message ||
          payload?.errors?.[0]?.code ||
          `${response.status} ${response.statusText}`.trim(),
        );
      }

      if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
        throw new Error(
          payload.errors
            .map((item: any) => item?.message || item?.code || "API error")
            .join("; "),
        );
      }

      return payload;
    } catch (error) {
      lastError = error;
      // Don't retry on explicit abort (e.g., user cancellation via external signal)
      // But do retry on timeout-triggered aborts
      if (
        error instanceof Error &&
        error.name === 'AbortError' &&
        init.signal?.aborted
      ) {
        throw error;
      }
      if (attempt < retries) {
        await sleep(500 * attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Request failed for ${url}: ${errorMessage(lastError)}`);
}

function buildCategoryQuery(slug: string): string {
  return `:relevance:allCategories:${slug}:isOnPromotion:On Promotion`;
}

function extractSlugFromPath(path: string): string | null {
  const match = path.match(/\/c\/([^/?#]+)/i);
  return match ? sanitizeLabel(match[1]) : null;
}

function extractSlugFromQuery(query: string): string | null {
  const parts = query.split(":").filter(Boolean);
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] === "allCategories") {
      return sanitizeLabel(parts[index + 1]);
    }
  }
  return null;
}

function decodeUrlValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeLabel(value: string): string {
  let cleaned = decodeUrlValue(value).trim();
  cleaned = cleaned.split("?")[0]?.split("#")[0] ?? cleaned;
  cleaned = cleaned.replace(/^\/+|\/+$/g, "");
  if (cleaned.includes("/c/")) {
    cleaned = cleaned.split("/c/").pop() ?? cleaned;
  }
  return cleaned
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function parseCatalogueTarget(source: string): CatalogueTarget {
  const value = source.trim();
  if (!value) {
    throw new Error("A Shop now URL or catalogue slug is required.");
  }

  if (value.startsWith(":")) {
    const slug = extractSlugFromQuery(value);
    return {
      slug,
      query: value,
      label: slug || "catalogue-specials",
    };
  }

  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    const query = url.searchParams.get("query");
    const slug = extractSlugFromPath(url.pathname) || extractSlugFromQuery(query || "");
    if (!query && !slug) {
      throw new Error("Could not find a category slug or query in that URL.");
    }
    return {
      slug,
      query: query || buildCategoryQuery(slug || "catalogue-specials"),
      label: slug || "catalogue-specials",
      sourceUrl: value,
    };
  }

  const pathSlug = extractSlugFromPath(value);
  if (pathSlug) {
    return {
      slug: pathSlug,
      query: buildCategoryQuery(pathSlug),
      label: pathSlug,
    };
  }

  const slug = sanitizeLabel(value);
  if (!slug) {
    throw new Error("Could not understand that source.");
  }
  return {
    slug,
    query: buildCategoryQuery(slug),
    label: slug,
  };
}

export function catalogueIdForTarget(
  storeCode: string,
  target: Pick<CatalogueTarget, "slug" | "label">,
): string {
  return `${storeCode}:${target.slug || target.label}`;
}

function buildSearchUrl(
  target: CatalogueTarget,
  page: number,
  storeCode: string,
  overrides?: { fields?: string; pageSize?: string },
): string {
  return `${SEARCH_ENDPOINT}?${encodeParams({
    fields: overrides?.fields ?? SEARCH_FIELDS,
    query: target.query,
    pageSize: overrides?.pageSize ?? "72",
    currentPage: String(page),
    storeCode,
    lang: "en",
    curr: "ZAR",
  })}`;
}

function buildDetailUrl(code: string, storeCode: string): string {
  return `${DETAIL_ENDPOINT}/${encodeURIComponent(code)}?${encodeParams({
    fields: DETAIL_FIELDS,
    storeCode,
    lang: "en",
    curr: "ZAR",
  })}`;
}

function buildCmsPageUrl(labelOrId: string): string {
  return `${CMS_PAGE_ENDPOINT}?${encodeParams({
    pageType: "ContentPage",
    pageLabelOrId: labelOrId,
    lang: "en",
    curr: "ZAR",
    labelOrId,
  })}`;
}

/**
 * Ensure a URL is absolute by prefixing the application's base URL to relative paths.
 *
 * @param value - The URL or path to convert into an absolute URL
 * @returns The absolute URL. If `value` already begins with `http://` or `https://` it is returned unchanged; if `value` is falsy an empty string is returned; otherwise `BASE_URL` is prepended to `value`.
 */
function absolutizeUrl(value: string): string {
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `${BASE_URL}${value}`;
}

/**
 * Decode HTML entities in a string.
 *
 * @param value - The string containing HTML-encoded entities
 * @returns The input string with HTML entities replaced by their corresponding characters
 */
function decodeHtml(value: string): string {
  return he.decode(value);
}

/**
 * Parse decoded HTML into usable entities
 * 
 * @param content - HTML string to parse
 * @returns HTML entities
 */
function parseCmsContent(content: string) {
  return parse(decodeHtml(content));
}

/**
 * Extracts all href attribute values from anchor tags in an HTML string.
 *
 * The input is HTML (possibly containing encoded entities); entities are decoded before parsing.
 *
 * @param content - HTML string to search for anchor tags
 * @returns An array of href attribute values found in `content` in document order
 */
function extractLinksFromHtml(content: string): string[] {
  const root = parseCmsContent(content);
  return root.querySelectorAll("a[href]").map((el) => el.getAttribute("href")!);
}

/**
 * Extracts the trimmed text of the first <h2> element from an HTML string.
 *
 * @param content - HTML content (may contain encoded entities) to parse
 * @returns The trimmed text of the first `h2` element, or `null` if no `h2` is found
 */
function extractTitle(content: string): string | null {
  const root = parseCmsContent(content);
  return root.querySelector("h2")?.textContent?.trim() ?? null;
}

const VALIDITY_MONTH_KEYS = [
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
];

function getValidityMonthIndex(value: string): number | null {
  const key = value.trim().slice(0, 3).toLowerCase();
  const index = VALIDITY_MONTH_KEYS.indexOf(key);
  return index === -1 ? null : index;
}

function inferValidityStartYear(
  explicitStartYear: string | undefined,
  startMonth: string,
  endMonth: string,
  endYear: string,
): string {
  if (explicitStartYear) {
    return explicitStartYear;
  }

  const endYearNumber = Number(endYear);
  const startMonthIndex = getValidityMonthIndex(startMonth);
  const endMonthIndex = getValidityMonthIndex(endMonth);

  if (
    Number.isFinite(endYearNumber) &&
    startMonthIndex != null &&
    endMonthIndex != null &&
    startMonthIndex > endMonthIndex
  ) {
    return String(endYearNumber - 1);
  }

  return endYear;
}

/**
 * Extracts catalogue validity start and end dates from CMS component HTML content.
 *
* @param content - HTML string of a CMS component (may contain HTML entities)
* @returns The extracted `validityStartDate` and `validityEndDate` as `D Month YYYY` strings, or `null` when not present. If the source range omits the start year, it is inferred from the end year and the start/end month boundary.
 */
export function extractValidityDates(content: string): { validityStartDate: string | null; validityEndDate: string | null } {
  const root = parseCmsContent(content);

  const el = root.querySelector("p.cat-validity-date");
  const text = el?.innerText?.trim() ?? "";

  const regex = /Valid (\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/;
  const match = text.match(regex);

  if (match) {
    const inferredStartYear = inferValidityStartYear(
      match[3],
      match[2],
      match[5],
      match[6],
    );

    return {
      validityStartDate: `${match[1]} ${match[2]} ${inferredStartYear}`,
      validityEndDate: `${match[4]} ${match[5]} ${match[6]}`,
    };
  }

  return { validityStartDate: null, validityEndDate: null };
}

function componentContainsShopLink(component: any): boolean {
  const linkName = String(component?.linkName ?? "").trim().toLowerCase();
  const showOnPromotion = String(component?.showOnPromotionOnly ?? "")
    .trim()
    .toLowerCase();
  return linkName === "shop now" || showOnPromotion === "true";
}

function extractCatalogueTargetsFromCms(payload: any): CatalogueTarget[] {
  const discovered = new Map<string, CatalogueTarget>();

  function normalizeCatalogueImageUrl(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }

    if (trimmed.startsWith("/")) {
      return absolutizeUrl(trimmed);
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // Only accept http(s) and site-relative URLs for thumbnail images. Anything else is treated as
    // missing so cached values can be preserved.
    return undefined;
  }
  const slots = payload?.contentSlots?.contentSlot ?? [];

  for (const slot of slots) {
    const components = slot?.components?.component ?? [];
    for (const component of components) {
      if (!component || typeof component !== "object") {
        continue;
      }

      /*
      <component>
        <uid>comp_0000ILRP</uid>
        <uuid>eyJpdGVtSWQiOiJjb21wXzAwMDBJTFJQIiwiY2F0YWxvZ0lkIjoicG5wLXNwYUNvbnRlbnRDYXRhbG9nIiwiY2F0YWxvZ1ZlcnNpb24iOiJPbmxpbmUifQ==</uuid>
        <typeCode>BannerComponent</typeCode>
        <modifiedtime>2026-03-25T15:42:34.956+02:00</modifiedtime>
        <name>wk4_weekly_26-29Mar26</name>
        <container>false</container>
        <external>false</external>
        <styleClassOverride>catalog_left featured </styleClassOverride>
        <media>
          <code>BLGTHS28008-Weekend Winners_A4.jpg</code>
          <mime>image/jpeg</mime>
          <altText>BLGTHS28008-Weekend Winners_A4.jpg</altText>
          <url>https://cdn-prd-02.pnp.co.za/sys-master/images/h74/h3d/46679214194718/BLGTHS28008-Weekend%20Winners_A4.jpg</url>
        </media>
        <rendersHtml>false</rendersHtml>
        <clientSideOnlyOneRestrictionMustApply>true</clientSideOnlyOneRestrictionMustApply>
        <content><h2>Pick n Pay Weekend Specials</h2> <p class="cat-validity-date">Valid 26 March - 29 March 2026</p> <p>Don’t miss out! View your specials before they’re gone</p> <div class="pdfdownload"> <button class="btn" small="" secondary=""> <a href="https://www.pnp.co.za/c/weekend-winners-deals042026?query=:relevance:allCategories:weekend-winners-deals042026:isOnPromotion:On%20Promotion" target="_blank">Shop now</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/b75e9d0425.html" target="_blank">Gauteng</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/b75e9d0425.html" target="_blank">Limpopo</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/b75e9d0425.html" target="_blank">Northern Cape</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/b75e9d0425.html" target="_blank">Mpumalanga</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/b75e9d0425.html" target="_blank">North West</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/c6866813ab.html" target="_blank">Free State</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/9846393b38.html" target="_blank">Eastern Cape</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/8727a62fd9.html" target="_blank">Western Cape</a> </button> <button class="btn" small="" secondary=""> <a href="https://pnpcatalogues.hflip.co/0c10a2a4c6.html" target="_blank">KwaZulu-Natal</a> </button> </div></content>
        <target>false</target>
      </component>
      */
      const componentName =
        component.name ||
        component.title ||
        component.uid ||
        component.typeCode ||
        "cms-component";
      const candidates = new Set<string>();

      for (const key of ["linkUrl", "url", "href"]) {
        const value = component[key];
        if (typeof value === "string" && value.trim()) {
          candidates.add(decodeHtml(value.trim()));
        }
      }

      if (typeof component.content === "string") {
        for (const link of extractLinksFromHtml(component.content)) {
          candidates.add(link);
        }
      }

      const allowNonPromoQuery = componentContainsShopLink(component);

      for (const candidate of candidates) {
        if (!candidate.includes("/c/") && !candidate.startsWith(":")) {
          continue;
        }

        try {
          const target = parseCatalogueTarget(
            candidate.startsWith("/") ? absolutizeUrl(candidate) : candidate,
          );
          if (!target.query.includes(":allCategories:")) {
            continue;
          }
          if (!target.query.includes("isOnPromotion") && !allowNonPromoQuery) {
            continue;
          }

          const content = typeof component.content === "string" ? component.content : "";
          const title = content ? extractTitle(content) : null;
          const validityDates = content
            ? extractValidityDates(content)
            : { validityStartDate: null, validityEndDate: null };

          const catalogueStartDate = parseDateTimestamp(validityDates.validityStartDate);
          const catalogueEndDate = parseDateTimestamp(validityDates.validityEndDate, { endOfDay: true });

          if (title) {
            target.label = title
          }
          const key = target.slug || target.label;
          if (!discovered.has(key)) {
            discovered.set(key, {
              ...target,
              sourceUrl: candidate.startsWith("/")
                ? absolutizeUrl(candidate)
                : target.sourceUrl || candidate,
              discoveredFrom: String(componentName),
              siteOrder: discovered.size,
              catalogueImageUrl: normalizeCatalogueImageUrl(component.media?.url),
              catalogueStartDate,
              catalogueEndDate,
            });
          }
        } catch {
          // Ignore malformed links.
        }
      }
    }
  }

  return Array.from(discovered.values()).sort((left, right) => {
    return (left.siteOrder ?? Number.MAX_SAFE_INTEGER) - (right.siteOrder ?? Number.MAX_SAFE_INTEGER);
  });
}

function normalizeDateCandidate(
  value: unknown,
  options?: { endOfDay?: boolean },
): number | null {
  return parseDateTimestamp(value, options);
}

function keyPathMatches(path: string[], patterns: string[]): boolean {
  const joined = path.join(".");
  return patterns.some((pattern) => joined.includes(pattern));
}

function collectPromotionDates(
  value: unknown,
  collector: { starts: Set<number>; ends: Set<number> },
  path: string[] = [],
  depth = 0,
  seen = new Set<object>(),
): void {
  if (value == null || depth > 6) {
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPromotionDates(item, collector, path, depth + 1, seen);
    }
    return;
  }

  for (const [rawKey, entry] of Object.entries(value)) {
    const key = rawKey.toLowerCase().replace(/[^a-z0-9]/g, "");
    const nextPath = [...path, key];

    if (
      entry != null &&
      (typeof entry === "string" || typeof entry === "number") &&
      keyPathMatches(nextPath, START_DATE_KEYS)
    ) {
      const normalized = normalizeDateCandidate(entry);
      if (normalized != null) {
        collector.starts.add(normalized);
      }
    }

    if (
      entry != null &&
      (typeof entry === "string" || typeof entry === "number") &&
      keyPathMatches(nextPath, END_DATE_KEYS)
    ) {
      const normalized = normalizeDateCandidate(entry, { endOfDay: true });
      if (normalized != null) {
        collector.ends.add(normalized);
      }
    }

    collectPromotionDates(entry, collector, nextPath, depth + 1, seen);
  }
}

function pickEarliest(values: Iterable<number>): number | null {
  const dated = Array.from(new Set(values))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);

  return dated[0] ?? null;
}

function pickLatest(values: Iterable<number>): number | null {
  const dated = Array.from(new Set(values))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => right - left);

  return dated[0] ?? null;
}

function extractPromotionTextValue(promotion: any): string {
  return String(
    promotion?.promotionTextMessage ||
    promotion?.description ||
    promotion?.name ||
    promotion?.title ||
    "",
  ).trim();
}

function buildPromotionRangeText(promotion: PromotionWindow): string {
  const start = formatDateYyyyMmDd(promotion.startDate);
  const end = formatDateYyyyMmDd(promotion.endDate);
  const text = promotion.text ?? "";

  if (start && end && text) {
    return `${start} -> ${end} [${text}]`;
  }
  if (start && end) {
    return `${start} -> ${end}`;
  }
  if (start && text) {
    return `Starts ${start} [${text}]`;
  }
  if (end && text) {
    return `Ends ${end} [${text}]`;
  }
  if (text) {
    return text;
  }
  if (start) {
    return `Starts ${start}`;
  }
  if (end) {
    return `Ends ${end}`;
  }
  return "";
}

function buildPromotionRangesText(promotions: PromotionWindow[]): string {
  return Array.from(
    new Set(
      promotions.map((promotion) => buildPromotionRangeText(promotion)).filter(Boolean),
    ),
  ).join(" | ");
}

function extractPromotions(product: any): PromotionWindow[] {
  const rawPromotions = Array.isArray(product?.potentialPromotions)
    ? product.potentialPromotions
    : [];
  const collected = new Map<string, PromotionWindow>();

  rawPromotions.forEach((promotion: any, index: number) => {
    const collector = {
      starts: new Set<number>(),
      ends: new Set<number>(),
    };
    collectPromotionDates(promotion, collector);

    const text = extractPromotionTextValue(promotion);
    const normalized: PromotionWindow = {
      text: text || ((collector.starts.size > 0 || collector.ends.size > 0) ? `Promotion ${index + 1}` : ""),
      startDate: pickEarliest(collector.starts),
      endDate: pickLatest(collector.ends),
    };

    if (!normalized.text && !normalized.startDate && !normalized.endDate) {
      return;
    }

    const key = [
      normalized.text,
      String(normalized.startDate ?? ""),
      String(normalized.endDate ?? ""),
    ].join("|");

    if (!collected.has(key)) {
      collected.set(key, normalized);
    }
  });

  return Array.from(collected.values());
}

function extractPromotionText(promotions: PromotionWindow[]): string {
  return Array.from(
    new Set(promotions.map((promotion) => promotion.text).filter(Boolean)),
  ).join(" | ");
}

function derivePromotionWindow(promotions: PromotionWindow[]): {
  promotionStartDate: number | null;
  promotionEndDate: number | null;
} {
  return {
    promotionStartDate: pickEarliest(
      promotions.map((promotion) => promotion.startDate).filter((value): value is number => value != null),
    ),
    promotionEndDate: pickLatest(
      promotions.map((promotion) => promotion.endDate).filter((value): value is number => value != null),
    ),
  };
}

function isExpired(endTimestamp: number | null): boolean {
  return endTimestamp != null && endTimestamp < Date.now();
}

async function fetchProducts(
  target: CatalogueTarget,
  storeCode: string,
  onProgress?: CountProgress,
): Promise<SearchProduct[]> {
  const firstPage = await requestJson(buildSearchUrl(target, 0, storeCode), {
    method: "POST",
    body: "{}",
  });

  const totalPages = Number(firstPage?.pagination?.totalPages ?? 1);
  onProgress?.(1, totalPages);
  const products = [
    ...(Array.isArray(firstPage?.products) ? firstPage.products : []),
  ];

  for (let page = 1; page < totalPages; page += 1) {
    const payload = await requestJson(buildSearchUrl(target, page, storeCode), {
      method: "POST",
      body: "{}",
    });
    if (Array.isArray(payload?.products)) {
      products.push(...payload.products);
    }
    onProgress?.(page + 1, totalPages);
  }

  const deduped = new Map<string, SearchProduct>();
  for (const product of products) {
    const code = String(product?.code ?? "").trim();
    if (!code || deduped.has(code)) {
      continue;
    }

    const promotions = extractPromotions(product);
    const { promotionStartDate, promotionEndDate } = derivePromotionWindow(promotions);

    deduped.set(code, {
      code,
      name: String(product?.name ?? ""),
      price:
        String(product?.price?.formattedValue ?? "").trim() ||
        String(product?.price?.value ?? "").trim(),
      url: absolutizeUrl(String(product?.url ?? "")),
      promotion: extractPromotionText(promotions),
      promotionStartDate,
      promotionEndDate,
      promotionRanges: buildPromotionRangesText(promotions),
      promotions,
    });
  }

  return Array.from(deduped.values());
}

function extractFirstValue(items: any[]): string {
  for (const item of items) {
    const value = String(item?.value ?? "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function extractBarcode(payload: any): string {
  const sections =
    payload?.productDetailsDisplayInfoResponse?.productDetailDisplayInfos ?? [];
  for (const section of sections) {
    const fields = section?.displayInfoFields ?? [];
    for (const field of fields) {
      const name = String(field?.name ?? "").trim().toLowerCase();
      if (name !== "barcode") {
        continue;
      }
      const value = extractFirstValue(Array.isArray(field?.values) ? field.values : []);
      if (value) {
        return value;
      }
    }
  }

  const classifications = payload?.classifications ?? [];
  for (const classification of classifications) {
    const features = classification?.features ?? [];
    for (const feature of features) {
      const name = String(feature?.name ?? "").trim().toLowerCase();
      const code = String(feature?.code ?? "").trim().toLowerCase();
      if (name === "unit_barcode" || code.endsWith("/unit_barcode")) {
        const value = extractFirstValue(
          Array.isArray(feature?.featureValues) ? feature.featureValues : [],
        );
        if (value) {
          return value;
        }
      }
    }
  }

  return "";
}

function extractPrice(payload: any): string {
  if (payload?.price?.formattedValue) {
    return String(payload.price.formattedValue);
  }
  if (payload?.price?.value != null) {
    return String(payload.price.value);
  }
  return "";
}

async function fetchProductDetail(
  code: string,
  storeCode: string,
): Promise<ProductDetail> {
  const payload = await requestJson(buildDetailUrl(code, storeCode), {
    method: "GET",
  });
  return {
    code: String(payload?.code ?? code),
    baseProduct: String(payload?.baseProduct ?? ""),
    barcode: extractBarcode(payload),
    name: String(payload?.name ?? ""),
    url: absolutizeUrl(String(payload?.url ?? "")),
    price: extractPrice(payload),
    cachedAt: Date.now(),
  };
}

function productCacheKey(storeCode: string, code: string): string {
  return `${storeCode}:${code}`;
}

function arrayEquals(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

async function fetchProductDetails(
  products: SearchProduct[],
  storeCode: string,
  forceRefresh: boolean,
  onProgress?: CountProgress,
): Promise<Record<string, ProductDetail>> {
  const cache = await loadProductCache();
  const details: Record<string, ProductDetail> = {};
  const pendingCodes: string[] = [];

  for (const product of products) {
    const key = productCacheKey(storeCode, product.code);
    const cached = cache.items[key];
    if (cached && !forceRefresh) {
      details[product.code] = cached;
    } else {
      pendingCodes.push(product.code);
    }
  }

  const totalBatches = Math.max(1, Math.ceil(pendingCodes.length / 8));
  onProgress?.(0, totalBatches);

  let completedBatches = 0;
  for (let index = 0; index < pendingCodes.length; index += 8) {
    const batch = pendingCodes.slice(index, index + 8);
    const batchResults = await Promise.all(
      batch.map(async (code) => {
        try {
          const detail = await fetchProductDetail(code, storeCode);
          cache.items[productCacheKey(storeCode, code)] = detail;
          return detail;
        } catch (error) {
          return {
            code,
            baseProduct: "",
            barcode: "",
            name: "",
            url: "",
            price: "",
            cachedAt: Date.now(),
            error: errorMessage(error),
          } satisfies ProductDetail;
        }
      }),
    );

    for (const detail of batchResults) {
      details[detail.code] = detail;
    }

    completedBatches += 1;
    onProgress?.(completedBatches, totalBatches);
  }

  if (pendingCodes.length === 0) {
    onProgress?.(totalBatches, totalBatches);
  }

  await saveProductCache(cache);
  return details;
}

function buildRows(
  target: CatalogueTarget,
  products: SearchProduct[],
  details: Record<string, ProductDetail>,
): ProductRow[] {
  return products.map((product, index) => {
    const detail = details[product.code];
    return {
      position: index + 1,
      catalogueSlug: target.slug || "",
      name: product.name || detail?.name || "",
      productCode: product.code,
      baseProduct: detail?.baseProduct || "",
      barcode: detail?.barcode || "",
      price: product.price || detail?.price || "",
      promotion: product.promotion,
      promotionStartDate: product.promotionStartDate,
      promotionEndDate: product.promotionEndDate,
      promotionRanges: product.promotionRanges,
      promotions: product.promotions,
      productUrl: product.url || detail?.url || "",
      barcodeFound: Boolean(detail?.barcode),
      error: detail?.error || "",
    };
  });
}

function deriveDumpWindow(rows: ProductRow[]): {
  promotionStartDate: number | null;
  promotionEndDate: number | null;
} {
  return {
    promotionStartDate: pickEarliest(
      rows.map((row) => row.promotionStartDate).filter((value): value is number => value != null),
    ),
    promotionEndDate: pickLatest(
      rows.map((row) => row.promotionEndDate).filter((value): value is number => value != null),
    ),
  };
}

function coalesceNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

async function exportTarget(
  target: CatalogueTarget,
  storeCode: string,
  forceRefresh: boolean,
  includeDump: boolean,
  onProgress?: FractionalProgress,
): Promise<ExportOutcome> {
  const manifest = await loadManifestCache();
  const key = catalogueIdForTarget(storeCode, target);
  const existingEntry = manifest.catalogues[key];

  const slugLike = coalesceNonEmpty(target.slug, existingEntry?.slug);
  const slug = coalesceNonEmpty(slugLike, target.label) ?? target.label;
  let label = target.label;
  if (
    existingEntry &&
    slugLike &&
    target.label === slugLike &&
    existingEntry.label &&
    existingEntry.label !== existingEntry.slug
  ) {
    label = existingEntry.label;
  }
  const sourceUrl = coalesceNonEmpty(target.sourceUrl, existingEntry?.sourceUrl) ?? "";
  const discoveredFrom = coalesceNonEmpty(target.discoveredFrom, existingEntry?.discoveredFrom) ?? "";
  const catalogueStartDate = target.catalogueStartDate ?? existingEntry?.catalogueStartDate ?? null;
  const catalogueEndDate = target.catalogueEndDate ?? existingEntry?.catalogueEndDate ?? null;
  const catalogueImageUrl = coalesceCatalogueImageUrl(
    target.catalogueImageUrl,
    existingEntry?.catalogueImageUrl,
  );

  onProgress?.(0);

  const productsPhaseWeight = 0.2;
  const detailsPhaseWeight = 0.75;

  const products = await fetchProducts(target, storeCode, (current, total) => {
    const ratio = total > 0 ? current / total : 1;
    onProgress?.(productsPhaseWeight * ratio);
  });
  const productCodes = products.map((product) => product.code);

  if (
    !forceRefresh &&
    existingEntry &&
    existingEntry.query === target.query &&
    arrayEquals(existingEntry.productCodes, productCodes) &&
    (await fileExists(existingEntry.csvUri)) &&
    (await fileExists(existingEntry.dumpUri))
  ) {
    onProgress?.(1);
    return {
      result: {
        catalogueId: key,
        catalogueSlug: target.slug || target.label,
        status: "skipped",
        itemCount: existingEntry.itemCount,
        barcodesFound: existingEntry.barcodeCount,
        missingBarcodes: Math.max(0, existingEntry.itemCount - existingEntry.barcodeCount),
        sourceUrl: existingEntry.sourceUrl,
        discoveredFrom: existingEntry.discoveredFrom,
        catalogueStartDate: existingEntry.catalogueStartDate,
        catalogueEndDate: existingEntry.catalogueEndDate,
        promotionStartDate: existingEntry.promotionStartDate,
        promotionEndDate: existingEntry.promotionEndDate,
        expired: existingEntry.expired,
      },
      dump: includeDump ? await loadDumpByUri(existingEntry.dumpUri) : null,
    };
  }

  const details = await fetchProductDetails(
    products,
    storeCode,
    forceRefresh,
    (current, total) => {
      const ratio = total > 0 ? current / total : 1;
      onProgress?.(productsPhaseWeight + detailsPhaseWeight * ratio);
    },
  );
  const rows = buildRows(target, products, details);
  const barcodeCount = rows.filter((row) => row.barcodeFound).length;
  const { promotionStartDate, promotionEndDate } = deriveDumpWindow(rows);
  const dumpStartDate =
    promotionStartDate ?? catalogueStartDate ?? existingEntry?.promotionStartDate ?? null;
  const dumpEndDate =
    promotionEndDate ?? catalogueEndDate ?? existingEntry?.promotionEndDate ?? null;
  const expired = isExpired(dumpEndDate);

  const baseDump: CatalogueDump = {
    catalogueId: key,
    storeCode,
    label,
    slug,
    query: target.query,
    sourceUrl,
    discoveredFrom,
    exportedAt: Date.now(),
    itemCount: rows.length,
    barcodeCount,
    catalogueStartDate: dumpStartDate,
    catalogueEndDate: dumpEndDate,
    expired,
    csvUri: "",
    rows,
  };

  const persisted = await saveDump(baseDump);
  manifest.catalogues[key] = {
    catalogueId: key,
    storeCode,
    label,
    slug,
    query: target.query,
    itemCount: rows.length,
    barcodeCount,
    productCodes,
    exportedAt: persisted.dump.exportedAt,
    sourceUrl,
    discoveredFrom,
    catalogueImageUrl,
    catalogueStartDate,
    catalogueEndDate,
    promotionStartDate: dumpStartDate,
    promotionEndDate: dumpEndDate,
    expired,
    csvUri: persisted.csvUri,
    dumpUri: persisted.dumpUri,
  };
  await saveManifestCache(manifest);
  onProgress?.(1);

  return {
    result: {
      catalogueId: key,
      catalogueSlug: target.slug || target.label,
      status: "exported",
      itemCount: rows.length,
      barcodesFound: barcodeCount,
      missingBarcodes: rows.length - barcodeCount,
      sourceUrl,
      discoveredFrom,
      catalogueStartDate,
      catalogueEndDate,
      promotionStartDate: dumpStartDate,
      promotionEndDate: dumpEndDate,
      expired,
    },
    dump: includeDump ? persisted.dump : null,
  };
}

export async function discoverCatalogueTargets(): Promise<CatalogueTarget[]> {
  const payload = await requestJson(buildCmsPageUrl("catalogues"), { method: "GET" });
  return extractCatalogueTargetsFromCms(payload);
}

export async function probeCatalogueWindow(
  target: CatalogueTarget,
  storeCode: string,
): Promise<{ promotionStartDate: number | null; promotionEndDate: number | null }> {
  const payload = await requestJson(
    buildSearchUrl(target, 0, storeCode, {
      fields: PROBE_SEARCH_FIELDS,
      pageSize: "24",
    }),
    {
      method: "POST",
      body: "{}",
    },
  );

  const products = Array.isArray(payload?.products) ? payload.products : [];
  const allPromotions: PromotionWindow[] = [];

  for (const product of products) {
    const promotions = extractPromotions(product);
    if (promotions.length > 0) {
      allPromotions.push(...promotions);
    }
  }

  if (allPromotions.length === 0) {
    return {
      promotionStartDate: null,
      promotionEndDate: null,
    };
  }

  const { promotionStartDate, promotionEndDate } = derivePromotionWindow(allPromotions);
  return {
    promotionStartDate,
    promotionEndDate,
  };
}

export async function pullCatalogueTarget(
  target: CatalogueTarget,
  storeCode: string,
  forceRefresh = false,
  onProgress?: FractionalProgress,
): Promise<{ dump: CatalogueDump; result: SyncItemResult }> {
  const outcome = await exportTarget(target, storeCode, forceRefresh, true, onProgress);
  if (!outcome.dump) {
    throw new Error("Catalogue export completed but no dump was available to open.");
  }
  return {
    dump: outcome.dump,
    result: outcome.result,
  };
}

/**
 * Initiates export for a catalogue identified by `source` and returns the persisted dump and sync result.
 *
* @param source - Either a catalogue identifier string (a full URL, a `/c/<slug>` path, a colon-delimited query, or a plain label/slug) or a pre-built `CatalogueTarget`.
 * @param storeCode - The store code used when querying search and detail endpoints.
 * @param forceRefresh - When true, bypasses manifest-based cache skipping and forces re-export.
 * @param label - Optional override for the catalogue label to use when exporting.
 * @returns An object containing `dump` (the persisted CatalogueDump) and `result` (the SyncItemResult summarizing the export outcome).
 */
export async function scanCatalogue(
  source: string | CatalogueTarget,
  storeCode: string,
  forceRefresh = false,
  label?: string,
  onProgress?: FractionalProgress,
): Promise<{ dump: CatalogueDump; result: SyncItemResult }> {
  const target = typeof source === "string" ? parseCatalogueTarget(source) : { ...source };
  const normalizedLabel = label?.trim();
  if (normalizedLabel) {
    target.label = normalizedLabel;
  }
  return pullCatalogueTarget(target, storeCode, forceRefresh, onProgress);
}

export async function syncAllMissingCatalogues(
  storeCode: string,
  forceRefresh = false,
  onProgress?: CountProgress,
): Promise<SyncSummary> {
  const targets = await discoverCatalogueTargets();
  const results: SyncItemResult[] = [];

  const totalCount = targets.length;
  if (totalCount === 0) {
    return {
      results,
      exportedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    };
  }

  onProgress?.(0, totalCount);
  let completed = 0;

  for (const target of targets) {
    try {
      const outcome = await exportTarget(target, storeCode, forceRefresh, false);
      results.push(outcome.result);
    } catch (error) {
      results.push({
        catalogueId: catalogueIdForTarget(storeCode, target),
        catalogueSlug: target.slug || target.label,
        catalogueStartDate: target.catalogueStartDate ?? null,
        catalogueEndDate: target.catalogueEndDate ?? null,
        status: "failed",
        itemCount: 0,
        barcodesFound: 0,
        missingBarcodes: 0,
        sourceUrl: target.sourceUrl || "",
        discoveredFrom: target.discoveredFrom || "",
        promotionStartDate: null,
        promotionEndDate: null,
        expired: false,
        message: errorMessage(error),
      });
    }

    completed += 1;
    onProgress?.(completed, totalCount);
  }

  return {
    results,
    exportedCount: results.filter((item) => item.status === "exported").length,
    skippedCount: results.filter((item) => item.status === "skipped").length,
    failedCount: results.filter((item) => item.status === "failed").length,
  };
}
