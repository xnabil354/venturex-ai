import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OpportunityFinderResult } from "@/opportunity/service";
import { OpportunityFinder } from "./opportunity-finder";

const available: OpportunityFinderResult = {
  status: "AVAILABLE",
  items: [{
    id: "60000000-0000-4000-8000-000000000001",
    name: "Menu minuman berbasis tanaman",
    categoryName: "Minuman",
    summary: "Pilihan minuman bertambah berdasarkan catatan katalog.",
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      title: "Tren minuman terpublikasi",
    },
  }],
  page: 1,
  pageSize: 10,
  totalCount: 12,
  totalPages: 2,
};

function render(result: OpportunityFinderResult): string {
  return renderToStaticMarkup(<OpportunityFinder result={result} />).replace(/\s+/gu, " ");
}

describe("OpportunityFinder", () => {
  it("renders catalog fields, eligible Trend navigation, and honest score states", () => {
    const markup = render(available);

    expect(markup).toContain("Menu minuman berbasis tanaman");
    expect(markup).toContain("Minuman");
    expect(markup).toContain("Pilihan minuman bertambah berdasarkan catatan katalog.");
    expect(markup).toContain('href="/opportunities/60000000-0000-4000-8000-000000000001"');
    expect(markup).toContain("Lihat detail Menu minuman berbasis tanaman");
    expect(markup).toContain('href="/trends/70000000-0000-4000-8000-000000000001"');
    expect(markup).toContain("Tren minuman terpublikasi");
    expect(markup.match(/Data belum cukup/gu)).toHaveLength(3);
    expect(markup).toContain("Halaman 1 dari 2 · 12 peluang");
    expect(markup).toContain('href="/opportunities?page=2"');
    expect(markup).not.toContain("rekomendasi personal");
  });

  it("renders distinct EMPTY, ERROR, and UNAVAILABLE states", () => {
    const empty = render({
      status: "EMPTY",
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,
    });
    const error = render({ status: "ERROR" });
    const unavailable = render({ status: "UNAVAILABLE" });

    expect(empty).toContain("Belum ada peluang tersimpan");
    expect(empty).not.toContain("belum dapat dimuat");
    expect(error).toContain("Katalog peluang belum dapat dimuat");
    expect(unavailable).toContain("Katalog peluang belum tersedia untuk saat ini.");
  });
});
