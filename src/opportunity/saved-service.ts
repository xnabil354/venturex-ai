import "server-only";

import { getCurrentUser as defaultCurrentUserResolver } from "../auth/current-user";
import {
  ONBOARDING_STATUSES,
  isUserType,
  type SafeUser,
  type UserId,
  type UserType,
} from "../auth/user-types";
import type { OpportunityListItemDto } from "./dto";
import { opportunityIdSchema, type OpportunityRecord } from "./domain";
import { toOpportunityListItem } from "./dto";
import type { OpportunitySaveState, SavedOpportunityListResult } from "./saved-dto";
import { SavedOpportunityRepository, type SavedOpportunityRepositoryPort } from "./saved-repository";

export class SavedOpportunityUnauthenticatedError extends Error {
  override readonly name = "SavedOpportunityUnauthenticatedError";

  constructor() {
    super("Authentication is required to access saved opportunities.");
  }
}

export class SavedOpportunityAccessContextError extends Error {
  override readonly name = "SavedOpportunityAccessContextError";

  constructor() {
    super("A completed user type is required to access saved opportunities.");
  }
}

export class SavedOpportunityEligibilityError extends Error {
  override readonly name = "SavedOpportunityEligibilityError";

  constructor() {
    super("The saved Opportunity repository returned an ineligible record.");
  }
}

export type SavedOpportunityServiceDependencies = {
  readonly repository?: SavedOpportunityRepositoryPort;
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
};

type SavedOpportunityActor = {
  readonly userId: UserId;
  readonly userType: UserType;
};

export class SavedOpportunityService {
  private readonly repository: SavedOpportunityRepositoryPort;
  private readonly currentUserResolver: () => Promise<SafeUser | null>;

  constructor(dependencies: SavedOpportunityServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new SavedOpportunityRepository();
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
  }

  async listForCurrentUser(limit?: number): Promise<SavedOpportunityListResult> {
    const actor = await this.getActor();
    const records = limit === undefined
      ? await this.repository.listVisibleForUser(actor.userId, actor.userType)
      : await this.repository.listVisibleForUser(actor.userId, actor.userType, limit);
    this.assertEligible(records, actor.userType);
    const items: readonly OpportunityListItemDto[] = records.map(toOpportunityListItem);
    return items.length > 0
      ? { status: "AVAILABLE", items }
      : { status: "EMPTY", items: [] };
  }

  async getSaveState(idInput: unknown): Promise<OpportunitySaveState | null> {
    const actor = await this.getActor();
    const parsedId = opportunityIdSchema.safeParse(idInput);
    if (!parsedId.success) return null;

    const saved = await this.repository.getVisibleSavedState(
      actor.userId,
      actor.userType,
      parsedId.data,
    );
    return saved === null ? null : { status: "AVAILABLE", saved };
  }

  async setSaved(idInput: unknown, shouldSave: boolean): Promise<boolean | null> {
    const actor = await this.getActor();
    const parsedId = opportunityIdSchema.safeParse(idInput);
    if (!parsedId.success) return null;

    return shouldSave
      ? this.repository.saveVisibleForUser(actor.userId, actor.userType, parsedId.data)
      : this.repository.removeVisibleForUser(actor.userId, actor.userType, parsedId.data);
  }

  private async getActor(): Promise<SavedOpportunityActor> {
    const user = await this.currentUserResolver();
    if (!user) throw new SavedOpportunityUnauthenticatedError();
    if (
      user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED ||
      !isUserType(user.userType)
    ) {
      throw new SavedOpportunityAccessContextError();
    }

    return { userId: user.id, userType: user.userType };
  }

  private assertEligible(records: readonly OpportunityRecord[], userType: UserType): void {
    if (records.some(({ relatedTrend }) =>
      relatedTrend.lifecycleState !== "PUBLISHED" ||
      !relatedTrend.affectedUserTypes.includes(userType),
    )) {
      throw new SavedOpportunityEligibilityError();
    }
  }
}
