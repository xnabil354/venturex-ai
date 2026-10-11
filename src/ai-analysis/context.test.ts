import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import type { OpportunityFitInputContext } from "../opportunity/fit-input-context";
import type { FitScoreMvpResult } from "../scoring/fit-score-mvp";
import type { OpportunityScoreServiceResult } from "../scoring/opportunity-score-service";
import type { RiskAssessmentDisplayState } from "../scoring/risk-assessment-service";
import { AIAnalysisProfileIncompleteError } from "./domain";
import { OpportunityAnalysisContextBuilder, type AnalysisReferenceNames, type TrendSource } from "./context";
import { TEST_OPPORTUNITY_ID, testUser } from "./test-fixtures";

const categoryId = "80000000-0000-4000-8000-000000000001";
const segmentId = "90000000-0000-4000-8000-000000000001";
const channelId = "a0000000-0000-4000-8000-000000000001";

function fitContext(userType: "ENTREPRENEUR" | "UMKM_EXISTING"): OpportunityFitInputContext {
  const opportunity: OpportunityFitInputContext["opportunity"] = {
    id: TEST_OPPORTUNITY_ID,
    fnbCategoryId: categoryId,
    relatedTrend: { id: "70000000-0000-4000-8000-000000000001", lifecycleState: "PUBLISHED", affectedUserTypes: [userType] },
    requirements: {
      capitalMin: "20",
      capitalMax: "80",
      expectedPriceMin: "15",
      expectedPriceMax: "35",
      requiredExperienceLevel: "BEGINNER",
      requiredTimeCommitment: "PART_TIME",
      operationalComplexity: null,
      locationScope: "Kota Contoh",
      metadata: {},
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    customerSegmentIds: [segmentId],
    salesChannelIds: [channelId],
  };
  if (userType === "ENTREPRENEUR") {
    return {
      userType,
      opportunity,
      profile: {
        profileVersion: 2,
        locationText: "Kota Contoh",
        city: "Kota Contoh",
        province: "Provinsi Contoh",
        budgetMin: 10,
        budgetMax: 100,
        preferredProductType: "Minuman",
        experienceLevel: "BEGINNER",
        timeCommitment: "PART_TIME",
        interestCategoryIds: [categoryId],
        customerSegmentIds: [segmentId],
        salesChannelIds: [channelId],
      },
    };
  }
  return {
    userType,
    opportunity,
    profile: {
      profileVersion: 4,
      businessCategoryId: categoryId,
      locationText: "Kota Contoh",
      city: "Kota Contoh",
      province: "Provinsi Contoh",
      averagePriceMin: 15,
      averagePriceMax: 35,
      businessDescription: "Deskripsi usaha yang ditulis pemilik.",
      operationModel: null,
      products: [{ fnbCategoryId: categoryId, price: 25 }],
      customerSegmentIds: [segmentId],
      salesChannelIds: [channelId],
    },
  };
}

const detail = {
  id: TEST_OPPORTUNITY_ID,
  name: "Menu contoh",
  description: "Deskripsi katalog untuk peluang F&B.",
  categoryName: "Minuman",
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: "Konsumen lokal.",
  competitionLevel: "MEDIUM",
  competitionSummary: "Ringkasan persaingan dari katalog.",
  relatedTrend: { id: "70000000-0000-4000-8000-000000000001", title: "Trend pilihan minuman" },
};

const trend: TrendSource = {
  title: "Trend pilihan minuman",
  signalSummary: "Ringkasan terpublikasi.",
  signalDescription: "Deskripsi trend yang disimpan.",
  businessRelevanceExplanation: "Relevansi F&B yang disimpan.",
  direction: "RISING",
  periodStart: "2026-01-01",
  periodEnd: "2026-06-30",
  evidence: [{ sourceName: "Sumber Trend", sourceReference: "Referensi-1", supportingDetail: "Dukungan terukur dari sumber.", sourceDate: "2026-05-01", limitations: null }],
};

const references: AnalysisReferenceNames = {
  categories: new Map([[categoryId, "Minuman"]]),
  customerSegments: new Map([[segmentId, "Mahasiswa"]]),
  salesChannels: new Map([[channelId, "Gerai"]]),
};

function createBuilder(input: OpportunityFitInputContext) {
  const fitContextService = { getForOpportunity: vi.fn().mockResolvedValue(input) };
  const opportunityService = { getDetail: vi.fn().mockResolvedValue(detail) };
  const evidenceService = { listForOpportunity: vi.fn().mockResolvedValue({ status: "AVAILABLE", limited: false, items: [{ sourceName: "Sumber Opportunity", sourceType: "Open Data", sourceDateLabel: "Tanggal sumber (UTC): 2026-05-01", retrievedAtLabel: "Data diambil.", sourceReference: "Tabel-2", sourceUrl: "https://example.test/source", limitations: [] }] }) };
  const opportunityScoreService = { calculateForOpportunity: vi.fn().mockResolvedValue({ status: "INSUFFICIENT_DATA", modelType: "OPPORTUNITY_SCORE", modelVersion: null, score: null, breakdown: [], missingComponents: [], invalidComponents: [], reason: "CONFIGURATION_UNAVAILABLE", sources: {}, disclaimer: "" } as unknown as OpportunityScoreServiceResult) };
  const riskAssessmentService = { assessForOpportunity: vi.fn().mockResolvedValue({ status: "INSUFFICIENT_DATA", modelType: "RISK", modelVersion: null, level: null, reason: "CONFIGURATION_NOT_APPROVED", missingFactors: [], evidenceReferences: [], limitations: [] } as RiskAssessmentDisplayState) };
  const fitScoreCalculator = vi.fn().mockReturnValue({ status: "AVAILABLE", score: 75, policyVersion: "FIT_MVP_HEURISTIC_V1" } as unknown as FitScoreMvpResult);
  const trendRepository = { findPublishedForUser: vi.fn().mockResolvedValue(trend) };
  const referenceRepository = { resolve: vi.fn().mockResolvedValue(references) };
  return {
    builder: new OpportunityAnalysisContextBuilder({ fitContextService, opportunityService, evidenceService, opportunityScoreService, riskAssessmentService, fitScoreCalculator, trendRepository, referenceRepository }),
    mocks: { fitContextService, opportunityService, evidenceService, opportunityScoreService, riskAssessmentService, fitScoreCalculator, trendRepository, referenceRepository },
  };
}

describe("OpportunityAnalysisContextBuilder", () => {
  it.each(["ENTREPRENEUR", "UMKM_EXISTING"] as const)("builds a trusted personalized context for %s", async (userType) => {
    const { builder, mocks } = createBuilder(fitContext(userType));
    const result = await builder.build(testUser(userType) as ReturnType<typeof testUser> & { userType: "ENTREPRENEUR" | "UMKM_EXISTING" }, TEST_OPPORTUNITY_ID);

    expect(result?.profile.type).toBe(userType);
    expect(result?.opportunity.id).toBe(TEST_OPPORTUNITY_ID);
    expect(result?.opportunity.requirements.capitalMinIdr).toBe("20");
    expect(result?.trend.evidence[0]?.sourceReference).toBe("Referensi-1");
    expect(result?.evidence.opportunity[0]).toMatchObject({ sourceName: "Sumber Opportunity", sourceReference: "Tabel-2" });
    expect(result?.fitScore).toMatchObject({ status: "AVAILABLE", score: 75 });
    expect(result?.opportunityScore).toMatchObject({ status: "INSUFFICIENT_DATA", score: null });
    expect(result?.riskAssessment).toMatchObject({ status: "INSUFFICIENT_DATA", level: null });
    expect(mocks.fitContextService.getForOpportunity).toHaveBeenCalledWith(TEST_OPPORTUNITY_ID);
    expect(mocks.referenceRepository.resolve).toHaveBeenCalledWith(expect.objectContaining({ customerSegmentIds: [segmentId], salesChannelIds: [channelId] }));
  });

  it("resolves reference IDs to names and excludes unrelated profile fields", async () => {
    const { builder } = createBuilder(fitContext("ENTREPRENEUR"));
    const result = await builder.build(testUser() as ReturnType<typeof testUser> & { userType: "ENTREPRENEUR" }, TEST_OPPORTUNITY_ID);
    expect(result?.profile).toMatchObject({ interests: ["Minuman"], targetCustomers: ["Mahasiswa"], salesChannels: ["Gerai"] });
    expect(JSON.stringify(result)).not.toContain("synthetic-user@example.test");
    expect(JSON.stringify(result)).not.toContain("password");
  });

  it("rejects missing role-specific profile and hidden Opportunity context", async () => {
    const incomplete = fitContext("ENTREPRENEUR");
    const missingProfile: OpportunityFitInputContext = { ...incomplete, profile: null };
    const missingBuilder = createBuilder(missingProfile).builder;
    await expect(missingBuilder.build(testUser() as ReturnType<typeof testUser> & { userType: "ENTREPRENEUR" }, TEST_OPPORTUNITY_ID)).rejects.toBeInstanceOf(AIAnalysisProfileIncompleteError);

    const hiddenBuilder = createBuilder(fitContext("ENTREPRENEUR"));
    vi.mocked(hiddenBuilder.mocks.opportunityService.getDetail).mockResolvedValueOnce(null);
    await expect(hiddenBuilder.builder.build(testUser() as ReturnType<typeof testUser> & { userType: "ENTREPRENEUR" }, TEST_OPPORTUNITY_ID)).resolves.toBeNull();
  });

  it("changes its fingerprint when current profile context changes", async () => {
    const original = fitContext("ENTREPRENEUR");
    if (original.userType !== "ENTREPRENEUR") throw new Error("Expected an Entrepreneur fixture.");
    const changed: OpportunityFitInputContext = { ...original, profile: { ...original.profile!, profileVersion: 3 } };
    const firstBuilder = createBuilder(original).builder;
    const secondBuilder = createBuilder(changed).builder;
    const first = await firstBuilder.build(testUser() as ReturnType<typeof testUser> & { userType: "ENTREPRENEUR" }, TEST_OPPORTUNITY_ID);
    const second = await secondBuilder.build(testUser() as ReturnType<typeof testUser> & { userType: "ENTREPRENEUR" }, TEST_OPPORTUNITY_ID);
    expect(first?.contextFingerprint).not.toBe(second?.contextFingerprint);
  });
});
