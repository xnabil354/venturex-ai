import { describe, expect, it } from "vitest";
import { aggregateAnalysisScore, calculateEntrepreneurDecision, summarizeTrend } from "./entrepreneur-decision-score";
import type { EntrepreneurOpportunityProfileContext } from "../opportunity/opportunity-analysis-context";
import type { EntrepreneurRequirements } from "../opportunity/entrepreneur-analysis-contract";
import { normalizeCompetitorSample } from "../trend/searchapi-competitor-sample";

const category = "11111111-1111-4111-8111-111111111111";
const segment = "22222222-2222-4222-8222-222222222222";
const channel = "33333333-3333-4333-8333-333333333333";
const profile: EntrepreneurOpportunityProfileContext = { persona: "ENTREPRENEUR", preferredProductType: "Bakso ayam", categories: ["Makanan"], customerSegments: ["Keluarga"], salesChannels: ["Gerai"], budget: { min: 500000, max: 1000000, currency: "IDR" }, location: { text: "Jakarta", city: "Jakarta", province: "DKI Jakarta" }, experienceLevel: "BEGINNER", timeCommitment: "PART_TIME", businessObjective: null, notes: null };
const requirements: EntrepreneurRequirements = { categoryId: category, customerSegmentIds: [segment], salesChannelIds: [channel], requiredExperience: "BEGINNER", requiredTime: "PART_TIME", complexity: "SIMPLE", summary: "Uji konsep bakso ayam untuk keluarga.", rationale: "Target dan kanal dapat diuji dengan skala kecil.", initialNeeds: ["Siapkan bahan dan perlengkapan uji."], assumptions: ["Calon pembeli perlu mencoba sebelum memutuskan."] };
const series = { query: "bakso ayam", points: Array.from({ length: 53 }, (_, index) => ({ timestamp: 1700000000 + index * 7 * 86400, label: String(index), interestIndex: 60 })), averageInterest: 60, omittedInvalidPoints: 0 };
const trend = summarizeTrend(series, "ID", "2026-10-21T00:00:00.000Z");
const selections = { categoryIds: [category], segmentIds: [segment], channelIds: [channel] };

describe("entrepreneur decision scoring", () => {
  it("uses stable-series neutral momentum, relative interest, and maximum search stability", () => {
    const result = calculateEntrepreneurDecision({ profile, selections, requirements, capitalMin: 500000, trend, competitors: null, fallbackInterest: null });
    expect(result.opportunity.factors.find(row => row.key === "trendMomentum")?.value).toBe(50);
    expect(result.opportunity.factors.find(row => row.key === "demandSignal")?.value).toBe(60);
    expect(result.opportunity.factors.find(row => row.key === "marketSustainability")?.value).toBe(100);
    expect(result.opportunity.coverage).toBe(85);
    expect(result.opportunity.score).toBeCloseTo(64.5 / 0.85, 2);
    expect(result.fit.score).toBe(100);
  });
  it("does not turn a lone perfect Top query into an overall score", () => {
    const result = calculateEntrepreneurDecision({ profile, selections, requirements: null, capitalMin: null, trend: null, competitors: null, fallbackInterest: 100 });
    expect(result.opportunity.score).toBeNull();
    expect(result.opportunity.coverage).toBe(20);
    expect(result.fit.score).toBeNull();
  });
  it("computes preliminary Fit with missing capital and distinguishes budget overrun", () => {
    const base = { profile, selections, requirements, trend: null, competitors: null, fallbackInterest: null };
    const missing = calculateEntrepreneurDecision({ ...base, capitalMin: null });
    expect(missing.fit.score).toBe(100);
    expect(missing.fit.coverage).toBe(70);
    expect(missing.fit.factors.find(row => row.key === "budgetFit")?.value).toBeNull();
    const overrun = calculateEntrepreneurDecision({ ...base, capitalMin: 2000000 });
    expect(overrun.fit.score).toBe(85);
    expect(overrun.risks.some(text => text.includes("melebihi budget"))).toBe(true);
  });
  it("never interprets an empty listing sample as no competition", () => {
    const result = calculateEntrepreneurDecision({ profile, selections, requirements, capitalMin: null, trend, competitors: { query: "bakso Jakarta", city: "Jakarta", retrievedAt: "2026-10-21T00:00:00.000Z", sampleCount: 0, places: [] }, fallbackInterest: null });
    expect(result.opportunity.factors.find(row => row.key === "competition")?.value).toBeNull();
  });
  it("requires real time coverage and does not invent stability from a short series", () => {
    const short = summarizeTrend({ ...series, points: series.points.slice(0, 4) }, "ID", "2026-10-21T00:00:00.000Z");
    const result = calculateEntrepreneurDecision({ profile, selections, requirements, capitalMin: null, trend: short, competitors: null, fallbackInterest: 60 });
    expect(result.opportunity.factors.find(row => row.key === "trendMomentum")?.value).toBeNull();
    expect(result.opportunity.factors.find(row => row.key === "marketSustainability")?.value).toBeNull();
  });
  it("deduplicates timestamps and keeps all-zero history unknown for momentum and stability", () => {
    const zero = summarizeTrend({ ...series, points: [...series.points.map(point => ({ ...point, interestIndex: 0 })), { ...series.points[0]!, interestIndex: 0 }] }, "ID", "2026-10-21T00:00:00.000Z");
    expect(zero.count).toBe(53);
    expect(zero.coefficientOfVariation).toBeNull();
    const result = calculateEntrepreneurDecision({ profile, selections, requirements, capitalMin: null, trend: zero, competitors: null, fallbackInterest: null });
    expect(result.opportunity.factors.find(row => row.key === "trendMomentum")?.value).toBeNull();
  });
  it("rejects invalid weights and non-finite component values", () => {
    expect(() => aggregateAnalysisScore([{ key: "bad", label: "Bad", weight: 0.5, value: 100, basis: "MARKET", reason: "test" }])).toThrow();
    expect(() => aggregateAnalysisScore([{ key: "bad", label: "Bad", weight: 1, value: NaN, basis: "MARKET", reason: "test" }])).toThrow();
  });
});

describe("competitor sample normalization", () => {
  it("keeps only bounded local rows, deduplicates IDs, and constructs safe Maps links", () => {
    const sample = normalizeCompetitorSample({ local_results: [{ title: "Bakso A", address: "Kota Jakarta Selatan", place_id: "place-a" }, { title: "Bakso A", address: "Jakarta Selatan", place_id: "place-a" }, { title: "Bakso B", address: "Bandung" }, { title: "Incomplete" }] }, "bakso Jakarta Selatan", "Jakarta Selatan", "2026-10-21T00:00:00.000Z");
    expect(sample.sampleCount).toBe(1);
    expect(sample.places[0]?.url.startsWith("https://www.google.com/maps/search/")).toBe(true);
  });
  it("rejects provider error payloads instead of converting errors into empty evidence", () => {
    expect(() => normalizeCompetitorSample({ error: "quota" }, "bakso", "Jakarta", "2026-10-21T00:00:00.000Z")).toThrow();
  });
});
