import type { ImportedItem } from "../types";

export function importItemMatchesSearch(
  item: ImportedItem,
  search: string,
): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [item.baseProduct, item.barcode].some((value) =>
    value.toLowerCase().includes(query),
  );
}
