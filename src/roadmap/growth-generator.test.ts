import { describe, expect, it } from "vitest";

import type { GrowthRoadmapProfileContext, RoadmapAnalysisContext, RoadmapOpportunityContext } from "./domain";
import { GROWTH_ROADMAP_STAGES } from "./domain";
import { generateGrowthRoadmap } from "./growth-generator";
import { RoadmapInsufficientDataError } from "./generator";

const profile: GrowthRoadmapProfileContext = {
  profileVersion: 4,
  businessName: "Kedai Pagi",
  businessCategory: "Minuman",
  locationText: "Bandung, Jawa Barat",
  countryCode: "ID",
  averagePriceMin: 15_000,
  averagePriceMax: 35_000,
  businessDescription: "Kedai minuman yang melayani pelanggan sekitar.",
  products: [
    { name: "Kopi susu", category: "Minuman", price: 25_000 },
    { name: "Teh lemon", category: null, price: null },
  ],
  customerSegments: ["Pekerja kantor", "Mahasiswa"],
  salesChannels: ["Gerai atau toko offline", "Pesan antar"],
};

const opportunity: RoadmapOpportunityContext = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Menu sarapan praktis",
  description: "Peluang menu tambahan dari katalog tersimpan.",
  categoryName: "Makanan",
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: "Pelanggan yang membutuhkan sarapan.",
  competitionLevel: null,
  competitionSummary: null,
  trend: {
    id: "70000000-0000-4000-8000-000000000001",
    title: "Trend sarapan terkurasi",
    signalSummary: "Ringkasan sinyal tersimpan.",
    signalDescription: "Deskripsi sinyal yang disimpan.",
    lifecycleState: "PUBLISHED",
    affectedUserTypes: ["UMKM_EXISTING"],
  },
  evidence: [{ id: "80000000-0000-4000-8000-000000000001", sourceName: "Sumber katalog", sourceReference: "Laporan 4", sourceUrl: null }],
};

const availableAnalysis: RoadmapAnalysisContext = {
  id: "90000000-0000-4000-8000-000000000001",
  scoreStatus: "AVAILABLE",
  opportunityScore: "72.50",
  fitScore: "68.00",
  riskLevel: "MEDIUM",
  riskReasons: ["Alasan dari analisis tersimpan."],
};

describe("generateGrowthRoadmap", () => {
  it("generates the five ordered stages from trusted business and Opportunity context", () => {
    const result = generateGrowthRoadmap({ profile, opportunity, analysis: null });
    expect(result.steps.map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(result.steps.map(({ stage }) => stage)).toEqual(GROWTH_ROADMAP_STAGES);
    expect(result.steps).toHaveLength(5);
    expect(result.generationContext.profileInputs).toMatchObject({
      businessName: "Kedai Pagi",
      businessCategory: "Minuman",
      location: "Bandung, Jawa Barat",
      averagePriceRange: { min: 15_000, max: 35_000, currency: "IDR" },
      products: [
        { name: "Kopi susu", category: "Minuman", listedPrice: 25_000 },
        { name: "Teh lemon", category: null, listedPrice: null },
      ],
      customerSegments: ["Pekerja kantor", "Mahasiswa"],
      salesChannels: ["Gerai atau toko offline", "Pesan antar"],
    });
    expect(result.generationContext.opportunity).toMatchObject({ id: opportunity.id, trendId: opportunity.trend.id });
    expect(result.generationContext.evidence).toEqual([{ id: opportunity.evidence[0]!.id, sourceName: "Sumber katalog", sourceReference: "Laporan 4" }]);
    expect(result.generationContext.contextMode).toBe("LIMITED_CONTEXT");
    expect(result.generationContext.unavailableInputs).toContain("Catatan transaksi penjualan aktual");
    expect(result.generationContext.unavailableInputs).toContain("Catatan biaya aktual untuk penilaian margin");
    expect(result.steps[0]?.action).toContain("Pekerja kantor");
    expect(result.steps[0]?.action).toContain("Kedai Pagi");
    expect(result.steps[1]?.action).toContain("Kopi susu");
    expect(result.steps[2]?.action).toContain("Gerai atau toko offline");
    expect(result.steps[3]?.action).toContain("kumpulkan bukti transaksi dan biaya");
    expect(result.steps[3]?.expectedOutput).toContain("tidak ada margin hasil estimasi");
    for (const step of result.steps) {
      expect(step.action.length).toBeGreaterThan(12);
      expect(step.objective.length).toBeGreaterThan(12);
      expect(step.expectedOutput.length).toBeGreaterThan(12);
    }
    expect(result.generationContext.method).toBe("MVP_STRUCTURED_GROWTH_PLANNING");
    expect(result.generationContext.limitations.join(" ")).toContain("tidak menggunakan LLM");
  });

  it("uses only valid stored scores and risk and never substitutes missing values", () => {
    const result = generateGrowthRoadmap({ profile, opportunity, analysis: availableAnalysis });
    expect(result.generationContext.availableSignals).toEqual({ opportunityScore: 72.5, fitScore: 68, riskLevel: "MEDIUM" });
    expect(result.generationContext.contextMode).toBe("LIMITED_CONTEXT");
    const invalid = generateGrowthRoadmap({
      profile,
      opportunity,
      analysis: { ...availableAnalysis, opportunityScore: "101", fitScore: "NaN", riskReasons: [{}] },
    });
    expect(invalid.generationContext.availableSignals).toEqual({ opportunityScore: null, fitScore: null, riskLevel: null });
    expect(invalid.generationContext.unavailableInputs).toContain("Opportunity Score");
    expect(invalid.generationContext.unavailableInputs).toContain("Risk");
  });

  it("rejects incomplete profiles, unsafe amounts, invalid ranges, and ineligible Trends", () => {
    const invalidProfiles: GrowthRoadmapProfileContext[] = [
      { ...profile, products: [] },
      { ...profile, averagePriceMax: profile.averagePriceMin - 1 },
      { ...profile, averagePriceMin: Number.MAX_SAFE_INTEGER + 1 },
      { ...profile, products: [{ name: "Produk", category: null, price: Number.NaN }] },
      { ...profile, customerSegments: [] },
      { ...profile, salesChannels: [] },
    ];
    for (const invalidProfile of invalidProfiles) {
      expect(() => generateGrowthRoadmap({ profile: invalidProfile, opportunity, analysis: null })).toThrow(RoadmapInsufficientDataError);
    }
    expect(() => generateGrowthRoadmap({
      profile,
      opportunity: { ...opportunity, trend: { ...opportunity.trend, affectedUserTypes: ["ENTREPRENEUR"] } },
      analysis: null,
    })).toThrow(RoadmapInsufficientDataError);
    expect(() => generateGrowthRoadmap({
      profile,
      opportunity: { ...opportunity, trend: { ...opportunity.trend, lifecycleState: "DRAFT" } },
      analysis: null,
    })).toThrow(RoadmapInsufficientDataError);
  });
});
