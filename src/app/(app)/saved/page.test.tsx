import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  notFound: vi.fn(),
  list: vi.fn(),
  resolver: null as null | (() => Promise<unknown>),
  constructorCalls: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/opportunity/private-hypothesis-repository", () => ({
  PrivateOpportunityHypothesisRepository: class MockPrivateOpportunityHypothesisRepository {
    constructor() {
      mocks.constructorCalls += 1;
    }

    listForUser(...args: unknown[]) {
      return mocks.list(...args);
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
    mocks.list.mockResolvedValue([{
      id: "60000000-0000-4000-8000-000000000001",
      hypothesis: {
        title: "Menu minuman tersimpan",
        concept: "Ringkasan peluang tersimpan.",
        targetCustomer: "Segmen keluarga",
        validationSteps: ["Langkah 1"],
        assumptions: ["Asumsi 1"],
      },
      source: {
        publisher: "Google Trends",
        title: "Trend terpublikasi",
        retrievedAt: new Date().toISOString(),
        classification: "LIKELY_FNB",
      },
      provider: "ninerouter",
      model: "cx/gpt-6-luna-xhigh",
      generatedAt: new Date().toISOString(),
      saved: true,
    }]);

    const markup = renderToStaticMarkup(await SavedPage());

    expect(markup).toContain("Menu minuman tersimpan");
    expect(markup).toContain("Trend terpublikasi");
    expect(mocks.constructorCalls).toBe(1);
    expect(mocks.list).toHaveBeenCalledWith(persistedUser.id, true);
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

    expect(markup).toContain("Penyimpanan belum tersedia");
    expect(markup).toContain('href="/opportunities"');
    expect(markup).not.toContain("database internals");
  });
});
