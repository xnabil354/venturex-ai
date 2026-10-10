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
import type {
  OpportunityDetailRecord,
  OpportunityPageRequest,
  OpportunityRecord,
} from "./domain";
import {
  OpportunityAccessContextError,
  OpportunityCatalogConsistencyError,
  OpportunityEligibilityError,
  OpportunityService,
  OpportunityTrendRelationshipError,
  OpportunityUnauthenticatedError,
} from "./service";
import type { OpportunityRepositoryPort } from "./repository";

const entrepreneur: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};
const baseRecord: OpportunityRecord = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Menu minuman",
  description: "Ringkasan peluang dari katalog.",
  categoryName: "Minuman",
  relatedTrend: {
    id: "70000000-0000-4000-8000-000000000001",
    title: "Tren minuman",
    lifecycleState: "PUBLISHED",
    affectedUserTypes: [USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING],
  },
};
const baseDetailRecord: OpportunityDetailRecord = {
  ...baseRecord,
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: "Konsumen yang mencari minuman nabati.",
  competitionLevel: "MEDIUM",
  competitionSummary: "Beberapa pilihan telah tercatat di katalog.",
};

class MemoryOpportunityRepository implements OpportunityRepositoryPort {
  readonly countVisible = vi.fn(async (_userType: UserType) => this.records.length);
  readonly listVisible = vi.fn(async (_userType: UserType, page: OpportunityPageRequest) =>
    this.records.slice(page.offset, page.offset + page.limit),
  );
  readonly listVisibleForTrend = vi.fn(async (_userType: UserType, relatedTrendId: string) =>
    this.records.filter(({ relatedTrend }) => relatedTrend.id === relatedTrendId),
  );
  readonly findVisibleById = vi.fn(async (_userType: UserType, _id: string) => this.detailRecord);

  constructor(
    readonly records: readonly OpportunityRecord[],
    readonly detailRecord: OpportunityDetailRecord | null = null,
  ) {}
}

describe("OpportunityService", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "lists real catalog projections for the persisted %s user type",
    async (userType) => {
      const user: SafeUser = { ...entrepreneur, userType };
      const repository = new MemoryOpportunityRepository([baseRecord]);
      const service = new OpportunityService({
        repository,
        currentUserResolver: async () => user,
      });

      const result = await service.list();

      expect(result).toMatchObject({
        status: "AVAILABLE",
        totalCount: 1,
        page: 1,
        items: [{
          id: baseRecord.id,
          name: baseRecord.name,
          categoryName: "Minuman",
          relatedTrend: { id: baseRecord.relatedTrend.id, title: "Tren minuman" },
        }],
      });
      expect(repository.countVisible).toHaveBeenCalledWith(userType);
      expect(repository.listVisible).toHaveBeenCalledWith(userType, { limit: 10, offset: 0 });
    },
  );

  it("applies deterministic page offsets and clamps pages beyond the last page", async () => {
    const records = Array.from({ length: 12 }, (_, index) => ({
      ...baseRecord,
      id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: `Peluang ${index + 1}`,
    }));
    const repository = new MemoryOpportunityRepository(records);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    const secondPage = await service.list("2");
    const clampedPage = await service.list("999");

    expect(secondPage).toMatchObject({ status: "AVAILABLE", page: 2, totalPages: 2 });
    if (secondPage.status !== "AVAILABLE") throw new Error("Expected the second page to contain records.");
    expect(secondPage.items).toHaveLength(2);
    expect(repository.listVisible).toHaveBeenNthCalledWith(1, USER_TYPES.ENTREPRENEUR, {
      limit: 10,
      offset: 10,
    });
    expect(clampedPage).toMatchObject({ status: "AVAILABLE", page: 2, totalPages: 2 });
  });

  it("returns EMPTY only after the repository confirms there are no eligible records", async () => {
    const repository = new MemoryOpportunityRepository([]);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.list()).resolves.toMatchObject({
      status: "EMPTY",
      items: [],
      totalCount: 0,
      totalPages: 1,
    });
    expect(repository.listVisible).not.toHaveBeenCalled();
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "lists only related published opportunities for persisted user type %s",
    async (userType) => {
      const user: SafeUser = { ...entrepreneur, userType };
      const repository = new MemoryOpportunityRepository([baseRecord]);
      const service = new OpportunityService({
        repository,
        currentUserResolver: async () => user,
      });

      await expect(service.listForTrend(baseRecord.relatedTrend.id)).resolves.toEqual({
        status: "AVAILABLE",
        items: [{
          id: baseRecord.id,
          name: baseRecord.name,
          categoryName: baseRecord.categoryName,
          summary: baseRecord.description,
          relatedTrend: {
            id: baseRecord.relatedTrend.id,
            title: baseRecord.relatedTrend.title,
          },
        }],
      });
      expect(repository.listVisibleForTrend).toHaveBeenCalledWith(userType, baseRecord.relatedTrend.id);
    },
  );

  it("returns EMPTY when the selected Trend has no related eligible Opportunity", async () => {
    const repository = new MemoryOpportunityRepository([baseRecord]);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.listForTrend("70000000-0000-4000-8000-000000000099"))
      .resolves.toEqual({ status: "EMPTY", items: [] });
    expect(repository.listVisibleForTrend).toHaveBeenCalledWith(
      USER_TYPES.ENTREPRENEUR,
      "70000000-0000-4000-8000-000000000099",
    );
  });

  it.each([
    ["unpublished Trend", { ...baseRecord.relatedTrend, lifecycleState: "DRAFT" }],
    ["Trend for another user type", {
      ...baseRecord.relatedTrend,
      affectedUserTypes: [USER_TYPES.UMKM_EXISTING],
    }],
  ])("rejects related Opportunity records with an ineligible %s", async (_case, relatedTrend) => {
    const repository = new MemoryOpportunityRepository([{
      ...baseRecord,
      relatedTrend,
    }]);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.listForTrend(baseRecord.relatedTrend.id))
      .rejects.toBeInstanceOf(OpportunityEligibilityError);
  });

  it("rejects repository results that do not match the requested Trend relationship", async () => {
    const repository = new MemoryOpportunityRepository([baseRecord]);
    repository.listVisibleForTrend.mockResolvedValue([{
      ...baseRecord,
      relatedTrend: { ...baseRecord.relatedTrend, id: "70000000-0000-4000-8000-000000000002" },
    }]);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.listForTrend(baseRecord.relatedTrend.id))
      .rejects.toBeInstanceOf(OpportunityTrendRelationshipError);
  });

  it.each([
    ["missing user", null, OpportunityUnauthenticatedError],
    ["incomplete onboarding", {
      ...entrepreneur,
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    }, OpportunityAccessContextError],
    ["missing user type", { ...entrepreneur, userType: null }, OpportunityAccessContextError],
  ])("does not query related opportunities for %s", async (_case, user, ErrorType) => {
    const repository = new MemoryOpportunityRepository([baseRecord]);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => user as SafeUser | null,
    });

    await expect(service.listForTrend(baseRecord.relatedTrend.id)).rejects.toBeInstanceOf(ErrorType);
    expect(repository.listVisibleForTrend).not.toHaveBeenCalled();
  });

  it("propagates related Opportunity persistence errors for safe page-level handling", async () => {
    const repository = new MemoryOpportunityRepository([]);
    repository.listVisibleForTrend.mockRejectedValue(new Error("database internals"));
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.listForTrend(baseRecord.relatedTrend.id))
      .rejects.toThrow("database internals");
  });

  it.each([
    ["unpublished Trend", { ...baseRecord.relatedTrend, lifecycleState: "DRAFT" }],
    ["Trend for another user type", {
      ...baseRecord.relatedTrend,
      affectedUserTypes: [USER_TYPES.UMKM_EXISTING],
    }],
  ])("rejects a repository result containing an ineligible %s", async (_case, relatedTrend) => {
    const repository = new MemoryOpportunityRepository([{ ...baseRecord, relatedTrend }]);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.list()).rejects.toBeInstanceOf(OpportunityEligibilityError);
  });

  it("does not label a page EMPTY when its count and records disagree", async () => {
    const repository = new MemoryOpportunityRepository([baseRecord]);
    repository.listVisible.mockResolvedValue([]);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.list()).rejects.toBeInstanceOf(OpportunityCatalogConsistencyError);
  });

  it("propagates persistence errors so the route can show ERROR, not EMPTY", async () => {
    const repository = new MemoryOpportunityRepository([]);
    repository.countVisible.mockRejectedValue(new Error("database failure"));
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.list()).rejects.toThrow("database failure");
  });

  it.each([
    ["missing user", null, OpportunityUnauthenticatedError],
    ["incomplete onboarding", {
      ...entrepreneur,
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    }, OpportunityAccessContextError],
    ["missing user type", { ...entrepreneur, userType: null }, OpportunityAccessContextError],
    ["unsupported user type", { ...entrepreneur, userType: "UNKNOWN" }, OpportunityAccessContextError],
  ])("rejects %s without querying the catalog", async (_case, user, ErrorType) => {
    const repository = new MemoryOpportunityRepository([baseRecord]);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => user as SafeUser | null,
    });

    await expect(service.list()).rejects.toBeInstanceOf(ErrorType);
    expect(repository.countVisible).not.toHaveBeenCalled();
    expect(repository.listVisible).not.toHaveBeenCalled();
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "returns persisted detail for the authenticated %s user",
    async (userType) => {
      const user: SafeUser = { ...entrepreneur, userType };
      const repository = new MemoryOpportunityRepository([baseRecord], baseDetailRecord);
      const service = new OpportunityService({ repository, currentUserResolver: async () => user });

      await expect(service.getDetail(baseDetailRecord.id)).resolves.toEqual({
        id: baseDetailRecord.id,
        name: baseDetailRecord.name,
        description: baseDetailRecord.description,
        categoryName: baseDetailRecord.categoryName,
        opportunityType: baseDetailRecord.opportunityType,
        targetConsumerSummary: baseDetailRecord.targetConsumerSummary,
        competitionLevel: baseDetailRecord.competitionLevel,
        competitionSummary: baseDetailRecord.competitionSummary,
        relatedTrend: {
          id: baseDetailRecord.relatedTrend.id,
          title: baseDetailRecord.relatedTrend.title,
        },
      });
      expect(repository.findVisibleById).toHaveBeenCalledWith(userType, baseDetailRecord.id);
    },
  );

  it("returns not found for an invalid id after authentication without querying persistence", async () => {
    const repository = new MemoryOpportunityRepository([baseRecord], baseDetailRecord);
    const resolver = vi.fn(async () => entrepreneur);
    const service = new OpportunityService({ repository, currentUserResolver: resolver });

    await expect(service.getDetail("invalid-id")).resolves.toBeNull();
    expect(resolver).toHaveBeenCalledOnce();
    expect(repository.findVisibleById).not.toHaveBeenCalled();
  });

  it("returns not found when no visible published, eligible record exists", async () => {
    const repository = new MemoryOpportunityRepository([], null);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.getDetail(baseRecord.id)).resolves.toBeNull();
    expect(repository.findVisibleById).toHaveBeenCalledWith(USER_TYPES.ENTREPRENEUR, baseRecord.id);
  });

  it.each([
    ["unpublished Trend", { ...baseDetailRecord.relatedTrend, lifecycleState: "DRAFT" }],
    ["Trend for another user type", {
      ...baseDetailRecord.relatedTrend,
      affectedUserTypes: [USER_TYPES.UMKM_EXISTING],
    }],
  ])("rejects detail with an ineligible %s", async (_case, relatedTrend) => {
    const repository = new MemoryOpportunityRepository([], { ...baseDetailRecord, relatedTrend });
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.getDetail(baseDetailRecord.id)).rejects.toBeInstanceOf(OpportunityEligibilityError);
  });

  it("does not query detail for an unauthenticated or incomplete user", async () => {
    const repository = new MemoryOpportunityRepository([], baseDetailRecord);
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => null,
    });

    await expect(service.getDetail(baseDetailRecord.id)).rejects.toBeInstanceOf(OpportunityUnauthenticatedError);
    expect(repository.findVisibleById).not.toHaveBeenCalled();
  });

  it("propagates detail persistence failures for safe route-level handling", async () => {
    const repository = new MemoryOpportunityRepository([], baseDetailRecord);
    repository.findVisibleById.mockRejectedValue(new Error("database internals"));
    const service = new OpportunityService({
      repository,
      currentUserResolver: async () => entrepreneur,
    });

    await expect(service.getDetail(baseDetailRecord.id)).rejects.toThrow("database internals");
  });
});
