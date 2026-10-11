import { describe, expect, it } from "vitest";

import { ROADMAP_STAGES, type RoadmapAnalysisContext, type RoadmapOpportunityContext, type RoadmapProfileContext } from "./domain";
import { generateStartupRoadmap, RoadmapInsufficientDataError } from "./generator";

const profile: RoadmapProfileContext = {
  profileVersion: 3,
  locationText: "Bandung, Jawa Barat",
  countryCode: "ID",
  budgetMin: 2_000_000,
  budgetMax: 8_000_000,
  experienceLevel: "BEGINNER",
  timeCommitment: "PART_TIME",
  preferredProductType: "Minuman botani",
  businessObjective: "Menguji penawaran minuman",
  interests: ["Minuman"],
  customerSegments: ["Pekerja kantor"],
  salesChannels: ["Penjualan langsung online"],
};

const opportunity: RoadmapOpportunityContext = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Menu minuman botani",
  description: "Deskripsi katalog yang tersimpan.",
  categoryName: "Minuman",
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: "Konsumen minuman botani.",
  competitionLevel: "MEDIUM",
  competitionSummary: "Ringkasan katalog.",
  trend: {
    id: "70000000-0000-4000-8000-000000000001",
    title: "Trend minuman terpublikasi",
    signalSummary: "Ringkasan sinyal terkurasi.",
    signalDescription: "Deskripsi sinyal.",
    lifecycleState: "PUBLISHED",
    affectedUserTypes: ["ENTREPRENEUR"],
  },
  evidence: [{ id: "80000000-0000-4000-8000-000000000001", sourceName: "Sumber katalog", sourceReference: "Referensi A", sourceUrl: null }],
};

const availableAnalysis: RoadmapAnalysisContext = {
  id: "90000000-0000-4000-8000-000000000001",
  scoreStatus: "AVAILABLE",
  opportunityScore: "72.50",
  fitScore: "68.00",
  riskLevel: "MEDIUM",
  riskReasons: ["Alasan dari hasil tersimpan."],
};

describe("generateStartupRoadmap", () => {
  it("creates the six ordered actionable stages using profile and Opportunity context", () => {
    const result = generateStartupRoadmap({ profile, opportunity, analysis: null });

    expect(result.steps.map(({ stage }) => stage)).toEqual(ROADMAP_STAGES);
    expect(result.steps.map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const step of result.steps) {
      expect(step.action.length).toBeGreaterThan(12);
      expect(step.objective.length).toBeGreaterThan(12);
      expect(step.timeline).not.toMatch(/\b\d+\s*(hari|minggu|bulan)\b/iu);
      expect(step).not.toHaveProperty("estimatedCost");
    }
    expect(result.steps[0]?.action).toContain("Pekerja kantor");
    expect(result.steps[0]?.action).toContain("Bandung, Jawa Barat");
    expect(result.steps[1]?.action).toContain("Penjualan langsung online");
    expect(result.steps[2]?.action).toContain("Minuman botani");
    expect(result.generationContext.contextMode).toBe("LIMITED_CONTEXT");
    expect(result.generationContext.availableSignals).toEqual({ opportunityScore: null, fitScore: null, riskLevel: null });
    expect(result.generationContext.unavailableInputs).toEqual(["Opportunity Score", "Fit Score", "Risk"]);
    expect(result.generationContext.evidence).toEqual([{ id: opportunity.evidence[0]!.id, sourceName: "Sumber katalog", sourceReference: "Referensi A" }]);
    expect(result.generationContext.method).toBe("MVP_STRUCTURED_VALIDATION");
  });

  it("uses only valid saved numerical signals and never substitutes invalid values", () => {
    const available = generateStartupRoadmap({ profile, opportunity, analysis: availableAnalysis });
    expect(available.generationContext.contextMode).toBe("FULL_CONTEXT");
    expect(available.generationContext.availableSignals).toEqual({ opportunityScore: 72.5, fitScore: 68, riskLevel: "MEDIUM" });

    const invalid = generateStartupRoadmap({
      profile,
      opportunity,
      analysis: { ...availableAnalysis, opportunityScore: "101", fitScore: "NaN", riskReasons: [{}] },
    });
    expect(invalid.generationContext.availableSignals).toEqual({ opportunityScore: null, fitScore: null, riskLevel: null });
    expect(invalid.generationContext.contextMode).toBe("LIMITED_CONTEXT");
  });

  it("rejects missing validated profile context and an ineligible unpublished Trend", () => {
    expect(() => generateStartupRoadmap({ profile: { ...profile, salesChannels: [] }, opportunity, analysis: null }))
      .toThrow(RoadmapInsufficientDataError);
    expect(() => generateStartupRoadmap({
      profile,
      opportunity: { ...opportunity, trend: { ...opportunity.trend, lifecycleState: "DRAFT" } },
      analysis: null,
    })).toThrow(RoadmapInsufficientDataError);
  });
});
