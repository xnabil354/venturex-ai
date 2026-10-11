import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  notFound: vi.fn(),
  list: vi.fn(),
  currentUserResolver: null as null | (() => Promise<unknown>),
  pages: [] as unknown[],
  categories: [] as unknown[],
  resolvedUsers: [] as unknown[],
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/opportunity/service", () => ({
  OpportunityService: class MockOpportunityService {
    constructor(dependencies: { currentUserResolver: () => Promise<unknown> }) {
      mocks.currentUserResolver = dependencies.currentUserResolver;
    }

    async list(page: unknown, category: unknown) {
      mocks.pages.push(page);
      mocks.categories.push(category);
      const resolver = mocks.currentUserResolver;
      if (!resolver) throw new Error("The current-user resolver was not supplied.");
      mocks.resolvedUsers.push(await resolver());
      return mocks.list(page, category);
    }
  },
}));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  userIdSchema,
  type SafeUser,
} from "@/auth/user-types";
import OpportunitiesPage from "./page";

const persistedUser: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

describe("/opportunities page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUserResolver = null;
    mocks.pages.length = 0;
    mocks.categories.length = 0;
    mocks.resolvedUsers.length = 0;
    mocks.notFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "passes the persisted %s identity to the server-side catalog service",
    async (userType) => {
      const user: SafeUser = { ...persistedUser, userType };
      mocks.currentUser.mockResolvedValue(user);
      mocks.list.mockResolvedValue({
        status: "EMPTY",
        items: [],
        categories: [],
        selectedCategory: null,
        page: 1,
        pageSize: 10,
        totalCount: 0,
        totalPages: 1,
      });

      const markup = renderToStaticMarkup(await OpportunitiesPage({
        searchParams: Promise.resolve({ page: "2" }),
      })).replace(/\s+/gu, " ");

      expect(markup).toContain("Opportunity Finder");
      expect(mocks.currentUser).toHaveBeenCalledOnce();
      expect(mocks.resolvedUsers).toEqual([user]);
      expect(mocks.pages).toEqual(["2"]);
      expect(mocks.categories).toEqual([undefined]);
      expect(mocks.list).toHaveBeenCalledWith("2", undefined);
    },
  );

  it("passes the category query to the server-side service without trusting client identity", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.list.mockResolvedValue({
      status: "INVALID_CATEGORY",
      items: [],
      categories: [{ code: "BEVERAGES", name: "Minuman" }],
      selectedCategory: null,
    });

    await OpportunitiesPage({
      searchParams: Promise.resolve({ page: "4", category: "BEVERAGES" }),
    });

    expect(mocks.list).toHaveBeenCalledWith("4", "BEVERAGES");
    expect(mocks.resolvedUsers).toEqual([persistedUser]);
  });

  it("passes duplicate category parameters through for safe service validation", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.list.mockResolvedValue({
      status: "INVALID_CATEGORY",
      items: [],
      categories: [],
      selectedCategory: null,
    });

    await OpportunitiesPage({
      searchParams: Promise.resolve({ category: ["BEVERAGES", "SNACKS"] }),
    });

    expect(mocks.list).toHaveBeenCalledWith(1, ["BEVERAGES", "SNACKS"]);
  });

  it.each([
    ["missing user", null],
    ["incomplete onboarding", {
      ...persistedUser,
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    }],
    ["missing user type", { ...persistedUser, userType: null }],
    ["unsupported user type", { ...persistedUser, userType: "UNKNOWN" }],
  ])("denies a %s before querying the service", async (_case, user) => {
    mocks.currentUser.mockResolvedValue(user);

    await expect(OpportunitiesPage({ searchParams: Promise.resolve({}) }))
      .rejects.toThrow("NOT_FOUND");
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("shows ERROR when the catalog service fails instead of showing EMPTY", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.list.mockRejectedValue(new Error("database internals"));

    const markup = renderToStaticMarkup(await OpportunitiesPage({
      searchParams: Promise.resolve({}),
    })).replace(/\s+/gu, " ");

    expect(markup).toContain("Katalog peluang belum dapat dimuat");
    expect(markup).not.toContain("Belum ada peluang tersimpan");
    expect(markup).not.toContain("database internals");
  });
});
