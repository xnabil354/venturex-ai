import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  parseUserId,
  type SafeUser,
  type UserType,
} from "../auth/user-types";
import {
  OpportunityFitInputContextAccessContextError,
  OpportunityFitInputContextEligibilityError,
  OpportunityFitInputContextService,
  OpportunityFitInputContextUnauthenticatedError,
} from "../opportunity/fit-input-context-service";
import type { OpportunityFitInputContext } from "../opportunity/fit-input-context";
import {
  calculateFitScoreMvp,
  FIT_SCORE_MVP_HEURISTIC_V1,
  FitScoreMvpError,
} from "./fit-score-mvp";
import { FitScoreService } from "./fit-score-service";

const USER_ID = parseUserId("10000000-0000-4000-8000-000000000001");
const OTHER_USER_ID = parseUserId("10000000-0000-4000-8000-000000000002");
const OPPORTUNITY_ID = "60000000-0000-4000-8000-000000000001";
const TREND_ID = "70000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "80000000-0000-4000-8000-000000000001";
const SEGMENT_ID = "90000000-0000-4000-8000-000000000001";
const CHANNEL_ID = "a0000000-0000-4000-8000-000000000001";

// These records are synthetic service-test fixtures, not user or market data.
const entrepreneurProfile: NonNullable<Extract<OpportunityFitInputContext, { userType: "ENTREPRENEUR" }>['profile']> = {
  profileVersion: 1,
  locationText: "Synthetic City",
  city: "Synthetic City",
  province: "Synthetic Province",
  budgetMin: 10,
  budgetMax: 100,
  preferredProductType: null,
  experienceLevel: "BEGINNER",
  timeCommitment: "PART_TIME",
  interestCategoryIds: [CATEGORY_ID],
  customerSegmentIds: [SEGMENT_ID],
  salesChannelIds: [CHANNEL_ID],
};

const businessProfile: NonNullable<Extract<OpportunityFitInputContext, { userType: "UMKM_EXISTING" }>['profile']> = {
  profileVersion: 2,
  businessCategoryId: CATEGORY_ID,
  locationText: "Synthetic City",
  city: "Synthetic City",
  province: "Synthetic Province",
  averagePriceMin: 10,
  averagePriceMax: 20,
  businessDescription: "Synthetic service fixture",
  operationModel: null,
  products: [{ fnbCategoryId: CATEGORY_ID, price: 15 }],
  customerSegmentIds: [SEGMENT_ID],
  salesChannelIds: [CHANNEL_ID],
};

function contextFor(userType: UserType, complete = true): OpportunityFitInputContext {
  const opportunity: OpportunityFitInputContext["opportunity"] = {
    id: OPPORTUNITY_ID,
    fnbCategoryId: CATEGORY_ID,
    relatedTrend: {
      id: TREND_ID,
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [userType],
    },
    requirements: {
      capitalMin: "50",
      capitalMax: "100",
      expectedPriceMin: "15",
      expectedPriceMax: "25",
      requiredExperienceLevel: null,
      requiredTimeCommitment: null,
      operationalComplexity: null,
      locationScope: null,
      metadata: {},
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    customerSegmentIds: [SEGMENT_ID],
    salesChannelIds: [CHANNEL_ID],
  };

  if (userType === USER_TYPES.ENTREPRENEUR) {
    return { userType, opportunity, profile: complete ? entrepreneurProfile : null };
  }
  return { userType, opportunity, profile: complete ? businessProfile : null };
}

function contextWithInsufficientScoringInputs(userType: UserType): OpportunityFitInputContext {
  const context = contextFor(userType);
  return {
    ...context,
    opportunity: {
      ...context.opportunity,
      requirements: context.opportunity.requirements
        ? {
            ...context.opportunity.requirements,
            capitalMin: null,
            expectedPriceMin: null,
            expectedPriceMax: null,
          }
        : null,
      customerSegmentIds: [],
      salesChannelIds: [],
    },
  };
}

function user(
  userType: SafeUser["userType"] = USER_TYPES.ENTREPRENEUR,
  id = USER_ID,
  onboardingStatus: SafeUser["onboardingStatus"] = ONBOARDING_STATUSES.COMPLETED,
): SafeUser {
  return { id, email: "user@example.test", userType, onboardingStatus };
}

function createHarness(options: {
  readonly currentUser?: SafeUser | null;
  readonly context?: OpportunityFitInputContext | null;
  readonly repositoryFailure?: Error;
  readonly calculator?: typeof calculateFitScoreMvp;
} = {}) {
  const repository = {
    findForUser: vi.fn(async (userId: SafeUser["id"], _userType: UserType, _opportunityId: string) => {
      if (options.repositoryFailure) throw options.repositoryFailure;
      if (userId !== USER_ID) return null;
      return options.context ?? null;
    }),
  };
  const fitInputContextService = new OpportunityFitInputContextService({
    repository,
    currentUserResolver: vi.fn().mockResolvedValue(options.currentUser === undefined
      ? user()
      : options.currentUser),
  });
  const calculator = options.calculator ?? calculateFitScoreMvp;
  const service = new FitScoreService({ fitInputContextService, calculator });
  return { service, repository, calculator };
}

describe("FitScoreService", () => {
  it.each([
    [USER_TYPES.ENTREPRENEUR, "ENTREPRENEUR_FIT"],
    [USER_TYPES.UMKM_EXISTING, "BUSINESS_FIT"],
  ] as const)("returns AVAILABLE for persisted %s context using %s", async (userType, modelType) => {
    const { service, repository } = createHarness({
      currentUser: user(userType),
      context: contextFor(userType),
    });

    const result = await service.calculateForOpportunity(OPPORTUNITY_ID);

    expect(result).toMatchObject({
      status: "AVAILABLE",
      modelType,
      policyVersion: "FIT_MVP_HEURISTIC_V1",
      confidence: null,
      score: 100,
      missingComponents: [],
    });
    expect(repository.findForUser).toHaveBeenCalledWith(USER_ID, userType, OPPORTUNITY_ID);
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING] as const)(
    "rejects a missing role-specific %s profile before scoring",
    async (userType) => {
      const calculator = vi.fn(calculateFitScoreMvp);
      const { service } = createHarness({
        currentUser: user(userType),
        context: contextFor(userType, false),
        calculator,
      });

      await expect(service.calculateForOpportunity(OPPORTUNITY_ID))
        .rejects.toBeInstanceOf(OpportunityFitInputContextAccessContextError);
      expect(calculator).not.toHaveBeenCalled();
    },
  );

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING] as const)(
    "returns INSUFFICIENT_DATA for an existing %s profile with missing scoring inputs",
    async (userType) => {
      const { service } = createHarness({
        currentUser: user(userType),
        context: contextWithInsufficientScoringInputs(userType),
      });

      await expect(service.calculateForOpportunity(OPPORTUNITY_ID)).resolves.toMatchObject({
        status: "INSUFFICIENT_DATA",
        score: null,
        confidence: null,
        reason: "ACTIVE_COMPONENTS_UNAVAILABLE",
      });
    },
  );

  it("preserves the authorized service's authentication and onboarding errors", async () => {
    const unauthenticated = createHarness({ currentUser: null });
    await expect(unauthenticated.service.calculateForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextUnauthenticatedError);
    expect(unauthenticated.repository.findForUser).not.toHaveBeenCalled();

    const incompleteOnboarding = createHarness({
      currentUser: user(USER_TYPES.ENTREPRENEUR, USER_ID, ONBOARDING_STATUSES.PROFILE_IN_PROGRESS),
    });
    await expect(incompleteOnboarding.service.calculateForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextAccessContextError);
    expect(incompleteOnboarding.repository.findForUser).not.toHaveBeenCalled();
  });

  it("rejects cross-user ownership through the authorized context service", async () => {
    const current = user(USER_TYPES.ENTREPRENEUR, OTHER_USER_ID);
    const repository = {
      findForUser: vi.fn(async (userId: SafeUser["id"]) => userId === USER_ID
        ? contextFor(USER_TYPES.ENTREPRENEUR)
        : null),
    };
    const contextService = new OpportunityFitInputContextService({
      repository,
      currentUserResolver: vi.fn().mockResolvedValue(current),
    });
    const calculator = vi.fn(calculateFitScoreMvp);
    const service = new FitScoreService({ fitInputContextService: contextService, calculator });

    await expect(service.calculateForOpportunity(OPPORTUNITY_ID)).resolves.toBeNull();
    expect(repository.findForUser).toHaveBeenCalledWith(OTHER_USER_ID, USER_TYPES.ENTREPRENEUR, OPPORTUNITY_ID);
    expect(calculator).not.toHaveBeenCalled();
  });

  it("does not score a missing Opportunity or an invalid identifier", async () => {
    const missing = createHarness({ context: null });
    await expect(missing.service.calculateForOpportunity(OPPORTUNITY_ID)).resolves.toBeNull();
    expect(missing.repository.findForUser).toHaveBeenCalledOnce();

    const invalid = createHarness({ context: contextFor(USER_TYPES.ENTREPRENEUR) });
    await expect(invalid.service.calculateForOpportunity("invalid-id")).resolves.toBeNull();
    expect(invalid.repository.findForUser).not.toHaveBeenCalled();
  });

  it.each([
    ["unpublished Trend", { lifecycleState: "DRAFT" as const, affectedUserTypes: [USER_TYPES.ENTREPRENEUR] }],
    ["Trend outside the persisted user type", { lifecycleState: "PUBLISHED" as const, affectedUserTypes: [USER_TYPES.UMKM_EXISTING] }],
  ])("does not score an Opportunity related to an ineligible %s", async (_reason, relatedTrend) => {
    const context = contextFor(USER_TYPES.ENTREPRENEUR);
    const ineligible = {
      ...context,
      opportunity: { ...context.opportunity, relatedTrend: { id: TREND_ID, ...relatedTrend } },
    } as OpportunityFitInputContext;
    const { service, calculator } = createHarness({ context: ineligible, calculator: vi.fn(calculateFitScoreMvp) });

    await expect(service.calculateForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextEligibilityError);
    expect(calculator).not.toHaveBeenCalled();
  });

  it("rejects missing, invalid, or inconsistent persisted user types", async () => {
    for (const invalidType of [null, "UNKNOWN"] as const) {
      const harness = createHarness({
        currentUser: user(invalidType as SafeUser["userType"]),
        context: contextFor(USER_TYPES.ENTREPRENEUR),
      });
      await expect(harness.service.calculateForOpportunity(OPPORTUNITY_ID))
        .rejects.toBeInstanceOf(OpportunityFitInputContextAccessContextError);
      expect(harness.repository.findForUser).not.toHaveBeenCalled();
    }

    const wrongContextType = createHarness({
      currentUser: user(USER_TYPES.ENTREPRENEUR),
      context: contextFor(USER_TYPES.UMKM_EXISTING),
    });
    await expect(wrongContextType.service.calculateForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextEligibilityError);
  });

  it("passes the explicit approved policy and traceable context to the existing pure pipeline", async () => {
    const context = contextFor(USER_TYPES.ENTREPRENEUR);
    const calculator = vi.fn(calculateFitScoreMvp);
    const { service } = createHarness({ context, calculator });

    await service.calculateForOpportunity(OPPORTUNITY_ID);

    expect(calculator).toHaveBeenCalledWith(context, FIT_SCORE_MVP_HEURISTIC_V1);
    const result = calculator.mock.results[0]?.value;
    expect(result).toMatchObject({
      status: "AVAILABLE",
      policyVersion: FIT_SCORE_MVP_HEURISTIC_V1.version,
      activeComponents: expect.any(Array),
      disclaimer: FIT_SCORE_MVP_HEURISTIC_V1.disclaimer,
      confidence: null,
    });
  });

  it("propagates repository and scoring configuration failures instead of returning insufficient data", async () => {
    const databaseFailure = new Error("synthetic repository failure");
    const repositoryFailure = createHarness({ repositoryFailure: databaseFailure });
    await expect(repositoryFailure.service.calculateForOpportunity(OPPORTUNITY_ID))
      .rejects.toBe(databaseFailure);

    const policyFailure = new FitScoreMvpError("INVALID_POLICY", "Synthetic policy failure.");
    const context = contextFor(USER_TYPES.ENTREPRENEUR);
    const calculator = vi.fn(() => { throw policyFailure; });
    const scoringFailure = createHarness({ context, calculator });
    await expect(scoringFailure.service.calculateForOpportunity(OPPORTUNITY_ID))
      .rejects.toBe(policyFailure);
  });

  it("is read-only and deterministic for identical persisted context", async () => {
    const context = contextFor(USER_TYPES.UMKM_EXISTING);
    const { service, repository } = createHarness({
      currentUser: user(USER_TYPES.UMKM_EXISTING),
      context,
    });

    const first = await service.calculateForOpportunity(OPPORTUNITY_ID);
    const second = await service.calculateForOpportunity(OPPORTUNITY_ID);

    expect(first).toEqual(second);
    expect(repository.findForUser).toHaveBeenCalledTimes(2);
    expect(Object.keys(repository)).toEqual(["findForUser"]);
    expect(first).not.toHaveProperty("analysisId");
  });
});
