import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  userIdSchema,
  type SafeUser,
} from "../auth/user-types";
import type { UserType } from "../auth/user-types";
import type {
  ActiveRiskModelRecord,
  RiskAssessmentRepositoryPort,
  RiskAssessmentSourceRecord,
} from "../opportunity/risk-assessment-repository";
import {
  RiskAssessmentAccessContextError,
  RiskAssessmentService,
  RiskAssessmentUnauthenticatedError,
} from "./risk-assessment-service";
import type { RiskAssessmentInputs } from "./risk-assessment";

const opportunityId = "60000000-0000-4000-8000-000000000001";
const secondOpportunityId = "60000000-0000-4000-8000-000000000002";
const user: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

const inputs: RiskAssessmentInputs = {
  competitionLevel: { value: "Tinggi", source: "Tingkat kompetisi tersimpan", reference: "opportunities.competition_level" },
  capitalMin: { value: "1000000", source: "Modal minimum tersimpan", reference: "opportunity_fit_requirements.capital_min" },
  capitalMax: { value: "5000000", source: "Modal maksimum tersimpan", reference: "opportunity_fit_requirements.capital_max" },
  operationalComplexity: { value: "75.00", source: "Kompleksitas operasional tersimpan", reference: "opportunity_fit_requirements.operational_complexity" },
  executionFeasibility: { value: "65.00", source: "Execution Feasibility tersimpan", reference: "opportunities.execution_feasibility" },
  marketSustainability: { value: "60.00", source: "Market Sustainability tersimpan", reference: "opportunities.market_sustainability" },
};

const source: RiskAssessmentSourceRecord = {
  id: opportunityId,
  inputs,
  evidenceReferences: [{
    sourceName: "Laporan resmi",
    sourceReference: "Dataset 4",
    sourceUrl: "https://example.org/dataset",
  }],
  relatedTrend: {
    lifecycleState: "PUBLISHED",
    affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
  },
};

const approvedConfiguration = {
  approvalStatus: "APPROVED",
  riskPolicy: {
    aggregation: "HIGHEST_RISK",
    requiredFactors: ["executionComplexity"],
    rules: [{
      factor: "executionComplexity",
      source: "operationalComplexity",
      kind: "NUMERIC_THRESHOLDS",
      unit: "/100",
      direction: "HIGHER_IS_RISKIER",
      mediumThreshold: 40,
      highThreshold: 70,
    }],
    limitations: ["Synthetic policy used only by this isolated test."],
  },
};

const approvedModel: ActiveRiskModelRecord = {
  id: "50000000-0000-4000-8000-000000000001",
  modelType: "RISK",
  version: "synthetic-approved-risk-v1",
  weights: {},
  configuration: approvedConfiguration,
  isActive: true,
};

function makeRepository(overrides: Partial<RiskAssessmentRepositoryPort> = {}) {
  const repository: RiskAssessmentRepositoryPort = {
    findActiveModels: vi.fn(async () => []),
    findVisibleSources: vi.fn(async () => [source]),
    ...overrides,
  };
  return repository;
}

describe("RiskAssessmentService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assesses an eligible Opportunity with an active approved policy and reports the model version", async () => {
    const repository = makeRepository({
      findActiveModels: vi.fn(async () => [approvedModel]),
    });
    const service = new RiskAssessmentService({ repository, currentUserResolver: async () => user });

    await expect(service.assessForOpportunity(opportunityId)).resolves.toMatchObject({
      status: "ASSESSED",
      modelType: "RISK",
      modelVersion: approvedModel.version,
      level: "HIGH",
      reasons: [expect.stringContaining("75.00 /100")],
      factorsConsidered: [{ factor: "executionComplexity", sourceReference: "opportunity_fit_requirements.operational_complexity" }],
    });
    expect(repository.findVisibleSources).toHaveBeenCalledWith(USER_TYPES.ENTREPRENEUR, [opportunityId]);
  });

  it("does not treat isActive=true as product approval", async () => {
    const repository = makeRepository({
      findActiveModels: vi.fn(async () => [{
        ...approvedModel,
        configuration: { ...approvedConfiguration, approvalStatus: "PENDING" },
      }]),
    });
    const result = await new RiskAssessmentService({ repository, currentUserResolver: async () => user })
      .assessForOpportunity(opportunityId);

    expect(result).toMatchObject({
      status: "INSUFFICIENT_DATA",
      level: null,
      reason: "CONFIGURATION_NOT_APPROVED",
      modelVersion: approvedModel.version,
    });
  });

  it("returns insufficient states for missing, ambiguous, and inactive configurations", async () => {
    const makeService = (models: readonly ActiveRiskModelRecord[]) => new RiskAssessmentService({
      repository: makeRepository({ findActiveModels: vi.fn(async () => models) }),
      currentUserResolver: async () => user,
    });

    expect(await makeService([]).assessForOpportunity(opportunityId)).toMatchObject({
      status: "INSUFFICIENT_DATA",
      level: null,
      reason: "CONFIGURATION_UNAVAILABLE",
    });
    expect(await makeService([approvedModel, approvedModel]).assessForOpportunity(opportunityId)).toMatchObject({
      status: "INSUFFICIENT_DATA",
      level: null,
      reason: "CONFIGURATION_AMBIGUOUS",
    });
    expect(await makeService([{ ...approvedModel, isActive: false }]).assessForOpportunity(opportunityId))
      .toMatchObject({ status: "INSUFFICIENT_DATA", level: null, reason: "CONFIGURATION_UNAVAILABLE" });
  });

  it("does not return a level for an invalid policy or missing required input", async () => {
    const invalidModel = {
      ...approvedModel,
      configuration: {
        ...approvedConfiguration,
        riskPolicy: {
          ...approvedConfiguration.riskPolicy,
          requiredFactors: ["trendVolatility"],
          rules: [{
            factor: "trendVolatility",
            source: "capitalMin",
            kind: "NUMERIC_THRESHOLDS",
            unit: "IDR",
            direction: "HIGHER_IS_RISKIER",
            mediumThreshold: 2_000_000,
            highThreshold: 4_000_000,
          }],
        },
      },
    };
    const invalidService = new RiskAssessmentService({
      repository: makeRepository({ findActiveModels: vi.fn(async () => [invalidModel]) }),
      currentUserResolver: async () => user,
    });
    const missingService = new RiskAssessmentService({
      repository: makeRepository({
        findVisibleSources: vi.fn(async () => [{
          ...source,
          inputs: {
            ...inputs,
            operationalComplexity: { ...inputs.operationalComplexity, value: null },
          },
        }]),
        findActiveModels: vi.fn(async () => [approvedModel]),
      }),
      currentUserResolver: async () => user,
    });

    const invalidResult = await invalidService.assessForOpportunity(opportunityId);
    expect(invalidResult)
      .toMatchObject({ status: "INSUFFICIENT_DATA", level: null, reason: "INVALID_CONFIGURATION" });
    expect(invalidResult).not.toHaveProperty("reasons");
    expect(await missingService.assessForOpportunity(opportunityId))
      .toMatchObject({ status: "INSUFFICIENT_DATA", level: null, reason: "REQUIRED_INPUTS_UNAVAILABLE" });
  });

  it("rejects a mismatched capital unit even when the active model is approved", async () => {
    const invalidUnitModel: ActiveRiskModelRecord = {
      ...approvedModel,
      configuration: {
        ...approvedConfiguration,
        riskPolicy: {
          modelType: "RISK",
          version: "synthetic-approved-risk-v1",
          aggregation: "HIGHEST_RISK",
          requiredFactors: ["capitalRequirement"],
          rules: [{
            factor: "capitalRequirement",
            source: "capitalMin",
            kind: "NUMERIC_THRESHOLDS",
            unit: "USD",
            direction: "HIGHER_IS_RISKIER",
            mediumThreshold: 2_000_000,
            highThreshold: 4_000_000,
          }],
          limitations: ["Synthetic policy used only by this isolated test."],
        },
      },
    };
    const service = new RiskAssessmentService({
      repository: makeRepository({ findActiveModels: vi.fn(async () => [invalidUnitModel]) }),
      currentUserResolver: async () => user,
    });

    const result = await service.assessForOpportunity(opportunityId);
    expect(result).toMatchObject({
      status: "INSUFFICIENT_DATA",
      level: null,
      reason: "INVALID_CONFIGURATION",
      modelVersion: approvedModel.version,
    });
    expect(result).not.toHaveProperty("reasons");
    expect(result).not.toHaveProperty("factorsConsidered");
  });

  it("returns null for an Opportunity outside published audience eligibility", async () => {
    const repository = makeRepository({ findVisibleSources: vi.fn(async () => []) });
    const service = new RiskAssessmentService({ repository, currentUserResolver: async () => user });

    await expect(service.assessForOpportunity(opportunityId)).resolves.toBeNull();
    expect(repository.findVisibleSources).toHaveBeenCalledWith(USER_TYPES.ENTREPRENEUR, [opportunityId]);
    expect(repository.findActiveModels).not.toHaveBeenCalled();
  });

  it("fails closed if a repository returns an unpublished or wrong-audience Trend", async () => {
    const repository = makeRepository({
      findVisibleSources: vi.fn(async () => [{
        ...source,
        relatedTrend: { lifecycleState: "DRAFT", affectedUserTypes: [] },
      }]),
    });
    const result = await new RiskAssessmentService({ repository, currentUserResolver: async () => user })
      .assessForOpportunity(opportunityId);

    expect(result).toEqual({ status: "ERROR" });
    expect(repository.findActiveModels).not.toHaveBeenCalled();
  });

  it("uses one batched source and policy query for Finder Opportunities", async () => {
    const repository = makeRepository({
      findVisibleSources: vi.fn(async (_userType: UserType, ids: readonly string[]) =>
        ids.map((id) => ({ ...source, id } as RiskAssessmentSourceRecord))),
      findActiveModels: vi.fn(async () => [approvedModel]),
    });
    const service = new RiskAssessmentService({ repository, currentUserResolver: async () => user });

    const result = await service.assessForOpportunities([opportunityId, secondOpportunityId, opportunityId]);
    expect(Object.keys(result)).toEqual([opportunityId, secondOpportunityId]);
    expect(repository.findVisibleSources).toHaveBeenCalledExactlyOnceWith(
      USER_TYPES.ENTREPRENEUR,
      [opportunityId, secondOpportunityId],
    );
    expect(repository.findActiveModels).toHaveBeenCalledOnce();
  });

  it("returns a safe ERROR state when repository queries fail", async () => {
    const repository = makeRepository({
      findVisibleSources: vi.fn(async () => { throw new Error("database internals"); }),
    });
    const result = await new RiskAssessmentService({ repository, currentUserResolver: async () => user })
      .assessForOpportunity(opportunityId);

    expect(result).toEqual({ status: "ERROR" });
    expect(JSON.stringify(result)).not.toContain("database internals");
  });

  it("requires an authenticated, completed account context", async () => {
    const repository = makeRepository();
    const anonymous = new RiskAssessmentService({ repository, currentUserResolver: async () => null });
    const incomplete = new RiskAssessmentService({
      repository,
      currentUserResolver: async () => ({ ...user, userType: null }),
    });

    await expect(anonymous.assessForOpportunity(opportunityId)).rejects.toBeInstanceOf(RiskAssessmentUnauthenticatedError);
    await expect(incomplete.assessForOpportunity(opportunityId)).rejects.toBeInstanceOf(RiskAssessmentAccessContextError);
    expect(repository.findVisibleSources).not.toHaveBeenCalled();
  });
});
