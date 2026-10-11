import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  notFound: vi.fn(),
  list: vi.fn(),
  resolver: null as null | (() => Promise<unknown>),
  constructorCalls: 0,
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/opportunity/saved-service", () => ({
  SavedOpportunityService: class MockSavedOpportunityService {
    constructor(dependencies: { currentUserResolver: () => Promise<unknown> }) {
      mocks.constructorCalls += 1;
      mocks.resolver = dependencies.currentUserResolver;
    }

    listForCurrentUser() {
      return mocks.list();
    }
  },
}));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  userIdSchema,
  type SafeUser,
} from "@/auth/user-types";
import SavedPage from "./page";

const persistedUser: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

describe("/saved page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolver = null;
    mocks.constructorCalls = 0;
    mocks.notFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
  });

  it("renders persisted saved opportunities using the authenticated user's identity", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.list.mockResolvedValue({
      status: "AVAILABLE",
      items: [{
        id: "60000000-0000-4000-8000-000000000001",
        name: "Menu minuman tersimpan",
        categoryName: "Minuman",
        summary: "Ringkasan peluang tersimpan.",
        relatedTrend: {
          id: "70000000-0000-4000-8000-000000000001",
          title: "Trend terpublikasi",
        },
      }],
    });

    const markup = renderToStaticMarkup(await SavedPage());

    expect(markup).toContain("Menu minuman tersimpan");
    expect(markup).toContain("Trend terpublikasi");
    expect(markup).toContain('href="/opportunities/60000000-0000-4000-8000-000000000001"');
    expect(mocks.constructorCalls).toBe(1);
    expect(await mocks.resolver?.()).toBe(persistedUser);
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing user", null],
    ["incomplete onboarding", {
      ...persistedUser,
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    }],
    ["missing user type", { ...persistedUser, userType: null }],
    ["unsupported user type", { ...persistedUser, userType: "UNKNOWN" }],
  ])("denies a %s before creating the list service", async (_case, user) => {
    mocks.currentUser.mockResolvedValue(user);

    await expect(SavedPage()).rejects.toThrow("NOT_FOUND");

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.constructorCalls).toBe(0);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("shows a safe error state if saved opportunities cannot be loaded", async () => {
    mocks.currentUser.mockResolvedValue(persistedUser);
    mocks.list.mockRejectedValue(new Error("database internals"));

    const markup = renderToStaticMarkup(await SavedPage());

    expect(markup).toContain("Peluang tersimpan belum dapat dimuat");
    expect(markup).toContain('href="/saved"');
    expect(markup).not.toContain("database internals");
  });
});
