export function trendInterestColor(value: number | null): string {
  if (value === null) return "#e8e4df";
  if (value === 0) return "#f5e8eb";
  if (value <= 20) return "#e7c5cd";
  if (value <= 40) return "#d59aa8";
  if (value <= 60) return "#bd6d81";
  if (value <= 80) return "#963f58";
  return "#5c1e31";
}

/** Display-only mean; a missing provider average is never replaced in the source payload. */
export function timeSeriesAverage(series: { readonly averageInterest: number | null; readonly points: readonly { readonly interestIndex: number | null }[] }) {
  const values = series.points.map(point => point.interestIndex).filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0 && value <= 100);
  const provider = series.averageInterest;
  if (provider !== null && Number.isFinite(provider) && provider >= 0 && provider <= 100) return { value: provider, basis: "SOURCE" as const, validCount: values.length };
  return { value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, basis: "OBSERVATIONS" as const, validCount: values.length };
}
