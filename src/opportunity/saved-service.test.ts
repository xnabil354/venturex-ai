import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  userIdSchema,
  type SafeUser,
  type UserType,
} from "../auth/user-types";
import type { OpportunityRecord } from "./domain";
import {
  SavedOpportunityAccessContextError,
  SavedOpportunityService,
  SavedOpportunityUnauthenticatedError,
} from "./saved-service";
import type { SavedOpportunityRepositoryPort } from "./saved-repository";

const opportunityId = "60000000-0000-4000-8000-000000000001";
const user: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};
const visibleRecord: OpportunityRecord = {
  id: opportunityId,
  name: "Menu minuman",
  description: "Peluang minuman tersimpan.",
  categoryName: "Minuman",
  relatedTrend: {
    id: "70000000-0000-4000-8000-000000000001",
    title: "Tren minuman",
    lifecycleState: "PUBLISHED",
    affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
  },
};

class MemorySavedRepository implements SavedOpportunityRepositoryPort {
  readonly listVisibleForUser = vi.fn(async (_userId: SafeUser["id"], _userType: UserType) => this.records);
  readonly getVisibleSavedState = vi.fn(async () => this.saved);
  readonly saveVisibleForUser = vi.fn(async () => this.saved);
  readonly removeVisibleForUser = vi.fn(async () => this.removed);

  constructor(
    readonly records: readonly OpportunityRecord[] = [visibleRecord],
    readonly saved: boolean | null = true,
    readonly removed: boolean | null = false,
  ) {}
}

function createService({
  currentUser = user,
  repository = new MemorySavedRepository(),
}: {
  readonly currentUser?: SafeUser | null;
  readonly repository?: MemorySavedRepository;
} = {}) {
  return {
    repository,
    service: new SavedOpportunityService({
      repository,
      currentUserResolver: async () => currentUser,
    }),
  };
}

describe("SavedOpportunityService", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "uses the persisted %s identity for listing, status, save, and unsave",
    async (userType) => {
      const currentUser = { ...user, userType };
      const record: OpportunityRecord = {
        ...visibleRecord,
        relatedTrend: { ...visibleRecord.relatedTrend, affectedUserTypes: [userType] },
      };
      const repository = new MemorySavedRepository([record]);
      const service = new SavedOpportunityService({
        repository,
        currentUserResolver: async () => currentUser,
      });

      await service.listForCurrentUser();
      await service.getSaveState(opportunityId);
      await service.setSaved(opportunityId, true);
      await service.setSaved(opportunityId, false);

      expect(repository.listVisibleForUser).toHaveBeenCalledWith(currentUser.id, userType);
      expect(repository.getVisibleSavedState).toHaveBeenCalledWith(currentUser.id, userType, opportunityId);
      expect(repository.saveVisibleForUser).toHaveBeenCalledWith(currentUser.id, userType, opportunityId);
      expect(repository.removeVisibleForUser).toHaveBeenCalledWith(currentUser.id, userType, opportunityId);
    },
  );

  it("returns EMPTY for a user with no eligible saved opportunities", async () => {
    const { service, repository } = createService({ repository: new MemorySavedRepository([]) });

    await expect(service.listForCurrentUser()).resolves.toEqual({ status: "EMPTY", items: [] });
    expect(repository.listVisibleForUser).toHaveBeenCalledOnce();
  });

  it("returns a projected list for the current user only", async () => {
    const { service, repository } = createService();

    await expect(service.listForCurrentUser(3)).resolves.toMatchObject({
      status: "AVAILABLE",
      items: [{
        id: opportunityId,
        name: "Menu minuman",
        categoryName: "Minuman",
        summary: "Peluang minuman tersimpan.",
        relatedTrend: { title: "Tren minuman" },
      }],
    });
    expect(repository.listVisibleForUser).toHaveBeenCalledWith(user.id, user.userType, 3);
  });

  it("returns null for invalid IDs and hidden or ineligible Opportunities", async () => {
    const { service, repository } = createService({
      repository: new MemorySavedRepository([visibleRecord], null, null),
    });

    await expect(service.getSaveState("invalid")).resolves.toBeNull();
    expect(repository.getVisibleSavedState).not.toHaveBeenCalled();
    await expect(service.getSaveState(opportunityId)).resolves.toBeNull();
    await expect(service.setSaved(opportunityId, true)).resolves.toBeNull();
    await expect(service.setSaved(opportunityId, false)).resolves.toBeNull();
  });

  it("keeps save and unsave idempotent at the service boundary", async () => {
    const { service, repository } = createService();

    await expect(service.setSaved(opportunityId, true)).resolves.toBe(true);
    await expect(service.setSaved(opportunityId, true)).resolves.toBe(true);
    await expect(service.setSaved(opportunityId, false)).resolves.toBe(false);
    await expect(service.setSaved(opportunityId, false)).resolves.toBe(false);
    expect(repository.saveVisibleForUser).toHaveBeenCalledTimes(2);
    expect(repository.removeVisibleForUser).toHaveBeenCalledTimes(2);
  });

  it("rejects unauthenticated or incomplete users before any repository access", async () => {
    const repository = new MemorySavedRepository();
    const unauthenticated = new SavedOpportunityService({
      repository,
      currentUserResolver: async () => null,
    });
    const incomplete = new SavedOpportunityService({
      repository,
      currentUserResolver: async () => ({
        ...user,
        onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
      }),
    });

    await expect(unauthenticated.listForCurrentUser())
      .rejects.toBeInstanceOf(SavedOpportunityUnauthenticatedError);
    await expect(incomplete.setSaved(opportunityId, true))
      .rejects.toBeInstanceOf(SavedOpportunityAccessContextError);
    expect(repository.listVisibleForUser).not.toHaveBeenCalled();
    expect(repository.saveVisibleForUser).not.toHaveBeenCalled();
  });

  it("fails closed if the repository returns a Trend outside the stored user's eligibility", async () => {
    const badRecord = {
      ...visibleRecord,
      relatedTrend: { ...visibleRecord.relatedTrend, affectedUserTypes: [USER_TYPES.UMKM_EXISTING] },
    };
    const { service } = createService({ repository: new MemorySavedRepository([badRecord]) });

    await expect(service.listForCurrentUser()).rejects.toThrow("ineligible");
  });
});
