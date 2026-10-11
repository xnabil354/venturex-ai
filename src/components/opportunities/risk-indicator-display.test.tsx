import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RISK_FACTORS } from "@/scoring/risk-assessment";
import type { RiskAssessmentDisplayState } from "@/scoring/risk-assessment-service";
import { RiskIndicatorDisplay } from "./risk-indicator-display";

const insufficient: RiskAssessmentDisplayState = {
  status: "INSUFFICIENT_DATA",
  modelType: "RISK",
  modelVersion: null,
  level: null,
  reason: "CONFIGURATION_UNAVAILABLE",
  missingFactors: RISK_FACTORS,
  evidenceReferences: [],
  limitations: ["Tidak ada policy risiko yang tersedia."],
};

const assessed: RiskAssessmentDisplayState = {
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
  evidenceReferences: [{
    sourceName: "Laporan resmi",
    sourceReference: "Dataset 4",
    sourceUrl: "https://example.org/dataset",
  }],
  limitations: ["Indikator ini bukan prediksi hasil bisnis."],
};

function render(result: RiskAssessmentDisplayState, compact = false): string {
  return renderToStaticMarkup(<RiskIndicatorDisplay compact={compact} result={result} />).replace(/\s+/gu, " ");
}

describe("RiskIndicatorDisplay", () => {
  it("does not show a fabricated level when configuration is unavailable", () => {
    const markup = render(insufficient);

    expect(markup).toContain("Risiko belum dapat dinilai berdasarkan data dan kebijakan yang tersedia.");
    expect(markup).toContain("Kebijakan Risk yang aktif dan disetujui belum tersedia.");
    expect(markup).toContain("Kompetisi, Kebutuhan modal, Volatilitas tren");
    expect(markup).not.toContain("Rendah (LOW)");
    expect(markup).not.toContain("Sedang (MEDIUM)");
    expect(markup).not.toContain("Tinggi (HIGH)");
  });

  it("renders assessed level, reasons, actual factors, source references, policy version, and limits", () => {
    const markup = render(assessed);

    expect(markup).toContain("Sedang (MEDIUM)");
    expect(markup).toContain("Alasan penilaian");
    expect(markup).toContain("Kompleksitas eksekusi: Sedang");
    expect(markup).toContain("55 /100");
    expect(markup).toContain("opportunity_fit_requirements.operational_complexity");
    expect(markup).toContain("Versi model: approved-risk-v2");
    expect(markup).toContain("tidak otomatis membuktikan faktor risiko tertentu");
    expect(markup).toContain('href="https://example.org/dataset"');
    expect(markup).toContain("Indikator ini bukan prediksi hasil bisnis.");
  });

  it("renders a safe error state", () => {
    expect(render({ status: "ERROR" })).toContain("Indikator Risiko sementara tidak dapat dimuat.");
  });
});
