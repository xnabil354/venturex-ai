import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { OpportunityFinderResult } from "@/opportunity/service";
import { OpportunityFinder } from "./opportunity-finder";
import { OPPORTUNITY_SCORE_COMPONENTS } from "@/scoring/opportunity-score";
import type { OpportunityScoreDisplayState } from "@/scoring/opportunity-score-service";
import { RISK_FACTORS } from "@/scoring/risk-assessment";
import type { RiskAssessmentDisplayState } from "@/scoring/risk-assessment-service";

const available: OpportunityFinderResult = {
  status: "AVAILABLE",
  categories: [
    { code: "BEVERAGES", name: "Minuman" },
    { code: "SNACKS", name: "Camilan" },
  ],
  selectedCategory: null,
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

const insufficientScore: OpportunityScoreDisplayState = {
  status: "INSUFFICIENT_DATA",
  modelType: "OPPORTUNITY_SCORE",
  modelVersion: null,
  score: null,
  breakdown: OPPORTUNITY_SCORE_COMPONENTS.map((component) => ({
    component,
    normalizedValue: null,
    weight: null,
    weightedContribution: null,
  })),
  missingComponents: OPPORTUNITY_SCORE_COMPONENTS,
  invalidComponents: [],
  reason: "CONFIGURATION_UNAVAILABLE",
  sources: Object.fromEntries(OPPORTUNITY_SCORE_COMPONENTS.map((component) => [component, {
    status: "UNAVAILABLE",
    source: `Sumber ${component}`,
    explanation: `Belum tersedia: ${component}`,
  }])) as Extract<OpportunityScoreDisplayState, { readonly status: "INSUFFICIENT_DATA" }> ["sources"],
  disclaimer: "Opportunity Score bukan jaminan keberhasilan bisnis.",
};

const insufficientRisk: RiskAssessmentDisplayState = {
  status: "INSUFFICIENT_DATA",
  modelType: "RISK",
  modelVersion: null,
  level: null,
  reason: "CONFIGURATION_UNAVAILABLE",
  missingFactors: RISK_FACTORS,
  evidenceReferences: [],
  limitations: [],
};

function render(result: OpportunityFinderResult, risk: RiskAssessmentDisplayState = insufficientRisk): string {
  const scoreByOpportunityId = { "60000000-0000-4000-8000-000000000001": insufficientScore };
  return renderToStaticMarkup(
    <OpportunityFinder
      result={result}
      riskByOpportunityId={{ "60000000-0000-4000-8000-000000000001": risk }}
      scoreByOpportunityId={scoreByOpportunityId}
    />,
  ).replace(/\s+/gu, " ");
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
    expect(markup).toContain("Risiko belum dapat dinilai berdasarkan data dan kebijakan yang tersedia.");
    expect(markup.match(/Data belum cukup/gu)).toHaveLength(1);
    expect(markup).toContain("Memuat Fit Score");
    expect(markup).not.toMatch(/aria-label="Fit Score \d/u);
    expect(markup).toContain("Hipotesis Peluang — Perlu Validasi");
    expect(markup).toContain("Sinyal pencarian historis 2025 menunjukkan minat pencarian");
    expect(markup).toContain("bukan bukti permintaan pasar, pendapatan, atau keberhasilan usaha.");
    expect(markup).toContain("Halaman 1 dari 2 · 12 peluang");
    expect(markup).toContain('href="/opportunities?page=2"');
    expect(markup).toContain('action="/opportunities" method="get"');
    expect(markup).toContain("Pilih untuk perbandingan");
    expect(markup).toContain("Bandingkan (0/3)");
    expect(markup).toContain("Pilih setidaknya dua peluang dari daftar.");
    expect(markup).toContain('name="category"');
    expect(markup).toContain('<option value="SNACKS">Camilan</option>');
    expect(markup).not.toContain('name="page"');
    expect(markup).not.toContain("rekomendasi personal");
  });

  it("shows the assessed risk level, reason, and policy version in each Finder card", () => {
    const markup = render(available, {
      status: "ASSESSED",
      modelType: "RISK",
      modelVersion: "approved-risk-v1",
      level: "HIGH",
      reasons: ["Kebutuhan modal dinilai Tinggi menurut policy approved-risk-v1."],
      factorsConsidered: [{
        factor: "capitalRequirement",
        label: "Kebutuhan modal",
        value: "5000000 IDR",
        level: "HIGH",
        source: "Batas maksimum modal pada kebutuhan Opportunity",
        sourceReference: "opportunity_fit_requirements.capital_max",
      }],
      factorsNotAssessed: ["competition", "trendVolatility", "executionComplexity", "marketUncertainty"],
      evidenceReferences: [],
      limitations: ["Risk bukan prediksi hasil bisnis."],
    });

    expect(markup).toContain("Tinggi (HIGH)");
    expect(markup).toContain("Kebutuhan modal dinilai Tinggi");
    expect(markup).toContain("Versi policy: approved-risk-v1");
  });

  it("preserves an encoded active category while navigating pages", () => {
    const markup = render({
      ...available,
      categories: [...available.categories, { code: "DRINKS&TEA", name: "Minuman dan teh" }],
      selectedCategory: { code: "DRINKS&TEA", name: "Minuman dan teh" },
    });

    expect(markup).toContain('href="/opportunities?page=2&amp;category=DRINKS%26TEA"');
    expect(markup).toContain('value="DRINKS&amp;TEA" selected');
  });

  it("renders distinct EMPTY, ERROR, and UNAVAILABLE states", () => {
    const empty = render({
      status: "EMPTY",
      items: [],
      categories: [{ code: "BEVERAGES", name: "Minuman" }],
      selectedCategory: null,
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

  it("offers a clear-filter action for an empty category and safely handles invalid categories", () => {
    const filteredEmpty = render({
      status: "EMPTY",
      items: [],
      categories: [{ code: "SNACKS", name: "Camilan" }],
      selectedCategory: { code: "SNACKS", name: "Camilan" },
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 1,
    });
    const invalid = render({
      status: "INVALID_CATEGORY",
      items: [],
      categories: [{ code: "SNACKS", name: "Camilan" }],
      selectedCategory: null,
    });

    expect(filteredEmpty).toContain("Belum ada peluang yang tersedia pada kategori Camilan");
    expect(filteredEmpty).toContain('href="/opportunities"');
    expect(filteredEmpty).toContain("Hapus filter kategori");
    expect(invalid).toContain("Kategori tidak tersedia");
    expect(invalid).toContain('href="/opportunities"');
    expect(invalid).not.toContain("UNTRUSTED");
  });
});
