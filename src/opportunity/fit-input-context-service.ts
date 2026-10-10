import "server-only";

import { getCurrentUser as defaultCurrentUserResolver } from "../auth/current-user";
import {
  ONBOARDING_STATUSES,
  isUserType,
  type SafeUser,
} from "../auth/user-types";
import { opportunityIdSchema } from "./domain";
import {
  OpportunityFitInputContextRepository,
  type OpportunityFitInputContextRepositoryPort,
} from "./fit-input-context-repository";
import type { OpportunityFitInputContext } from "./fit-input-context";

export class OpportunityFitInputContextEligibilityError extends Error {
  override readonly name = "OpportunityFitInputContextEligibilityError";

  constructor() {
    super("The Fit Input Context repository returned an ineligible Opportunity.");
  }
}

export class OpportunityFitInputContextUnauthenticatedError extends Error {
  override readonly name = "OpportunityFitInputContextUnauthenticatedError";

  constructor() {
    super("Authentication is required to access Fit Input Context.");
  }
}

export class OpportunityFitInputContextAccessContextError extends Error {
  override readonly name = "OpportunityFitInputContextAccessContextError";

  constructor() {
    super("A completed user type and role-specific profile are required to access Fit Input Context.");
  }
}

export type OpportunityFitInputContextServiceDependencies = {
  readonly repository?: OpportunityFitInputContextRepositoryPort;
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
};

export class OpportunityFitInputContextService {
  private readonly repository: OpportunityFitInputContextRepositoryPort;
  private readonly currentUserResolver: () => Promise<SafeUser | null>;

  constructor(dependencies: OpportunityFitInputContextServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new OpportunityFitInputContextRepository();
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
  }

  async getForOpportunity(idInput: unknown): Promise<OpportunityFitInputContext | null> {
    const user = await this.currentUserResolver();
    if (!user) throw new OpportunityFitInputContextUnauthenticatedError();
    if (
      user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
      !isUserType(user.userType)
    ) {
      throw new OpportunityFitInputContextAccessContextError();
    }

    const parsedId = opportunityIdSchema.safeParse(idInput);
    if (!parsedId.success) return null;

    const context = await this.repository.findForUser(user.id, user.userType, parsedId.data);
    if (!context) return null;
    if (
      context.userType !== user.userType ||
      context.opportunity.relatedTrend.lifecycleState !== "PUBLISHED" ||
      !context.opportunity.relatedTrend.affectedUserTypes.includes(user.userType)
    ) {
      throw new OpportunityFitInputContextEligibilityError();
    }

    return context;
  }
}
