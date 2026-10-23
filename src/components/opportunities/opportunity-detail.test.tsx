import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/opportunity/saved-actions", () => ({
  setOpportunitySavedAction: vi.fn(),
}));

vi.mock("@/components/roadmaps/startup-roadmap-generate-button", () => ({
  StartupRoadmapGenerateButton: ({ opportunityId, roadmapType }: { readonly opportunityId: string; readonly roadmapType: "STARTUP" | "GROWTH" }) => (
    <button type="button">Buat {roadmapType === "GROWTH" ? "Growth" : "Startup"} Roadmap {opportunityId}</button>
  ),
}));

import OpportunityDetailError from "@/app/(app)/opportunities/[id]/error";
import OpportunityDetailNotFound from "@/app/(app)/opportunities/[id]/not-found";
import type { OpportunityDetailDto } from "@/opportunity/dto";
import type { OpportunityEvidenceState } from "@/opportunity/evidence-dto";
import type { OpportunitySaveState } from "@/opportunity/saved-dto";
import { OPPORTUNITY_SCORE_COMPONENTS } from "@/scoring/opportunity-score";
import type { OpportunityScoreDisplayState } from "@/scoring/opportunity-score-service";
import { RISK_FACTORS } from "@/scoring/risk-assessment";
import type { RiskAssessmentDisplayState } from "@/scoring/risk-assessment-service";
import { OpportunityDetail } from "./opportunity-detail";

const item: OpportunityDetailDto = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Menu minuman berbasis tanaman",
  description: "Deskripsi tersimpan dari katalog peluang.",
  categoryName: "Minuman",
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: "Konsumen minuman nabati.",
  competitionLevel: "MEDIUM",
  competitionSummary: "Beberapa penawaran tercatat.",
  relatedTrend: {
    id: "70000000-0000-4000-8000-000000000001",
    title: "Tren minuman terpublikasi",
  },
};
const completeEvidenceItem = {
  sourceName: "Laporan industri",
  sourceType: "Government/Open Data",
  sourceDateLabel: "Tanggal sumber (UTC): 2026-01-15",
  retrievedAtLabel: "Data diambil: 2026-02-01 10:30 UTC",
  sourceReference: "Dataset seri 4, tabel 2",
  sourceUrl: "https://example.org/dataset",
  limitations: [],
};
const completeEvidence: OpportunityEvidenceState = {
  status: "AVAILABLE",
  limited: false,
  items: [completeEvidenceItem, { ...completeEvidenceItem, sourceName: "Sumber kedua" }],
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

function render(
  value: OpportunityDetailDto,
  evidence: OpportunityEvidenceState = completeEvidence,
  saveState: OpportunitySaveState = { status: "AVAILABLE", saved: false },
  opportunityScore: OpportunityScoreDisplayState = insufficientScore,
  riskAssessment: RiskAssessmentDisplayState = insufficientRisk,
  isEntrepreneur = false,
  isUmkmExisting = false,
): string {
  return renderToStaticMarkup(
    <OpportunityDetail
      evidence={evidence}
      item={value}
      opportunityScore={opportunityScore}
      riskAssessment={riskAssessment}
      saveState={saveState}
      isEntrepreneur={isEntrepreneur}
      isUmkmExisting={isUmkmExisting}
    />,
  ).replace(/\s+/gu, " ");
}

describe("OpportunityDetail", () => {
  it("stacks score cards until the large desktop breakpoint", () => {
    const markup = render(item);
    const scoreSection = markup.match(/<section aria-labelledby="[^"]+-scores"[^>]*>(.*?)<\/section>/u)?.[1] ?? "";
    const scoreGrid = scoreSection.match(/<dl class="grid gap-12 lg:grid-cols-3">(.*?)<\/dl>/u)?.[1] ?? "";

    expect(scoreGrid).not.toBe("");
    expect(scoreGrid.indexOf("Opportunity Score")).toBeLessThan(scoreGrid.indexOf("Fit Score"));
    expect(scoreGrid.indexOf("Fit Score")).toBeLessThan(scoreGrid.indexOf("Risk"));
  });

  it("renders persisted detail fields and links only to the eligible related Trend", () => {
    const markup = render(item);

    expect(markup).toContain(item.name);
    expect(markup).toContain(item.description);
    expect(markup).toContain("Hipotesis Peluang — Perlu Validasi");
    expect(markup).toContain("Sinyal pencarian historis 2025 menunjukkan minat pencarian");
    expect(markup).toContain("bukan bukti permintaan pasar, pendapatan, atau keberhasilan usaha.");
    expect(markup).toContain(item.categoryName);
    expect(markup).toContain(item.opportunityType);
    expect(markup).toContain(item.targetConsumerSummary);
    expect(markup).toContain(item.competitionLevel);
    expect(markup).toContain(item.competitionSummary);
    expect(markup).toContain(`href="/trends/${item.relatedTrend.id}"`);
    expect(markup).toContain(item.relatedTrend.title);
    expect(markup).toContain('href="/opportunities"');
    expect(markup).toContain("Simpan opportunity");
    expect(markup).toContain("Laporan industri");
    expect(markup).toContain("Government/Open Data");
    expect(markup).toContain("Tanggal sumber (UTC): 2026-01-15");
    expect(markup).toContain("Data diambil: 2026-02-01 10:30 UTC");
    expect(markup).toContain('href="https://example.org/dataset"');
    expect(markup).toContain("Jumlah evidence tidak menyatakan kualitas atau verifikasi sumber.");
  });

  it("renders a real assessed Risk result without changing Opportunity Score or Fit Score", () => {
    const risk: RiskAssessmentDisplayState = {
      status: "ASSESSED",
      modelType: "RISK",
      modelVersion: "approved-risk-v2",
      level: "MEDIUM",
      reasons: ["Kompleksitas eksekusi dinilai Sedang menurut policy approved-risk-v2."],
      factorsConsidered: [{
        factor: "executionComplexity",
        label: "Kompleksitas eksekusi",
        value: "55 /100",
        level: "MEDIUM",
        source: "Kompleksitas operasional tersimpan",
        sourceReference: "opportunity_fit_requirements.operational_complexity",
      }],
      factorsNotAssessed: ["competition", "capitalRequirement", "trendVolatility", "marketUncertainty"],
      evidenceReferences: [],
      limitations: ["Risk bukan prediksi hasil bisnis."],
    };
    const markup = render(item, completeEvidence, { status: "AVAILABLE", saved: false }, insufficientScore, risk);

    expect(markup).toContain("Sedang (MEDIUM)");
    expect(markup).toContain("Kompleksitas eksekusi dinilai Sedang");
    expect(markup).not.toContain("Versi model: approved-risk-v2");
    expect(markup).toContain("Data belum cukup untuk menghitung skor secara layak.");
    expect(markup).toContain("Memuat Fit Score");
  });

  it("shows saved status and an unsave action for an existing saved relation", () => {
    const markup = render(item, completeEvidence, { status: "AVAILABLE", saved: true });

    expect(markup).toContain("Hapus dari simpanan");
    expect(markup).toContain('name="opportunityId"');
    expect(markup).toContain(`value="${item.id}"`);
  });

  it("offers the role-specific generator only to completed account types", () => {
    const entrepreneur = render(item, completeEvidence, { status: "AVAILABLE", saved: false }, insufficientScore, insufficientRisk, true);
    const umkm = render(item, completeEvidence, { status: "AVAILABLE", saved: false }, insufficientScore, insufficientRisk, false, true);
    const unavailable = render(item);

    expect(entrepreneur).toContain(`Buat Startup Roadmap ${item.id}`);
    expect(umkm).toContain(`Buat Growth Roadmap ${item.id}`);
    expect(entrepreneur).toContain("Hipotesis Peluang — Perlu Validasi");
    expect(umkm).toContain("Hipotesis Peluang — Perlu Validasi");
    expect(unavailable).toContain("Roadmap hanya tersedia setelah tipe akun dan profil selesai diverifikasi.");
    expect(unavailable).not.toContain("Buat Startup Roadmap");
  });

  it("keeps detail visible and reports a safe status when saved-state loading fails", () => {
    const markup = render(item, completeEvidence, { status: "ERROR" });

    expect(markup).toContain(item.name);
    expect(markup).toContain("Status simpanan belum dapat dimuat.");
    expect(markup).toContain("Coba lagi");
  });

  it("states unavailable analysis honestly without scores, evidence claims, or actions", () => {
    const markup = render(
      {
        ...item,
        targetConsumerSummary: null,
        competitionLevel: null,
        competitionSummary: null,
      },
      {
        status: "AVAILABLE",
        limited: true,
        items: [{ ...completeEvidenceItem, limitations: ["Cakupan hanya beberapa kota."] }],
      },
    );

    expect(markup.match(/Data belum cukup/gu)).toHaveLength(1);
    expect(markup).toContain("Risiko belum dapat dinilai berdasarkan data dan kebijakan yang tersedia.");
    expect(markup).toContain("Memuat Fit Score…");
    expect(markup).toContain("Bukti terbatas");
    expect(markup).toContain("Keterbatasan sumber");
    expect(markup).toContain("Cakupan hanya beberapa kota.");
    expect(markup).toContain("Memuat AI Analysis");
    expect(markup).toContain("Generate AI Analysis");
    expect(markup).toContain("Roadmap hanya tersedia setelah tipe akun dan profil selesai diverifikasi.");
    expect(markup.match(/Belum dicantumkan\./gu)).toHaveLength(3);
    expect(markup).not.toContain("href=\"/opportunities/save");
    expect(markup).not.toContain("Evidence tersedia");
    expect(markup).not.toMatch(/(?:Opportunity Score|Fit Score|Risk)<\/dt>\s*<dd[^>]*>\d/);
  });

  it("shows distinct EMPTY and ERROR evidence states without hiding Opportunity detail", () => {
    const empty = render(item, { status: "EMPTY", items: [], limited: true });
    const error = render(item, { status: "ERROR" });

    expect(empty).toContain("Bukti terbatas");
    expect(empty).toContain("Belum ada evidence tersimpan untuk Opportunity ini.");
    expect(error).toContain("Evidence belum dapat dimuat.");
    expect(error).toContain(item.name);
    expect(error).not.toContain("database");
  });

  it("shows generic not-found and error states without exposing persistence details", () => {
    const notFound = renderToStaticMarkup(<OpportunityDetailNotFound />).replace(/\s+/gu, " ");
    const error = renderToStaticMarkup(<OpportunityDetailError
      error={new Error("database internals")}
      reset={() => undefined}
    />).replace(/\s+/gu, " ");

    expect(notFound).toContain("Opportunity ini tidak tersedia atau tidak dapat diakses.");
    expect(error).toContain("Detail Opportunity belum dapat dimuat.");
    expect(error).not.toContain("database internals");
  });
});
