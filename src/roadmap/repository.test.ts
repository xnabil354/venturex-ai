import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { EntrepreneurProfile } from "../profile/entrepreneur-profile.model";
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
import { ROADMAP_STAGES } from "./domain";
import type { Transaction } from "sequelize";
import { Op } from "sequelize";

const userId = parseUserId("10000000-0000-4000-8000-000000000001");

function repositoryWithMocks(overrides: Partial<RoadmapRepositoryModels>) {
  const emptyModel = {};
  return new RoadmapRepository({
    profileModel: emptyModel as typeof EntrepreneurProfile,
    opportunityModel: emptyModel as typeof Opportunity,
    trendModel: emptyModel as typeof Trend,
    categoryModel: emptyModel as typeof FnbCategory,
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

    await expect(repository.findForUser(userId, roadmapId)).resolves.toBeNull();
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: roadmapId, userId },
      include: expect.arrayContaining([
        expect.objectContaining({ as: "steps", separate: true, order: [["sequence", "ASC"]] }),
      ]),
    }));
  });

  it("always scopes list retrieval to the session owner", async () => {
    const findAndCountAll = vi.fn().mockResolvedValue({ rows: [], count: 0 });
    const repository = repositoryWithMocks({ roadmapModel: { findAndCountAll } as unknown as typeof Roadmap });
    await repository.listForUser(userId, { page: 2, pageSize: 5, type: "STARTUP", sort: "createdAt", order: "ASC" });

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
    const queryOptions = findOne.mock.calls[0]?.[0] as { readonly include: readonly { readonly as: string; readonly where?: { readonly affectedUserTypes?: unknown } }[] };
    const trendInclude = queryOptions.include.find((item) => item.as === "relatedTrend");
    expect(trendInclude?.where?.affectedUserTypes).toEqual({ [Op.contains]: [USER_TYPES.ENTREPRENEUR] });
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
});
