import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { EntrepreneurProfile } from "../profile/entrepreneur-profile.model";
import type { BusinessProfile } from "../profile/business-profile.model";
import type { BusinessProduct } from "../profile/business-product.model";
import type { FnbCategory } from "../reference/fnb-category.model";
import type { CustomerSegment } from "../reference/customer-segment.model";
import type { SalesChannel } from "../reference/sales-channel.model";
import type { Opportunity } from "../db/models/opportunity.model";
import type { OpportunityEvidence } from "../db/models/evidence.model";
import type { Roadmap } from "../db/models/roadmap.model";
import type { RoadmapStep } from "../db/models/roadmap-step.model";
import type { Trend } from "../db/models/trend.model";
import type { UserOpportunityAnalysis } from "../db/models/user-opportunity-analysis.model";
import { parseUserId } from "../auth/user-types";
import { USER_TYPES } from "../auth/user-types";
import { RoadmapRepository, type RoadmapRepositoryModels } from "./repository";
import { GROWTH_ROADMAP_STAGES, ROADMAP_STAGES } from "./domain";
import type { Transaction } from "sequelize";
import { Op } from "sequelize";

const userId = parseUserId("10000000-0000-4000-8000-000000000001");

function repositoryWithMocks(overrides: Partial<RoadmapRepositoryModels>) {
  const emptyModel = {};
  return new RoadmapRepository({
    profileModel: emptyModel as typeof EntrepreneurProfile,
    businessProfileModel: emptyModel as typeof BusinessProfile,
    businessProductModel: emptyModel as typeof BusinessProduct,
    opportunityModel: emptyModel as typeof Opportunity,
    trendModel: emptyModel as typeof Trend,
    categoryModel: emptyModel as typeof FnbCategory,
    customerSegmentModel: emptyModel as typeof CustomerSegment,
    salesChannelModel: emptyModel as typeof SalesChannel,
    evidenceModel: emptyModel as typeof OpportunityEvidence,
    analysisModel: emptyModel as typeof UserOpportunityAnalysis,
    roadmapModel: emptyModel as typeof Roadmap,
    stepModel: emptyModel as typeof RoadmapStep,
    ...overrides,
  });
}

describe("RoadmapRepository ownership filters", () => {
  it("combines roadmap id and current owner for detail queries", async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const repository = repositoryWithMocks({ roadmapModel: { findOne } as unknown as typeof Roadmap });
    const roadmapId = "50000000-0000-4000-8000-000000000001";

    await expect(repository.findForUser(userId, USER_TYPES.ENTREPRENEUR, roadmapId)).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: roadmapId, userId, roadmapType: "STARTUP" },
      include: expect.arrayContaining([
        expect.objectContaining({ as: "steps", separate: true, order: [["sequence", "ASC"]] }),
      ]),
    }));
  });

  it("always scopes list retrieval to the session owner", async () => {
    const findAndCountAll = vi.fn().mockResolvedValue({ rows: [], count: 0 });
    const repository = repositoryWithMocks({ roadmapModel: { findAndCountAll } as unknown as typeof Roadmap });
    await repository.listForUser(userId, USER_TYPES.ENTREPRENEUR, { page: 2, pageSize: 5, type: "STARTUP", sort: "createdAt", order: "ASC" });

    expect(findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId, roadmapType: "STARTUP" },
      limit: 5,
      offset: 5,
      order: [["createdAt", "ASC"], ["id", "ASC"]],
    }));
  });

  it("loads only published Opportunities whose Trend audience includes the current type", async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const repository = repositoryWithMocks({ opportunityModel: { findOne } as unknown as typeof Opportunity });
    await repository.loadOpportunityContext("60000000-0000-4000-8000-000000000001", USER_TYPES.ENTREPRENEUR, {} as Transaction);

    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "60000000-0000-4000-8000-000000000001" },
      include: expect.arrayContaining([
        expect.objectContaining({
          as: "relatedTrend",
          required: true,
          where: { lifecycleState: "PUBLISHED", affectedUserTypes: expect.any(Object) },
        }),
      ]),
    }));
    const queryOptions = findOne.mock.calls[0]?.[0] as {
      readonly include: readonly {
        readonly as: string;
        readonly where?: { readonly affectedUserTypes?: unknown };
        readonly separate?: boolean;
        readonly limit?: number;
        readonly order?: readonly (readonly [string, string])[];
      }[];
      readonly order?: readonly unknown[];
    };
    const trendInclude = queryOptions.include.find((item) => item.as === "relatedTrend");
    const evidenceInclude = queryOptions.include.find((item) => item.as === "evidences");
    expect(trendInclude?.where?.affectedUserTypes).toEqual({ [Op.contains]: [USER_TYPES.ENTREPRENEUR] });
    expect(queryOptions.order).toBeUndefined();
    expect(evidenceInclude).toEqual(expect.objectContaining({
      separate: true,
      limit: 10,
      order: [["id", "ASC"]],
    }));
  });

  it("loads a Growth profile and its persisted products, customer segments, and channels", async () => {
    const product = { id: "p1", name: "Kopi susu", price: "25000", isActive: true, category: { name: "Minuman" } };
    const businessProfile = {
      userId,
      profileVersion: 3,
      businessName: "Kedai Pagi",
      businessCategoryId: "10000000-0000-4000-8000-000000000001",
      locationText: "Bandung",
      countryCode: "ID",
      averagePriceMin: "15000",
      averagePriceMax: "35000",
      businessDescription: null,
      products: [product],
      customerSegments: [{ name: "Pekerja kantor" }, { name: "Mahasiswa" }],
      salesChannels: [{ name: "Pesan antar" }, { name: "Gerai" }],
    };
    const findOne = vi.fn().mockResolvedValue(businessProfile);
    const findByPk = vi.fn().mockResolvedValue({ name: "Minuman" });
    const repository = repositoryWithMocks({
      businessProfileModel: { findOne } as unknown as typeof BusinessProfile,
      categoryModel: { findByPk } as unknown as typeof FnbCategory,
    });

    await expect(repository.loadGrowthProfileContext(userId, {} as Transaction)).resolves.toEqual({
      profileVersion: 3,
      businessName: "Kedai Pagi",
      businessCategory: "Minuman",
      locationText: "Bandung",
      countryCode: "ID",
      averagePriceMin: 15_000,
      averagePriceMax: 35_000,
      businessDescription: null,
      products: [{ name: "Kopi susu", category: "Minuman", price: 25_000 }],
      customerSegments: ["Mahasiswa", "Pekerja kantor"],
      salesChannels: ["Gerai", "Pesan antar"],
    });
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { userId } }));
    const query = findOne.mock.calls[0]?.[0] as { readonly include: readonly { readonly as: string; readonly where?: unknown }[] };
    expect(query.include.map(({ as }) => as)).toEqual(["products", "customerSegments", "salesChannels"]);
    expect(query.include[0]).toMatchObject({ as: "products", where: { isActive: true }, separate: true, order: [["name", "ASC"], ["id", "ASC"]] });
  });

  it("creates the header and all steps with the same transaction", async () => {
    const tx = {} as Transaction;
    const now = new Date("2026-10-11T00:00:00.000Z");
    const generationContext = {
      version: "startup-validation-v1",
      method: "MVP_STRUCTURED_VALIDATION",
      contextMode: "LIMITED_CONTEXT",
      profileVersion: 1,
      profileInputs: { location: "Bandung", budgetRange: { min: 1, max: 2, currency: "IDR" }, experienceLevel: "BEGINNER", timeCommitment: "PART_TIME", interests: [], customerSegments: [], salesChannels: [], preferredProductType: null, businessObjective: null },
      opportunity: { id: "60000000-0000-4000-8000-000000000001", name: "Menu", category: "Minuman", trendId: "70000000-0000-4000-8000-000000000002", trendTitle: "Trend", trendSummary: "Ringkasan" },
      evidence: [],
      availableSignals: { opportunityScore: null, fitScore: null, riskLevel: null },
      unavailableInputs: ["Opportunity Score", "Fit Score", "Risk"],
      assumptions: [],
      limitations: [],
    } as const;
    const roadmapCreate = vi.fn().mockResolvedValue({ id: "50000000-0000-4000-8000-000000000001" });
    const roadmapFind = vi.fn().mockResolvedValue({
      id: "50000000-0000-4000-8000-000000000001",
      roadmapType: "STARTUP",
      createdAt: now,
      generationContext,
      opportunity: { id: "60000000-0000-4000-8000-000000000001", name: "Menu" },
    });
    const stepBulkCreate = vi.fn().mockResolvedValue([]);
    const repository = repositoryWithMocks({
      roadmapModel: { create: roadmapCreate, findOne: roadmapFind } as unknown as typeof Roadmap,
      stepModel: { bulkCreate: stepBulkCreate } as unknown as typeof RoadmapStep,
    });
    const steps = ROADMAP_STAGES.map((stage, index) => ({
      sequence: index + 1,
      stage,
      action: "Lakukan tindakan yang dapat diperiksa bersama calon pelanggan.",
      objective: "Menguji asumsi berdasarkan catatan yang dapat ditinjau.",
      timeline: "Sebelum keputusan",
      expectedOutput: "Catatan hasil aktual dan pertanyaan yang masih terbuka.",
    }));

    await repository.createWithSteps({
      userId,
      roadmapType: "STARTUP",
      opportunityId: "60000000-0000-4000-8000-000000000001",
      analysisId: null,
      generationContext,
      steps,
    }, tx);

    expect(roadmapCreate).toHaveBeenCalledWith(expect.objectContaining({ roadmapType: "STARTUP", userId }), { transaction: tx });
    expect(stepBulkCreate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ sequence: 1, stage: ROADMAP_STAGES[0], roadmapId: "50000000-0000-4000-8000-000000000001" }),
      expect.objectContaining({ sequence: 6, stage: ROADMAP_STAGES[5], roadmapId: "50000000-0000-4000-8000-000000000001" }),
    ]), { transaction: tx, returning: true });
  });

  it("persists GROWTH type on the shared roadmap table within the same transaction", async () => {
    const tx = {} as Transaction;
    const now = new Date("2026-10-11T00:00:00.000Z");
    const roadmapCreate = vi.fn().mockResolvedValue({ id: "50000000-0000-4000-8000-000000000002" });
    const roadmapFind = vi.fn().mockResolvedValue({
      id: "50000000-0000-4000-8000-000000000002",
      roadmapType: "GROWTH",
      createdAt: now,
      generationContext: {} as never,
      opportunity: { id: "60000000-0000-4000-8000-000000000001", name: "Menu" },
    });
    const stepBulkCreate = vi.fn().mockResolvedValue([]);
    const repository = repositoryWithMocks({
      roadmapModel: { create: roadmapCreate, findOne: roadmapFind } as unknown as typeof Roadmap,
      stepModel: { bulkCreate: stepBulkCreate } as unknown as typeof RoadmapStep,
    });
    const steps = GROWTH_ROADMAP_STAGES.map((stage, index) => ({
      sequence: index + 1,
      stage,
      action: "Collect and review actual customer and transaction records.",
      objective: "Use recorded evidence before a business decision.",
      timeline: "After the test record is available",
      expectedOutput: "A documented review without estimated margin values.",
    }));

    await repository.createWithSteps({
      userId,
      roadmapType: "GROWTH",
      opportunityId: "60000000-0000-4000-8000-000000000001",
      analysisId: null,
      generationContext: {} as never,
      steps,
    }, tx);

    expect(roadmapCreate).toHaveBeenCalledWith(expect.objectContaining({ roadmapType: "GROWTH", userId }), { transaction: tx });
    expect(stepBulkCreate).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ sequence: 1, stage: "Customer Validation" }),
      expect.objectContaining({ sequence: 5, stage: "Rollout / Revise / Stop" }),
    ]), { transaction: tx, returning: true });
  });
});
