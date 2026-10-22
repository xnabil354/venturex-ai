import { privateEntrepreneurFixture } from "./private-entrepreneur";
import { BUSINESS_CONCEPT_ALIGNMENT_VERSION, businessAnalysisSchema, type BusinessRequirements } from "../business-analysis-contract";
import { calculateBusinessDecision } from "../../scoring/business-decision-score";

export const businessCategoryId = "11111111-1111-4111-8111-111111111111";
export const businessSegmentId = "22222222-2222-4222-8222-222222222222";
export const businessChannelId = "33333333-3333-4333-8333-333333333333";
export const businessRequirements: BusinessRequirements = { categoryId: businessCategoryId, customerSegmentIds: [businessSegmentId], salesChannelIds: [businessChannelId], complexity: "SIMPLE", summary: "Uji penawaran tambahan pada bisnis berjalan.", rationale: "Kebutuhan pelanggan harus diuji terlebih dahulu.", initialNeeds: ["Siapkan contoh penawaran dan catat proses aktual."], assumptions: ["Respons pembeli masih belum diketahui."] };
export const businessSelections = { categoryIds: [businessCategoryId], segmentIds: [businessSegmentId], channelIds: [businessChannelId], averagePrice: { min: 10000, max: 20000 } };
export function privateBusinessFixture() {
  const base = privateEntrepreneurFixture();
  const { analysis: _analysis, ...hypothesis } = base.hypothesis;
  const trend = { query: "Bakso ayam", geo: "ID", period: "1y" as const, retrievedAt: "2026-10-22T00:00:00.000Z", count: 53, observedMonths: 12, spanDays: 364, recentMean: 60, previousMean: 50, positiveFraction: 1, coefficientOfVariation: .1 };
  const competitors = { query: "Bakso Jakarta", city: "Jakarta", retrievedAt: trend.retrievedAt, sampleCount: 2, places: [] };
  const decision = calculateBusinessDecision({ selections: businessSelections, requirements: businessRequirements, proposedPrice: { min: 12000, max: 18000 }, trend, competitors, fallbackInterest: null });
  const businessAnalysis = businessAnalysisSchema.parse({ version: "business-decision-v1", conceptAlignmentVersion: BUSINESS_CONCEPT_ALIGNMENT_VERSION, generatedAt: trend.retrievedAt, inputFingerprint: "b".repeat(64), model: "test-model", requirements: businessRequirements, proposedPrice: { min: 12000, max: 18000 }, ...decision, targetConsumer: "Keluarga sekitar bisnis", competition: "Sampel lokal terbatas; bukan sensus pesaing.", trend, competitors, warnings: ["Data sintetis untuk pengujian; bukan bukti pasar."] });
  return { ...base, hypothesis: { ...hypothesis, businessAnalysis } };
}
