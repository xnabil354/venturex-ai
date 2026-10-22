import type { DashboardTrendModuleState } from "./dto";
import { trendRadarResponseSchema, type TrendRadarResponse } from "@/trend/trend-radar-contract";

export const radarSnapshotKey = (userId: string) => `venturex:radar-preview:v1:${userId}`;
export const normalizeRadarProduct = (value: string) => value.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 80);

export function radarMetric(row: { readonly interestIndex?: number | null | undefined; readonly growthLabel?: string | null | undefined; readonly growthPercent?: number | null | undefined; readonly isBreakout?: boolean | undefined }, rising: boolean): string {
  if (!rising) return row.interestIndex == null ? "Indeks minat belum tersedia" : `Indeks minat ${row.interestIndex}/100`;
  if (row.isBreakout) return "Breakout · minat meningkat tajam";
  return row.growthLabel ?? (row.growthPercent == null ? "Pertumbuhan belum tersedia" : `Pertumbuhan +${row.growthPercent}%`);
}

export function radarFilterContext(geography: string, period: string, property: string, time?: string): string {
  const periods: Record<string, string> = { "1h": "1 jam", "4h": "4 jam", "24h": "24 jam", "7d": "7 hari", "1m": "1 bulan", "3m": "3 bulan", "1y": "1 tahun", "5y": "5 tahun", all: "Semua waktu" };
  const properties: Record<string, string> = { web: "Web", images: "Gambar", news: "Berita", shopping: "Shopping", youtube: "YouTube" };
  return `${geography} · ${periods[period] ?? (period.startsWith("custom") ? time ?? period : period)} · ${properties[property] ?? property}`;
}

export function radarContext(product: string, geo: string, period: string, property: string, time?: string): string {
  return `${product} · ${radarFilterContext(geo ? `Wilayah ${geo}` : "Seluruh dunia", period, property, time)}`;
}

export function buildRadarPreview(result: TrendRadarResponse): DashboardTrendModuleState {
  const preview = [
    ...result.top.slice(0, result.rising.length ? 2 : 3).map(row => ({ row, rising: false })),
    ...result.rising.slice(0, result.top.length >= 2 ? 1 : 3 - result.top.length).map(row => ({ row, rising: true })),
  ].map(({ row, rising }) => ({
    id: `${rising ? "rising" : "top"}-${row.position}`,
    title: row.query,
    categoryName: rising ? "Makin populer" : "Kueri populer",
    summary: radarMetric(row, rising),
    href: "/trends",
  }));
  return {
    status: preview.length ? "AVAILABLE" : "EMPTY",
    preview,
    context: `Hasil terakhir di browser ini · ${radarContext(result.productQuery, result.appliedFilters.geo, result.appliedFilters.period, result.appliedFilters.property, result.appliedFilters.time)}`,
    observedAt: result.retrievedAt,
  };
}

export function readRadarSnapshot(raw: string | null, productQuery: string): TrendRadarResponse | null {
  if (!raw || raw.length > 200_000) return null;
  try {
    const result = trendRadarResponseSchema.safeParse(JSON.parse(raw));
    if (!result.success || normalizeRadarProduct(result.data.productQuery) !== normalizeRadarProduct(productQuery)) return null;
    return result.data;
  } catch { return null; }
}
