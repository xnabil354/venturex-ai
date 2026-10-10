import "server-only";

import { getCurrentUser as defaultCurrentUserResolver } from "../auth/current-user";
import {
  ONBOARDING_STATUSES,
  isUserType,
  type SafeUser,
  type UserType,
} from "../auth/user-types";
import {
  toOpportunityDetail,
  toOpportunityListItem,
  type OpportunityDetailDto,
  type OpportunityListItemDto,
} from "./dto";
import {
  opportunityIdSchema,
  opportunityPageSchema,
  OPPORTUNITY_PAGE_SIZE,
  type OpportunityRecord,
} from "./domain";
import { OpportunityRepository, type OpportunityRepositoryPort } from "./repository";
import { trendIdSchema } from "../trend/domain";

export type OpportunityRelatedToTrendResult = {
  readonly status: "AVAILABLE" | "EMPTY";
  readonly items: readonly OpportunityListItemDto[];
};

export type OpportunityFinderResult =
  | {
      readonly status: "AVAILABLE" | "EMPTY";
      readonly items: readonly OpportunityListItemDto[];
      readonly page: number;
      readonly pageSize: number;
      readonly totalCount: number;
      readonly totalPages: number;
    }
  | { readonly status: "ERROR" | "UNAVAILABLE" };

export class OpportunityUnauthenticatedError extends Error {
  override readonly name = "OpportunityUnauthenticatedError";

  constructor() {
    super("Authentication required.");
  }
}

export class OpportunityAccessContextError extends Error {
  override readonly name = "OpportunityAccessContextError";

  constructor() {
    super("Opportunity Finder requires a completed user type.");
  }
}

export class OpportunityEligibilityError extends Error {
  override readonly name = "OpportunityEligibilityError";

  constructor() {
    super("The Opportunity repository returned an ineligible Trend relationship.");
  }
}

export class OpportunityCatalogConsistencyError extends Error {
  override readonly name = "OpportunityCatalogConsistencyError";

  constructor() {
    super("The eligible Opportunity count changed while its catalog page was loading.");
  }
}

export class OpportunityTrendRelationshipError extends Error {
  override readonly name = "OpportunityTrendRelationshipError";

  constructor() {
    super("The Opportunity repository returned a record for a different Trend.");
  }
}

export type OpportunityServiceDependencies = {
  readonly repository?: OpportunityRepositoryPort;
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
};

export function assertOpportunityEligibility(
  records: readonly OpportunityRecord[],
  userType: UserType,
): void {
  if (records.some(({ relatedTrend }) =>
    relatedTrend.lifecycleState !== "PUBLISHED" ||
    !relatedTrend.affectedUserTypes.includes(userType),
  )) {
    throw new OpportunityEligibilityError();
  }
}

export class OpportunityService {
  private readonly repository: OpportunityRepositoryPort;
  private readonly currentUserResolver: () => Promise<SafeUser | null>;

  constructor(dependencies: OpportunityServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new OpportunityRepository();
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
  }

  async list(pageInput: unknown = 1): Promise<OpportunityFinderResult> {
    const user = await this.currentUserResolver();
    if (!user) throw new OpportunityUnauthenticatedError();
    if (
      user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
      !isUserType(user.userType)
    ) {
      throw new OpportunityAccessContextError();
    }

    const requestedPage = opportunityPageSchema.parse(pageInput);
    const totalCount = await this.repository.countVisible(user.userType);
    const totalPages = Math.max(1, Math.ceil(totalCount / OPPORTUNITY_PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const records = totalCount === 0
      ? []
      : await this.repository.listVisible(user.userType, {
          limit: OPPORTUNITY_PAGE_SIZE,
          offset: (page - 1) * OPPORTUNITY_PAGE_SIZE,
        });

    if (totalCount > 0 && records.length === 0) {
      throw new OpportunityCatalogConsistencyError();
    }
    assertOpportunityEligibility(records, user.userType);
    const items = records.map(toOpportunityListItem);

    return {
      status: items.length > 0 ? "AVAILABLE" : "EMPTY",
      items,
      page,
      pageSize: OPPORTUNITY_PAGE_SIZE,
      totalCount,
      totalPages,
    };
  }

  async listForTrend(trendIdInput: unknown): Promise<OpportunityRelatedToTrendResult> {
    const user = await this.currentUserResolver();
    if (!user) throw new OpportunityUnauthenticatedError();
    if (
      user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
      !isUserType(user.userType)
    ) {
      throw new OpportunityAccessContextError();
    }

    const relatedTrendId = trendIdSchema.parse(trendIdInput);
    const records = await this.repository.listVisibleForTrend(user.userType, relatedTrendId);
    assertOpportunityEligibility(records, user.userType);
    if (records.some(({ relatedTrend }) => relatedTrend.id !== relatedTrendId)) {
      throw new OpportunityTrendRelationshipError();
    }

    const items = records.map(toOpportunityListItem);
    return {
      status: items.length > 0 ? "AVAILABLE" : "EMPTY",
      items,
    };
  }

  async getDetail(idInput: unknown): Promise<OpportunityDetailDto | null> {
    const user = await this.currentUserResolver();
    if (!user) throw new OpportunityUnauthenticatedError();
    if (
      user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
      !isUserType(user.userType)
    ) {
      throw new OpportunityAccessContextError();
    }

    const parsedId = opportunityIdSchema.safeParse(idInput);
    if (!parsedId.success) return null;

    const record = await this.repository.findVisibleById(user.userType, parsedId.data);
    if (!record) return null;
    assertOpportunityEligibility([record], user.userType);
    return toOpportunityDetail(record);
  }
}
