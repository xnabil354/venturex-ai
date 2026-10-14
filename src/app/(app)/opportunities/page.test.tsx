import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  latestForUser: vi.fn(),
  listForUser: vi.fn(),
  readNineRouterConfig: vi.fn(() => null),
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/trend/live-signals", () => ({
  getLiveTrendSignalsService: () => ({ latestForUser: mocks.latestForUser }),
}));
vi.mock("@/opportunity/private-hypothesis-repository", () => ({
  PrivateOpportunityHypothesisRepository: class {
    listForUser(...args: unknown[]) {
      return mocks.listForUser(...args);
    }
  },
}));
vi.mock("@/ai-analysis/ninerouter", () => ({ readNineRouterConfig: mocks.readNineRouterConfig }));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "@/auth/user-types";
import OpportunitiesPage from "./page";

const completedUser: SafeUser = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000001"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

describe("/opportunities private live-first page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.latestForUser.mockReturnValue(null);
    mocks.listForUser.mockResolvedValue([]);
    mocks.readNineRouterConfig.mockReturnValue(null);
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "renders the private hypothesis flow for %s and never queries archived global opportunities",
    async (userType) => {
      const user: SafeUser = { ...completedUser, userType };
      mocks.currentUser.mockResolvedValue(user);
      const markup = renderToStaticMarkup(await OpportunitiesPage()).replace(/s+/gu, " ");

      expect(markup).toContain("Opportunity Finder");
      expect(markup).toContain("Belum ada sinyal F&amp;B live");
      expect(markup).not.toContain("Matcha");
      expect(markup).not.toContain("Rempeyek");
      expect(mocks.latestForUser).toHaveBeenCalledWith(user.id);
      expect(mocks.listForUser).toHaveBeenCalledWith(user.id);
    },
  );

  it("rejects an unauthenticated page", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(OpportunitiesPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.listForUser).not.toHaveBeenCalled();
  });

  it("shows storage unavailability without generating or exposing catalog data", async () => {
    mocks.currentUser.mockResolvedValue(completedUser);
    mocks.listForUser.mockRejectedValue(new Error("database internals"));

    const markup = renderToStaticMarkup(await OpportunitiesPage()).replace(/s+/gu, " ");

    expect(markup).toContain("Penyimpanan hipotesis belum siap");
    expect(markup).not.toContain("database internals");
    expect(markup).not.toContain("Matcha");
  });
});