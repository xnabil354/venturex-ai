import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser, type UserType } from "../auth/user-types";
import type { FitScoreMvpResult } from "../scoring/fit-score-mvp";
import type { OpportunityScoreServiceResult } from "../scoring/opportunity-score-service";
import type { RiskAssessmentDisplayState } from "../scoring/risk-assessment-service";
import { RISK_FACTORS } from "../scoring/risk-assessment";
import type { OpportunityComparisonRepositoryPort, OpportunityComparisonSource } from "./compare-domain";
import {
  OpportunityComparisonAccessContextError,
  OpportunityComparisonInvalidRequestError,
  OpportunityComparisonResourceNotFoundError,
  OpportunityComparisonService,
  OpportunityComparisonUnauthenticatedError,
  type OpportunityComparisonScoringPort,
} from "./compare-service";

const ids = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
  "60000000-0000-4000-8000-000000000003",
] as const;
const fourthId = "60000000-0000-4000-8000-000000000004";

const baseUser: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

function source(
  id: string,
  userType: UserType = USER_TYPES.ENTREPRENEUR,
  overrides: Partial<OpportunityComparisonSource> = {},
): OpportunityComparisonSource {
  return {
    id,
    name: `Opportunity ${id.slice(-1)}`,
    categoryName: "Minuman",
    competitionLevel: "MEDIUM",
    competitionSummary: "Persaingan perlu diverifikasi di area target.",
    executionFeasibility: "75.00",
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      title: "Tren minuman",
      direction: "RISING",
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [userType],
    },
    ...overrides,
  };
}

const availableScore = {
  status: "AVAILABLE",
  score: 72.5,
} as OpportunityScoreServiceResult;

const availableFit = {
  status: "AVAILABLE",
  score: 81.25,
} as FitScoreMvpResult;

const availableRisk: RiskAssessmentDisplayState = {
  status: "ASSESSED",
  modelType: "RISK",
  modelVersion: "approved-risk-v1",
  level: "MEDIUM",
  reasons: ["Perlu validasi pemasok."],
  factorsConsidered: [],
  factorsNotAssessed: [],
  evidenceReferences: [],
  limitations: [],
};

function createFixture({
  user = baseUser,
  records = ids.slice(0, 2).map((id) => source(id)),
  scoring,
}: {
  readonly user?: SafeUser | null;
  readonly records?: readonly OpportunityComparisonSource[];
  readonly scoring?: OpportunityComparisonScoringPort;
} = {}) {
  const repository: OpportunityComparisonRepositoryPort = {
    findEligibleForUser: vi.fn(async () => records),
  };
  const defaultScoring: OpportunityComparisonScoringPort = {
    opportunityScores: vi.fn(async (requestedIds: readonly string[]) => Object.fromEntries(requestedIds.map((id) => [id, availableScore])) as Readonly<Record<string, OpportunityScoreServiceResult>>),
    fitScore: vi.fn(async () => availableFit),
    risks: vi.fn(async (requestedIds: readonly string[]) => Object.fromEntries(requestedIds.map((id) => [id, availableRisk])) as Readonly<Record<string, RiskAssessmentDisplayState>>),
  };
  const scoringFactory = vi.fn(() => scoring ?? defaultScoring);
  const service = new OpportunityComparisonService({
    repository,
    currentUserResolver: async () => user,
    scoringFactory,
  });
  return { service, repository, scoringFactory, scoring: scoring ?? defaultScoring };
}

describe("OpportunityComparisonService", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [2, USER_TYPES.ENTREPRENEUR],
    [3, USER_TYPES.UMKM_EXISTING],
  ] as const)("compares %i eligible Opportunities for %s with server-owned metrics", async (count, userType) => {
    const user = { ...baseUser, userType };
    const records = ids.slice(0, count).map((id) => source(id, userType));
    const { service, repository, scoringFactory, scoring } = createFixture({ user, records });

    const result = await service.compare({ opportunityIds: ids.slice(0, count) });

    expect(result.items.map(({ opportunityId }) => opportunityId)).toEqual(ids.slice(0, count));
    expect(result.items[0]).toMatchObject({
      opportunityScore: { status: "AVAILABLE", value: 72.5 },
      fitScore: { status: "AVAILABLE", value: 81.25 },
      relatedTrend: { status: "AVAILABLE", value: { title: "Tren minuman", direction: "RISING" } },
      competition: { status: "AVAILABLE", value: { level: "MEDIUM", summary: "Persaingan perlu diverifikasi di area target." } },
      risk: { status: "AVAILABLE", value: { level: "MEDIUM", reasons: ["Perlu validasi pemasok."] } },
      executionFeasibility: { status: "AVAILABLE", value: 75 },
    });
    expect(repository.findEligibleForUser).toHaveBeenCalledWith(userType, ids.slice(0, count));
    expect(scoringFactory).toHaveBeenCalledWith(user);
    expect(scoring.opportunityScores).toHaveBeenCalledWith(ids.slice(0, count));
    expect(scoring.risks).toHaveBeenCalledWith(ids.slice(0, count));
    expect(scoring.fitScore).toHaveBeenCalledTimes(count);
    expect(scoring.fitScore).toHaveBeenNthCalledWith(1, ids[0]);
  });

  it.each([
    { opportunityIds: [ids[0]] },
    { opportunityIds: [...ids, fourthId] },
    { opportunityIds: [ids[0], ids[0]] },
    { opportunityIds: [ids[0], ids[0].toUpperCase()] },
    { opportunityIds: [ids[0], "invalid"] },
    { opportunityIds: "not-an-array" },
  ])("rejects malformed comparison request: %j", async (request) => {
    const { service, repository, scoringFactory } = createFixture();

    await expect(service.compare(request)).rejects.toBeInstanceOf(OpportunityComparisonInvalidRequestError);
    expect(repository.findEligibleForUser).not.toHaveBeenCalled();
    expect(scoringFactory).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and incomplete users before data access", async () => {
    const unauthenticated = createFixture({ user: null });
    await expect(unauthenticated.service.compare({ opportunityIds: ids.slice(0, 2) }))
      .rejects.toBeInstanceOf(OpportunityComparisonUnauthenticatedError);

    const incomplete = createFixture({ user: { ...baseUser, onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS } });
    await expect(incomplete.service.compare({ opportunityIds: ids.slice(0, 2) }))
      .rejects.toBeInstanceOf(OpportunityComparisonAccessContextError);
    expect(incomplete.repository.findEligibleForUser).not.toHaveBeenCalled();
  });

  it("rejects missing, unpublished, or wrong-audience Opportunities before scoring", async () => {
    const missing = createFixture({ records: [source(ids[0])] });
    await expect(missing.service.compare({ opportunityIds: ids.slice(0, 2) }))
      .rejects.toBeInstanceOf(OpportunityComparisonResourceNotFoundError);

    const unpublished = createFixture({ records: [
      source(ids[0]),
      source(ids[1], USER_TYPES.ENTREPRENEUR, { relatedTrend: { ...source(ids[1]).relatedTrend, lifecycleState: "DRAFT" } }),
    ] });
    await expect(unpublished.service.compare({ opportunityIds: ids.slice(0, 2) }))
      .rejects.toBeInstanceOf(OpportunityComparisonResourceNotFoundError);
    expect(unpublished.scoringFactory).not.toHaveBeenCalled();

    const wrongAudience = createFixture({ records: [source(ids[0]), source(ids[1], USER_TYPES.UMKM_EXISTING)] });
    await expect(wrongAudience.service.compare({ opportunityIds: ids.slice(0, 2) }))
      .rejects.toBeInstanceOf(OpportunityComparisonResourceNotFoundError);
  });

  it("represents missing individual scores and risk as insufficient, never as zero", async () => {
    const insufficientRisk: RiskAssessmentDisplayState = {
      status: "INSUFFICIENT_DATA",
      modelType: "RISK",
      modelVersion: null,
      level: null,
      reason: "CONFIGURATION_UNAVAILABLE",
      missingFactors: RISK_FACTORS,
      evidenceReferences: [],
      limitations: [],
    };
    const partialScoring: OpportunityComparisonScoringPort = {
      opportunityScores: vi.fn(async () => ({
        [ids[0]]: { status: "INSUFFICIENT_DATA", score: null },
      } as never)),
      fitScore: vi.fn(async () => ({ status: "INSUFFICIENT_DATA", score: null } as FitScoreMvpResult)),
      risks: vi.fn(async () => ({ [ids[0]]: insufficientRisk })),
    };
    const { service } = createFixture({ scoring: partialScoring });

    const { items } = await service.compare({ opportunityIds: ids.slice(0, 2) });

    expect(items[0]).toMatchObject({
      opportunityScore: { status: "INSUFFICIENT_DATA", value: null },
      fitScore: { status: "INSUFFICIENT_DATA", value: null },
      risk: { status: "INSUFFICIENT_DATA", value: null },
    });
    expect(items[1]?.opportunityScore).toMatchObject({ status: "UNAVAILABLE", value: null });
    expect(items[1]?.risk).toMatchObject({ status: "UNAVAILABLE", value: null });
  });

  it.each([null, "101", "not-a-number", "Infinity"])('keeps invalid execution feasibility unavailable for %s', async (value) => {
    const records = [source(ids[0], USER_TYPES.ENTREPRENEUR, { executionFeasibility: value }), source(ids[1])];
    const { service } = createFixture({ records });

    const { items } = await service.compare({ opportunityIds: ids.slice(0, 2) });

    expect(items[0]?.executionFeasibility).toMatchObject({ status: "UNAVAILABLE", value: null });
  });

  it("maps a provider calculation failure to unavailable metrics without failing the comparison", async () => {
    const failingScoring: OpportunityComparisonScoringPort = {
      opportunityScores: vi.fn(async () => { throw new Error("internal scoring detail"); }),
      fitScore: vi.fn(async () => { throw new Error("internal fit detail"); }),
      risks: vi.fn(async () => { throw new Error("internal risk detail"); }),
    };
    const { service } = createFixture({ scoring: failingScoring });

    const { items } = await service.compare({ opportunityIds: ids.slice(0, 2) });

    expect(items[0]?.opportunityScore).toMatchObject({ status: "UNAVAILABLE", value: null });
    expect(items[0]?.fitScore).toMatchObject({ status: "UNAVAILABLE", value: null });
    expect(items[0]?.risk).toMatchObject({ status: "UNAVAILABLE", value: null });
    expect(JSON.stringify(items)).not.toContain("internal scoring detail");
  });
});
