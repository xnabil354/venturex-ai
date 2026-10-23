import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  parseUserId,
  type SafeUser,
} from "../auth/user-types";
import type { TrendDto } from "../trend/dto";
import type { OpportunityListItemDto } from "../opportunity/dto";
import type { OpportunityFinderResult } from "../opportunity/service";
import type {
  BusinessProfileDashboardRecord,
  BusinessProfileDashboardRepositoryPort,
  BusinessProfileDashboardState,
} from "../profile/business-repository";
import type {
  EntrepreneurProfileDashboardRecord,
  EntrepreneurProfileDashboardRepositoryPort,
  EntrepreneurProfileSelectionIds,
} from "../profile/repository";
import type { ReferenceRepositoryPort } from "../reference/repository";
import type {
  CustomerSegmentReference,
  FnbCategoryReference,
  SalesChannelReference,
} from "../reference/types";
import {
  DashboardIncompleteUserError,
  DashboardProfileNotFoundError,
  DashboardQueryService,
  type DashboardQueryServiceDependencies,
} from "./service";

const ENTREPRENEUR_USER_ID = parseUserId("00000000-0000-4000-8000-000000000101");
const BUSINESS_USER_ID = parseUserId("00000000-0000-4000-8000-000000000102");
const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";
const CATEGORY_ID_2 = "10000000-0000-4000-8000-000000000002";
const SEGMENT_ID = "20000000-0000-4000-8000-000000000001";
const CHANNEL_ID = "30000000-0000-4000-8000-000000000001";

function trendDto(overrides: Partial<TrendDto> = {}): TrendDto {
  return {
    id: "60000000-0000-4000-8000-000000000001",
    title: "Pilihan minuman berbasis tanaman meningkat",
    category: {
      code: "CONSUMER_BEHAVIOR",
      name: "Consumer Behavior",
      description: "Observed changes in consumer preferences.",
    },
    subjectArea: null,
    signal: {
      summary: "Ringkasan sinyal yang diterbitkan.",
      description: "Detail tren yang diterbitkan.",
      direction: "RISING",
      observationPeriod: { start: "2026-01-01", end: "2026-06-30" },
    },
    evidence: [],
    businessRelevanceExplanation: null,
    affectedUserTypes: [USER_TYPES.ENTREPRENEUR],
    lifecycleState: "PUBLISHED",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const references = {
  categories: [
    { id: CATEGORY_ID, code: "BEVERAGES", name: "Minuman", parentId: null },
    { id: CATEGORY_ID_2, code: "SNACKS", name: "Camilan", parentId: null },
  ] satisfies readonly FnbCategoryReference[],
  segments: [
    { id: SEGMENT_ID, code: "STUDENTS", name: "Pelajar dan mahasiswa", description: null },
  ] satisfies readonly CustomerSegmentReference[],
  channels: [
    { id: CHANNEL_ID, code: "OFFLINE_STORE", name: "Gerai atau toko offline" },
  ] satisfies readonly SalesChannelReference[],
};

class MemoryReferenceRepository implements ReferenceRepositoryPort {
  async listActiveFnbCategories(): Promise<readonly FnbCategoryReference[]> {
    return references.categories;
  }

  async listActiveCustomerSegments(): Promise<readonly CustomerSegmentReference[]> {
    return references.segments;
  }

  async listActiveSalesChannels(): Promise<readonly SalesChannelReference[]> {
    return references.channels;
  }
}

class MemoryEntrepreneurRepository implements EntrepreneurProfileDashboardRepositoryPort {
  profile: EntrepreneurProfileDashboardRecord | null = {
    id: "40000000-0000-4000-8000-000000000001",
    userId: ENTREPRENEUR_USER_ID,
    locationText: "Jakarta Pusat",
    city: "Jakarta Pusat",
    province: "DKI Jakarta",
    countryCode: "ID",
    budgetMin: 5_000_000,
    budgetMax: 10_000_000,
    experienceLevel: "BEGINNER",
    timeCommitment: "PART_TIME",
    preferredProductType: "Beverage",
  };
  selections: EntrepreneurProfileSelectionIds = {
    interestCategoryIds: [CATEGORY_ID_2, CATEGORY_ID],
    customerSegmentIds: [SEGMENT_ID],
    salesChannelIds: [CHANNEL_ID],
  };
  requestedUserId: string | null = null;

  async findDashboardByUserId(
    userId: typeof ENTREPRENEUR_USER_ID,
  ): Promise<EntrepreneurProfileDashboardRecord | null> {
    this.requestedUserId = userId;
    return this.profile;
  }

  async loadSelectionIds(): Promise<EntrepreneurProfileSelectionIds> {
    return this.selections;
  }
}

class MemoryBusinessRepository implements BusinessProfileDashboardRepositoryPort {
  profile: BusinessProfileDashboardRecord | null = {
    id: "50000000-0000-4000-8000-000000000001",
    userId: BUSINESS_USER_ID,
    businessName: "Kedai Pagi",
    businessCategoryId: CATEGORY_ID,
    locationText: "Bandung",
    city: "Bandung",
    province: "Jawa Barat",
    countryCode: "ID",
    averagePriceMin: 15_000,
    averagePriceMax: 35_000,
  };
  state: BusinessProfileDashboardState = {
    productCount: 3,
    customerSegmentIds: [SEGMENT_ID],
    salesChannelIds: [CHANNEL_ID],
  };
  requestedUserId: string | null = null;

  async findDashboardByUserId(
    userId: typeof BUSINESS_USER_ID,
  ): Promise<BusinessProfileDashboardRecord | null> {
    this.requestedUserId = userId;
    return this.profile;
  }

  async loadDashboardState(): Promise<BusinessProfileDashboardState> {
    return this.state;
  }
}

function user(userId: SafeUser["id"], userType: SafeUser["userType"]): SafeUser {
  return {
    id: userId,
    email: "hidden@example.com",
    userType,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  };
}

function createService(
  currentUser: SafeUser,
  entrepreneurRepository = new MemoryEntrepreneurRepository(),
  businessRepository = new MemoryBusinessRepository(),
  trendServiceFactory?: DashboardQueryServiceDependencies["trendServiceFactory"],
  savedOpportunityServiceFactory?: DashboardQueryServiceDependencies["savedOpportunityServiceFactory"],
  opportunityServiceFactory?: DashboardQueryServiceDependencies["opportunityServiceFactory"],
  roadmapServiceFactory?: DashboardQueryServiceDependencies["roadmapServiceFactory"],
): DashboardQueryService {
  const dependencies: DashboardQueryServiceDependencies = {
    currentUserResolver: async () => currentUser,
    entrepreneurRepository,
    businessRepository,
    referenceRepository: new MemoryReferenceRepository(),
    transactionRunner: async (callback) => callback({} as Transaction),
    trendServiceFactory:
      trendServiceFactory ?? (() => ({ getPublishedTrends: async () => [] })),
    savedOpportunityServiceFactory:
      savedOpportunityServiceFactory ?? (() => ({ listForCurrentUser: async () => ({ status: "EMPTY", items: [] }) })),
    opportunityServiceFactory:
      opportunityServiceFactory ?? (() => ({
        list: async (): Promise<OpportunityFinderResult> => ({
          status: "EMPTY",
          items: [],
          categories: [],
          selectedCategory: null,
          page: 1,
          pageSize: 10,
          totalCount: 0,
          totalPages: 1,
        }),
      })),
    roadmapServiceFactory: roadmapServiceFactory ?? (() => ({
      listForCurrentUser: async () => ({ items: [], page: 1, pageSize: 1, totalCount: 0, totalPages: 1 }),
    })),
  };

  return new DashboardQueryService(dependencies);
}

describe("DashboardQueryService", () => {
  it("returns the completed entrepreneur summary with safe labels", async () => {
    const entrepreneurRepository = new MemoryEntrepreneurRepository();
    const result = await createService(
      user(ENTREPRENEUR_USER_ID, USER_TYPES.ENTREPRENEUR),
      entrepreneurRepository,
    ).get();

    expect(result).toEqual({
      userType: USER_TYPES.ENTREPRENEUR,
      onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
      profile: {
        location: {
          text: "Jakarta Pusat",
          city: "Jakarta Pusat",
          province: "DKI Jakarta",
          countryCode: "ID",
        },
        budget: { min: 5_000_000, max: 10_000_000 },
        experienceLevel: "BEGINNER",
        timeCommitment: "PART_TIME",
        preferredProductType: "Beverage",
        interests: [
          { code: "BEVERAGES", name: "Minuman" },
          { code: "SNACKS", name: "Camilan" },
        ],
        customerSegments: [{ code: "STUDENTS", name: "Pelajar dan mahasiswa" }],
        salesChannels: [{ code: "OFFLINE_STORE", name: "Gerai atau toko offline" }],
      },
      modules: {
        trends: { status: "UNAVAILABLE", preview: [] },
        opportunities: { status: "UNAVAILABLE", preview: [] },
        savedOpportunities: { status: "UNAVAILABLE", preview: [] },
        roadmap: { status: "UNAVAILABLE" },
      },
    });
    expect(entrepreneurRepository.requestedUserId).toBe(ENTREPRENEUR_USER_ID);
  });

  it("keeps the unavailable Roadmap state without invoking its service", async () => {
    const roadmapList = vi.fn(async () => ({ items: [], page: 1, pageSize: 1, totalCount: 1, totalPages: 1 }));
    const roadmapServiceFactory = vi.fn(() => ({ listForCurrentUser: roadmapList }));
    const result = await createService(
      user(BUSINESS_USER_ID, USER_TYPES.UMKM_EXISTING),
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      undefined,
      undefined,
      undefined,
      roadmapServiceFactory,
    ).get();

    expect(roadmapServiceFactory).not.toHaveBeenCalled();
    expect(roadmapList).not.toHaveBeenCalled();
    expect(result.modules.roadmap).toEqual({ status: "UNAVAILABLE" });
  });

  it("does not request published Trend previews while the module is unavailable", async () => {
    const entrepreneur = user(ENTREPRENEUR_USER_ID, USER_TYPES.ENTREPRENEUR);
    const records = [
      trendDto({
        id: "60000000-0000-4000-8000-000000000009",
        title: "Different audience",
        affectedUserTypes: [USER_TYPES.UMKM_EXISTING],
        createdAt: "2026-10-06T00:00:00.000Z",
      }),
      trendDto({
        id: "60000000-0000-4000-8000-000000000008",
        title: "Not yet published",
        lifecycleState: "DRAFT",
        createdAt: "2026-10-05T00:00:00.000Z",
      }),
      trendDto({
        id: "60000000-0000-4000-8000-000000000002",
        title: "Tie second",
        createdAt: "2026-10-02T00:00:00.000Z",
      }),
      trendDto({
        id: "60000000-0000-4000-8000-000000000001",
        title: "Tie first",
        createdAt: "2026-10-02T00:00:00.000Z",
      }),
      trendDto({
        id: "60000000-0000-4000-8000-000000000006",
        title: "Newest eligible",
        createdAt: "2026-10-03T00:00:00.000Z",
      }),
    ];
    const trendServiceFactory = vi.fn(() => ({
      getPublishedTrends: async () => records,
    }));

    const result = await createService(
      entrepreneur,
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      trendServiceFactory,
    ).get();

    expect(trendServiceFactory).not.toHaveBeenCalled();
    expect(result.modules.trends).toEqual({
      status: "UNAVAILABLE",
      preview: [],
    });
  });

  it("does not request Trend previews for UMKM while the module is unavailable", async () => {
    const umkm = user(BUSINESS_USER_ID, USER_TYPES.UMKM_EXISTING);
    const records = [
      trendDto({
        id: "60000000-0000-4000-8000-000000000003",
        title: "Entrepreneur only",
      }),
      trendDto({
        id: "60000000-0000-4000-8000-000000000004",
        title: "UMKM eligible",
        affectedUserTypes: [USER_TYPES.UMKM_EXISTING],
      }),
    ];

    const trendServiceFactory = vi.fn(() => ({ getPublishedTrends: async () => records }));
    const result = await createService(
      umkm,
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      trendServiceFactory,
    ).get();

    expect(trendServiceFactory).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      userType: USER_TYPES.UMKM_EXISTING,
      profile: { businessName: "Kedai Pagi", productCount: 3 },
      modules: {
        trends: { status: "UNAVAILABLE", preview: [] },
      },
    });
  });

  it.each([
    [USER_TYPES.ENTREPRENEUR, ENTREPRENEUR_USER_ID],
    [USER_TYPES.UMKM_EXISTING, BUSINESS_USER_ID],
  ] as const)("does not load saved opportunities for the persisted %s user while unavailable", async (userType, userId) => {
    const currentUser = user(userId, userType);
    const opportunities: OpportunityListItemDto[] = Array.from({ length: 4 }, (_, index) => ({
      id: `90000000-0000-4000-8000-00000000000${index + 1}`,
      name: `Peluang tersimpan ${index + 1}`,
      categoryName: "Minuman",
      summary: "Peluang yang disimpan pengguna aktif.",
      relatedTrend: { id: `70000000-0000-4000-8000-00000000000${index + 1}`, title: "Trend terkait" },
    }));
    const listForCurrentUser = vi.fn(async (limit?: number) => ({
        status: "AVAILABLE" as const,
        items: opportunities.slice(0, limit),
      }));
    const savedOpportunityServiceFactory = vi.fn(() => ({ listForCurrentUser }));

    const result = await createService(
      currentUser,
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      undefined,
      savedOpportunityServiceFactory,
    ).get();

    expect(savedOpportunityServiceFactory).not.toHaveBeenCalled();
    expect(listForCurrentUser).not.toHaveBeenCalled();
    expect(result.modules.savedOpportunities).toEqual({
      status: "UNAVAILABLE",
      preview: [],
    });
    expect(result.modules.savedOpportunities.preview).toHaveLength(0);
  });

  it("keeps unimplemented modules unavailable when injected services would return no records", async () => {
    const trendServiceFactory = vi.fn(() => ({ getPublishedTrends: async () => [] }));
    const savedOpportunityServiceFactory = vi.fn(() => ({ listForCurrentUser: async () => ({ status: "EMPTY" as const, items: [] as const }) }));
    const opportunityServiceFactory = vi.fn(() => ({
      list: async (): Promise<OpportunityFinderResult> => ({ status: "EMPTY", items: [], categories: [], selectedCategory: null, page: 1, pageSize: 10, totalCount: 0, totalPages: 1 }),
    }));
    const result = await createService(
      user(ENTREPRENEUR_USER_ID, USER_TYPES.ENTREPRENEUR),
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      trendServiceFactory,
      savedOpportunityServiceFactory,
      opportunityServiceFactory,
    ).get();

    expect(trendServiceFactory).not.toHaveBeenCalled();
    expect(savedOpportunityServiceFactory).not.toHaveBeenCalled();
    expect(opportunityServiceFactory).not.toHaveBeenCalled();
    expect(result.modules).toEqual({
      trends: { status: "UNAVAILABLE", preview: [] },
      opportunities: { status: "UNAVAILABLE", preview: [] },
      savedOpportunities: { status: "UNAVAILABLE", preview: [] },
      roadmap: { status: "UNAVAILABLE" },
    });
  });

  it("does not translate an unavailable saved-opportunity capability into ERROR", async () => {
    const savedOpportunityServiceFactory = vi.fn(() => ({ listForCurrentUser: async () => ({ status: "ERROR" as const }) }));
    const result = await createService(
      user(ENTREPRENEUR_USER_ID, USER_TYPES.ENTREPRENEUR),
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      undefined,
      savedOpportunityServiceFactory,
    ).get();

    expect(savedOpportunityServiceFactory).not.toHaveBeenCalled();
    expect(result.modules.savedOpportunities).toEqual({ status: "UNAVAILABLE", preview: [] });
  });

  it("isolates saved-opportunity failures from profile and Trend data", async () => {
    const trend = trendDto({ affectedUserTypes: [USER_TYPES.UMKM_EXISTING] });
    const trendServiceFactory = vi.fn(() => ({ getPublishedTrends: async () => [trend] }));
    const savedOpportunityServiceFactory = vi.fn(() => ({ listForCurrentUser: async () => Promise.reject(new Error("saved storage failed")) }));
    const result = await createService(
      user(BUSINESS_USER_ID, USER_TYPES.UMKM_EXISTING),
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      trendServiceFactory,
      savedOpportunityServiceFactory,
    ).get();

    expect(trendServiceFactory).not.toHaveBeenCalled();
    expect(savedOpportunityServiceFactory).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      userType: USER_TYPES.UMKM_EXISTING,
      profile: { businessName: "Kedai Pagi", productCount: 3 },
      modules: {
        trends: { status: "UNAVAILABLE", preview: [] },
        savedOpportunities: { status: "UNAVAILABLE", preview: [] },
      },
    });
    expect(JSON.stringify(result)).not.toContain("saved storage failed");
  });

  it.each([
    [USER_TYPES.ENTREPRENEUR, ENTREPRENEUR_USER_ID],
    [USER_TYPES.UMKM_EXISTING, BUSINESS_USER_ID],
  ] as const)("does not load the Opportunity catalog for the persisted %s user while unavailable", async (userType, userId) => {
    const currentUser = user(userId, userType);
    const items: OpportunityListItemDto[] = Array.from({ length: 4 }, (_, index) => ({
      id: `91000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: `Peluang katalog ${index + 1}`,
      categoryName: "Minuman",
      summary: `Ringkasan katalog ${index + 1}.`,
      relatedTrend: {
        id: `71000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        title: `Trend terkait ${index + 1}`,
      },
    }));
    const list = vi.fn(async (): Promise<OpportunityFinderResult> => ({
      status: "AVAILABLE",
      items,
      categories: [],
      selectedCategory: null,
      page: 1,
      pageSize: 10,
      totalCount: items.length,
      totalPages: 1,
    }));
    const opportunityServiceFactory = vi.fn(() => ({ list }));

    const result = await createService(
      currentUser,
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      undefined,
      undefined,
      opportunityServiceFactory,
    ).get();

    expect(opportunityServiceFactory).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(result.modules.opportunities).toEqual({
      status: "UNAVAILABLE",
      preview: [],
    });
  });

  it("keeps Opportunity unavailable when the catalog has no records", async () => {
    const result = await createService(
      user(ENTREPRENEUR_USER_ID, USER_TYPES.ENTREPRENEUR),
    ).get();

    expect(result.modules.opportunities).toEqual({ status: "UNAVAILABLE", preview: [] });
  });

  it("isolates Opportunity preview failures from profile, Trend, and Saved previews", async () => {
    const trend = trendDto({ affectedUserTypes: [USER_TYPES.UMKM_EXISTING] });
    const savedItem: OpportunityListItemDto = {
      id: "92000000-0000-4000-8000-000000000001",
      name: "Tersimpan",
      categoryName: "Minuman",
      summary: "Kesempatan tersimpan.",
      relatedTrend: {
        id: "72000000-0000-4000-8000-000000000001",
        title: "Trend tersimpan",
      },
    };
    const trendServiceFactory = vi.fn(() => ({ getPublishedTrends: async () => [trend] }));
    const savedOpportunityServiceFactory = vi.fn(() => ({ listForCurrentUser: async () => ({ status: "AVAILABLE" as const, items: [savedItem] }) }));
    const opportunityServiceFactory = vi.fn(() => ({ list: async () => Promise.reject(new Error("catalog database detail")) }));
    const result = await createService(
      user(BUSINESS_USER_ID, USER_TYPES.UMKM_EXISTING),
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      trendServiceFactory,
      savedOpportunityServiceFactory,
      opportunityServiceFactory,
    ).get();

    expect(trendServiceFactory).not.toHaveBeenCalled();
    expect(savedOpportunityServiceFactory).not.toHaveBeenCalled();
    expect(opportunityServiceFactory).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      userType: USER_TYPES.UMKM_EXISTING,
      profile: { businessName: "Kedai Pagi", productCount: 3 },
      modules: {
        trends: { status: "UNAVAILABLE", preview: [] },
        savedOpportunities: { status: "UNAVAILABLE", preview: [] },
        opportunities: { status: "UNAVAILABLE", preview: [] },
      },
    });
    expect(JSON.stringify(result)).not.toContain("catalog database detail");
  });

  it("isolates Trend query failures from the completed profile summary", async () => {
    const trendServiceFactory = vi.fn(() => ({ getPublishedTrends: async () => Promise.reject(new Error("private database detail")) }));
    const result = await createService(
      user(BUSINESS_USER_ID, USER_TYPES.UMKM_EXISTING),
      new MemoryEntrepreneurRepository(),
      new MemoryBusinessRepository(),
      trendServiceFactory,
    ).get();

    expect(trendServiceFactory).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      userType: USER_TYPES.UMKM_EXISTING,
      profile: { businessName: "Kedai Pagi", productCount: 3 },
      modules: { trends: { status: "UNAVAILABLE", preview: [] } },
    });
    expect(JSON.stringify(result)).not.toContain("private database detail");
  });

  it("returns the completed UMKM summary with a product count", async () => {
    const businessRepository = new MemoryBusinessRepository();
    const result = await createService(
      user(BUSINESS_USER_ID, USER_TYPES.UMKM_EXISTING),
      new MemoryEntrepreneurRepository(),
      businessRepository,
    ).get();

    expect(result).toMatchObject({
      userType: USER_TYPES.UMKM_EXISTING,
      profile: {
        businessName: "Kedai Pagi",
        businessCategory: { code: "BEVERAGES", name: "Minuman" },
        averagePrice: { min: 15_000, max: 35_000 },
        productCount: 3,
      },
    });
    expect(businessRepository.requestedUserId).toBe(BUSINESS_USER_ID);
  });

  it("blocks incomplete users before querying a profile", async () => {
    const incompleteUser = {
      ...user(ENTREPRENEUR_USER_ID, USER_TYPES.ENTREPRENEUR),
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    } satisfies SafeUser;

    await expect(createService(incompleteUser).get()).rejects.toBeInstanceOf(
      DashboardIncompleteUserError,
    );
  });

  it("handles a missing entrepreneur profile without creating one", async () => {
    const entrepreneurRepository = new MemoryEntrepreneurRepository();
    entrepreneurRepository.profile = null;

    await expect(
      createService(
        user(ENTREPRENEUR_USER_ID, USER_TYPES.ENTREPRENEUR),
        entrepreneurRepository,
      ).get(),
    ).rejects.toMatchObject({
      name: "DashboardProfileNotFoundError",
      userType: USER_TYPES.ENTREPRENEUR,
    } satisfies Partial<DashboardProfileNotFoundError>);
    expect(entrepreneurRepository.profile).toBeNull();
  });

  it("handles a missing business profile without creating one", async () => {
    const businessRepository = new MemoryBusinessRepository();
    businessRepository.profile = null;

    await expect(
      createService(
        user(BUSINESS_USER_ID, USER_TYPES.UMKM_EXISTING),
        new MemoryEntrepreneurRepository(),
        businessRepository,
      ).get(),
    ).rejects.toMatchObject({
      name: "DashboardProfileNotFoundError",
      userType: USER_TYPES.UMKM_EXISTING,
    } satisfies Partial<DashboardProfileNotFoundError>);
    expect(businessRepository.profile).toBeNull();
  });

  it("does not leak model fields, ownership ids, or password data", async () => {
    const result = await createService(
      user(ENTREPRENEUR_USER_ID, USER_TYPES.ENTREPRENEUR),
    ).get();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("businessObjective");
    expect(serialized).not.toContain("profileVersion");
    expect(serialized).not.toContain(ENTREPRENEUR_USER_ID);
    expect(serialized).not.toContain("40000000-0000-4000-8000-000000000001");
  });
});
