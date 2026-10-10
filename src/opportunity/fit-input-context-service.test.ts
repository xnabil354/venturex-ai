import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  parseUserId,
  type SafeUser,
} from "../auth/user-types";
import {
  OpportunityFitInputContextAccessContextError,
  OpportunityFitInputContextEligibilityError,
  OpportunityFitInputContextService,
  OpportunityFitInputContextUnauthenticatedError,
} from "./fit-input-context-service";
import type { OpportunityFitInputContext } from "./fit-input-context";

const USER_ID = parseUserId("10000000-0000-4000-8000-000000000001");
const OPPORTUNITY_ID = "60000000-0000-4000-8000-000000000001";

function currentUser(userType: SafeUser["userType"] = USER_TYPES.ENTREPRENEUR): SafeUser {
  return {
    id: USER_ID,
    email: "user@example.test",
    userType,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  };
}

function contextFor(userType: "ENTREPRENEUR" | "UMKM_EXISTING"): OpportunityFitInputContext {
  const opportunity = {
    id: OPPORTUNITY_ID,
    fnbCategoryId: "80000000-0000-4000-8000-000000000001",
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      lifecycleState: "PUBLISHED",
      affectedUserTypes: [userType],
    },
    requirements: null,
    customerSegmentIds: [],
    salesChannelIds: [],
  };

  return userType === "ENTREPRENEUR"
    ? { userType, opportunity, profile: null }
    : { userType, opportunity, profile: null };
}

function createService(user: SafeUser | null, context: OpportunityFitInputContext | null = null) {
  const repository = { findForUser: vi.fn().mockResolvedValue(context) };
  const service = new OpportunityFitInputContextService({
    repository,
    currentUserResolver: vi.fn().mockResolvedValue(user),
  });
  return { service, repository };
}

describe("OpportunityFitInputContextService", () => {
  it.each(["ENTREPRENEUR", "UMKM_EXISTING"] as const)(
    "returns only stored, type-specific fit context for the persisted %s user",
    async (userType) => {
      const fitContext = contextFor(userType);
      const { service, repository } = createService(currentUser(userType), fitContext);

      await expect(service.getForOpportunity(OPPORTUNITY_ID)).resolves.toBe(fitContext);
      expect(repository.findForUser).toHaveBeenCalledWith(USER_ID, userType, OPPORTUNITY_ID);
      expect(fitContext.profile).toBeNull();
      expect(fitContext).not.toHaveProperty("opportunityScore");
      expect(fitContext).not.toHaveProperty("fitScore");
      expect(fitContext).not.toHaveProperty("riskLevel");
    },
  );

  it("requires authentication and completed onboarding with a persisted user type", async () => {
    const anonymous = createService(null);
    await expect(anonymous.service.getForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextUnauthenticatedError);
    expect(anonymous.repository.findForUser).not.toHaveBeenCalled();

    const incomplete = createService({
      ...currentUser(),
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    });
    await expect(incomplete.service.getForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextAccessContextError);
    expect(incomplete.repository.findForUser).not.toHaveBeenCalled();

    const withoutType = createService(currentUser(null));
    await expect(withoutType.service.getForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextAccessContextError);
  });

  it("returns null for an invalid identifier and does not query the repository", async () => {
    const { service, repository } = createService(currentUser());

    await expect(service.getForOpportunity("invalid-id")).resolves.toBeNull();
    expect(repository.findForUser).not.toHaveBeenCalled();
  });

  it("returns null for missing or ineligible Opportunities and rejects inconsistent repository data", async () => {
    const missing = createService(currentUser(), null);
    await expect(missing.service.getForOpportunity(OPPORTUNITY_ID)).resolves.toBeNull();

    const unpublishedContext = contextFor("ENTREPRENEUR");
    const inconsistent = createService(currentUser(), {
      ...unpublishedContext,
      opportunity: {
        ...unpublishedContext.opportunity,
        relatedTrend: { ...unpublishedContext.opportunity.relatedTrend, lifecycleState: "DRAFT" },
      },
    });
    await expect(inconsistent.service.getForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextEligibilityError);

    const wrongType = createService(currentUser(USER_TYPES.UMKM_EXISTING), contextFor("ENTREPRENEUR"));
    await expect(wrongType.service.getForOpportunity(OPPORTUNITY_ID))
      .rejects.toBeInstanceOf(OpportunityFitInputContextEligibilityError);
  });
});
