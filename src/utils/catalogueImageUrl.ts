export function coalesceCatalogueImageUrl(
  incoming: string | null | undefined,
  existing: string | null | undefined,
): string | null {
  return incoming === undefined ? (existing ?? null) : incoming;
}
