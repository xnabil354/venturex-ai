import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  userIdSchema,
  type SafeUser,
} from "../auth/user-types";
import type {
  ActiveOpportunityScoreModelRecord,
  OpportunityScoreRepositoryPort,
  OpportunityScoreSourceRecord,
} from "../opportunity/opportunity-score-repository";
import {
  OpportunityScoreAccessContextError,
  OpportunityScoreService,
  OpportunityScoreUnauthenticatedError,
} from "./opportunity-score-service";

const opportunityId = "60000000-0000-4000-8000-000000000001";
const user: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

const source: OpportunityScoreSourceRecord = {
  id: opportunityId,
  executionFeasibility: "72.50",
  marketSustainability: "61.00",
  relatedTrend: {
    lifecycleState: "PUBLISHED",
    affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
  },
};

const approvedConfiguration = {
  approvalStatus: "APPROVED",
  normalization: "PRE_NORMALIZED_0_TO_100",
  rounding: { mode: "HALF_UP", decimalPlaces: 2 },
};

const approvedModel: ActiveOpportunityScoreModelRecord = {
  id: "50000000-0000-4000-8000-000000000001",
  version: "synthetic-approved-v1",
  weights: {
    trendMomentum: 0.1,
    demandSignal: 0.2,
    competition: 0.15,
    consumerRelevance: 0.15,
    executionFeasibility: 0.2,
    marketSustainability: 0.2,
  },
  configuration: approvedConfiguration,
  isActive: true,
};

function makeRepository(overrides: Partial<OpportunityScoreRepositoryPort> = {}) {
  const repository: OpportunityScoreRepositoryPort = {
    findActiveModels: vi.fn(async () => []),
    findVisibleSources: vi.fn(async () => [source]),
    ...overrides,
  };
  return repository;
}

describe("OpportunityScoreService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not treat isActive as a separate product approval", async () => {
    const repository = makeRepository({
      findActiveModels: vi.fn(async () => [{
        ...approvedModel,
        configuration: { ...approvedConfiguration, approvalStatus: "PENDING" },
      }]),
    });
    const service = new OpportunityScoreService({
      repository,
      currentUserResolver: async () => user,
    });

    const result = await service.calculateForOpportunity(opportunityId);

    expect(result).toMatchObject({
      status: "INSUFFICIENT_DATA",
      score: null,
      reason: "CONFIGURATION_NOT_APPROVED",
      modelVersion: approvedModel.version,
    });
  });

  it("requires all six authoritative inputs even with an active approved configuration", async () => {
    const repository = makeRepository({
      findActiveModels: vi.fn(async () => [approvedModel]),
    });
    const service = new OpportunityScoreService({
      repository,
      currentUserResolver: async () => user,
    });

    const result = await service.calculateForOpportunity(opportunityId);

    expect(result).toMatchObject({
      status: "INSUFFICIENT_DATA",
      score: null,
      reason: "COMPONENTS_UNAVAILABLE",
      missingComponents: ["trendMomentum", "demandSignal", "competition", "consumerRelevance"],
    });
    expect(result?.sources.competition).toMatchObject({
      status: "UNAVAILABLE",
      explanation: expect.stringContaining("kualitatif"),
    });
    expect(result?.sources.trendMomentum.explanation).toContain("belum menyediakan nilai momentum numerik");
  });

  it("does not infer numeric demand or trend momentum from unsupported persisted fields", async () => {
    const repository = makeRepository({
      findActiveModels: vi.fn(async () => [approvedModel]),
    });
    const service = new OpportunityScoreService({
      repository,
      currentUserResolver: async () => user,
    });

    const result = await service.calculateForOpportunity(opportunityId);
    expect(result?.status).toBe("INSUFFICIENT_DATA");
    if (result?.status === "INSUFFICIENT_DATA") {
      expect(result.missingComponents).toContain("demandSignal");
      expect(result.missingComponents).toContain("trendMomentum");
      expect(result.breakdown.find(({ component }) => component === "demandSignal"))
        .toMatchObject({ normalizedValue: null, weight: 0.2, weightedContribution: null });
    }
  });

  it("reports unavailable or ambiguous model configuration without a fallback score", async () => {
    const unavailableService = new OpportunityScoreService({
      repository: makeRepository(),
      currentUserResolver: async () => user,
    });
    const ambiguousService = new OpportunityScoreService({
      repository: makeRepository({ findActiveModels: vi.fn(async () => [approvedModel, approvedModel]) }),
      currentUserResolver: async () => user,
    });

    expect(await unavailableService.calculateForOpportunity(opportunityId)).toMatchObject({
      status: "INSUFFICIENT_DATA",
      score: null,
      reason: "CONFIGURATION_UNAVAILABLE",
    });
    expect(await ambiguousService.calculateForOpportunity(opportunityId)).toMatchObject({
      status: "INSUFFICIENT_DATA",
      score: null,
      reason: "CONFIGURATION_AMBIGUOUS",
    });
  });

  it("rejects invalid stored numeric inputs rather than scoring them", async () => {
    const repository = makeRepository({
      findVisibleSources: vi.fn(async () => [{ ...source, executionFeasibility: "101.00" }]),
      findActiveModels: vi.fn(async () => [approvedModel]),
    });
    const service = new OpportunityScoreService({ repository, currentUserResolver: async () => user });

    expect(await service.calculateForOpportunity(opportunityId)).toMatchObject({
      status: "INSUFFICIENT_DATA",
      score: null,
      reason: "INVALID_COMPONENTS",
      invalidComponents: ["executionFeasibility"],
    });
  });

  it("uses authenticated user type and returns no result for an ineligible Opportunity", async () => {
    const repository = makeRepository({
      findVisibleSources: vi.fn(async () => []),
    });
    const service = new OpportunityScoreService({ repository, currentUserResolver: async () => user });

    expect(await service.calculateForOpportunity(opportunityId)).toBeNull();
    expect(repository.findVisibleSources).toHaveBeenCalledWith(USER_TYPES.ENTREPRENEUR, [opportunityId]);
    expect(repository.findActiveModels).not.toHaveBeenCalled();
  });

  it("returns only eligible requested Opportunities for a Finder page", async () => {
    const secondId = "60000000-0000-4000-8000-000000000002";
    const repository = makeRepository({
      findVisibleSources: vi.fn(async () => [{ ...source, id: secondId }]),
      findActiveModels: vi.fn(async () => []),
    });
    const service = new OpportunityScoreService({ repository, currentUserResolver: async () => user });

    const result = await service.calculateForOpportunities([opportunityId, secondId]);
    expect(Object.keys(result)).toEqual([secondId]);
    expect(repository.findVisibleSources).toHaveBeenCalledWith(USER_TYPES.ENTREPRENEUR, [opportunityId, secondId]);
  });

  it("requires an authenticated, completed account context", async () => {
    const repository = makeRepository();
    const anonymous = new OpportunityScoreService({ repository, currentUserResolver: async () => null });
    const incomplete = new OpportunityScoreService({
      repository,
      currentUserResolver: async () => ({ ...user, userType: null }),
    });

    await expect(anonymous.calculateForOpportunity(opportunityId))
      .rejects.toBeInstanceOf(OpportunityScoreUnauthenticatedError);
    await expect(incomplete.calculateForOpportunity(opportunityId))
      .rejects.toBeInstanceOf(OpportunityScoreAccessContextError);
    expect(repository.findVisibleSources).not.toHaveBeenCalled();
  });

  it("fails closed if a repository returns an ineligible Trend relationship", async () => {
    const repository = makeRepository({
      findVisibleSources: vi.fn(async () => [{
        ...source,
        relatedTrend: { lifecycleState: "DRAFT", affectedUserTypes: [] },
      }]),
    });
    const service = new OpportunityScoreService({ repository, currentUserResolver: async () => user });

    await expect(service.calculateForOpportunity(opportunityId)).rejects.toThrow("ineligible Opportunity");
    expect(repository.findActiveModels).not.toHaveBeenCalled();
  });
});
