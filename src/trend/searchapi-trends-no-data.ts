/** SearchApi's successful Google Trends response when the selected dataset has insufficient data. */
export function isSearchApiTrendsNoData(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
  const root = payload as Record<string, unknown>;
  const metadata = root.search_metadata;
  return root.error === "Your search doesn't have enough data to show here"
    && typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
    && (metadata as Record<string, unknown>).status === "Success";
}
