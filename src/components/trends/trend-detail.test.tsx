import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { USER_TYPES } from "@/auth/user-types";
import type { TrendDto } from "@/trend/dto";
import { projectTrendList } from "@/trend/list-projection";
import type { OpportunityListItemDto } from "@/opportunity/dto";

import { TrendDetail, type TrendDetailRelatedOpportunities } from "./trend-detail";

const trend: TrendDto = {
  id: "60000000-0000-4000-8000-000000000001",
  title: "Minuman berbasis tanaman",
  category: { code: "PRODUCT_MENU", name: "Produk dan Menu", description: "Internal." },
  subjectArea: { code: "BEVERAGE", name: "Minuman" },
  signal: {
    summary: "Pilihan minuman berbasis tanaman bertambah.",
    description: "Internal signal description.",
    direction: "RISING",
    observationPeriod: { start: "2026-01-01", end: "2026-03-31" },
  },
  evidence: [{
    sourceName: "Laporan industri",
    sourceReference: "Laporan 12, halaman 4",
    supportingDetail: "Porsi pilihan meningkat pada data yang diamati.",
    sourceDate: "2026-02-14T23:30:00.000Z",
    limitations: "Cakupan terbatas pada beberapa kota.",
  }],
  businessRelevanceExplanation: "Dapat menjadi konteks perencanaan menu.",
  affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
  lifecycleState: "PUBLISHED",
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-02T00:00:00.000Z",
};

const relatedOpportunity: OpportunityListItemDto = {
  id: "50000000-0000-4000-8000-000000000001",
  name: "Minuman oat musiman",
  categoryName: "Minuman",
  summary: "Pilihan minuman berbahan oat untuk menu musiman.",
  relatedTrend: { id: trend.id, title: trend.title },
};

function renderDetail(
  data: TrendDto = trend,
  relatedOpportunities: TrendDetailRelatedOpportunities = { status: "EMPTY", items: [] },
): string {
  const [item] = projectTrendList([data], USER_TYPES.ENTREPRENEUR);
  if (!item) throw new Error("Expected a projected Trend detail.");
  return renderToStaticMarkup(
    <TrendDetail item={item} relatedOpportunities={relatedOpportunities} />,
  ).replace(/\s+/gu, " ");
}

describe("TrendDetail", () => {
  it("renders persisted trend fields and evidence without freshness claims", () => {
    const markup = renderDetail();

    expect(markup).toContain("Minuman berbasis tanaman");
    expect(markup).toContain("Pilihan minuman berbasis tanaman bertambah.");
    expect(markup).toContain("Produk dan Menu");
    expect(markup).toContain("Meningkat");
    expect(markup).toContain("Periode observasi: 1 Jan 2026 – 31 Mar 2026");
    expect(markup).toContain("Dapat menjadi konteks perencanaan menu.");
    expect(markup).toContain("Laporan industri");
    expect(markup).toContain("Laporan 12, halaman 4");
    expect(markup).toContain("Tanggal sumber: 14 Feb 2026");
    expect(markup).toContain("Cakupan terbatas pada beberapa kota.");
    expect(markup).toContain("Belum ada peluang yang terhubung dengan tren ini.");
    expect(markup).toContain('href="/trends"');
    expect(markup).toContain("Katalog diperbarui 2 Apr 2026");
    expect(markup).not.toContain("Internal signal description");
  });

  it("renders related catalog opportunities with detail links and no recommendation claim", () => {
    const markup = renderDetail(trend, { status: "AVAILABLE", items: [relatedOpportunity] });

    expect(markup).toContain("Minuman oat musiman");
    expect(markup).toContain("Pilihan minuman berbahan oat untuk menu musiman.");
    expect(markup).toContain("Minuman");
    expect(markup).toContain('href="/opportunities/50000000-0000-4000-8000-000000000001"');
    expect(markup).not.toContain("rekomendasi");
  });

  it("renders a safe related-opportunity error while keeping the Trend detail", () => {
    const markup = renderDetail(trend, { status: "ERROR", items: [] });

    expect(markup).toContain("Minuman berbasis tanaman");
    expect(markup).toContain("Peluang terkait belum dapat dimuat. Konten Trend tetap tersedia.");
    expect(markup).not.toContain("database internals");
  });

  it("labels unknown observation and source dates without inventing values", () => {
    const markup = renderDetail({
      ...trend,
      signal: { ...trend.signal, observationPeriod: { start: null, end: null } },
      evidence: [{ ...trend.evidence[0]!, sourceDate: null, limitations: null }],
      businessRelevanceExplanation: null,
    });

    expect(markup).toContain("Periode observasi belum tersedia");
    expect(markup).toContain("Tanggal sumber tidak dicantumkan");
    expect(markup).toContain("Keterbatasan sumber:");
    expect(markup).toContain("Tidak dicantumkan.");
    expect(markup).toContain("Konteks relevansi bisnis belum tersedia.");
    expect(markup).not.toContain("1 Jan 2026");
  });
});
