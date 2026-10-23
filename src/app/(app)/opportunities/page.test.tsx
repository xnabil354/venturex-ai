import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/profile/business-service", () => ({ BusinessProfileService: class { async getForEdit() { return { businessName: "Kedai", businessCategoryId: "category", products: [{ name: "Kopi" }] }; } } }));
vi.mock("@/reference/repository", () => ({ ReferenceRepository: class { async listActiveFnbCategories() { return [{ id: "category", name: "Minuman" }]; } } }));
vi.mock("@/components/trends/business-query-select", () => ({ BusinessQuerySelect: () => null }));

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  listForUser: vi.fn(),
  readNineRouterConfig: vi.fn((): { baseURL: string } | null => null),
  signingConfigured: vi.fn(() => false),
  transportAllowed: vi.fn(() => false),
  buildProfileContext: vi.fn(),
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/opportunity/private-hypothesis-repository", () => ({
  PrivateOpportunityHypothesisRepository: class {
    async listBusinessPage(userId: string, page: number) { return { items: await mocks.listForUser(userId), page, hasMore: false }; }
    async listPageForUser(userId: string, page: number) { return { items: await mocks.listForUser(userId), page, hasMore: false }; }
    listForUser(...args: unknown[]) {
      return mocks.listForUser(...args);
    }
  },
}));
vi.mock("@/opportunity/opportunity-analysis-context", () => ({
  DatabaseOpportunityProfileContextBuilder: class {
    build(...args: unknown[]) {
      return mocks.buildProfileContext(...args);
    }
  },
}));
vi.mock("@/ai-analysis/ninerouter", () => ({
  readLocalProfileNineRouterConfig: mocks.readNineRouterConfig,
  isPublicHttpTransport: vi.fn(() => false),
  isLoopbackHttpTransport: vi.fn((value?: string | null) => value?.startsWith("http://localhost:") ?? false),
  isLocalProfileNineRouterTransportAllowed: mocks.transportAllowed,
}));
vi.mock("@/opportunity/searchapi-evidence-token", () => ({
  isSearchApiEvidenceTokenConfigured: mocks.signingConfigured,
}));

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
    vi.unstubAllEnvs();
    mocks.listForUser.mockResolvedValue([]);
    mocks.readNineRouterConfig.mockReturnValue(null);
    mocks.signingConfigured.mockReturnValue(false);
    mocks.buildProfileContext.mockImplementation((user: { userType: string }) => Promise.resolve({
      profile: { persona: user.userType },
      dataAvailability: {
        profileFieldsPresent: user.userType === USER_TYPES.ENTREPRENEUR
          ? ["profile.categories", "profile.customerSegments", "profile.salesChannels", "profile.budget", "profile.location", "profile.experienceLevel", "profile.timeCommitment"]
          : ["profile.businessName", "profile.businessCategory", "profile.products", "profile.averagePrice", "profile.customerSegments", "profile.salesChannels", "profile.location"],
        profileFieldsMissing: [],
      },
    }));
  });

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "renders the private hypothesis flow for %s and never queries archived global opportunities",
    async (userType) => {
      const user: SafeUser = { ...completedUser, userType };
      mocks.currentUser.mockResolvedValue(user);
      const markup = renderToStaticMarkup(await OpportunitiesPage({})).replace(/\s+/gu, " ");

      expect(markup).toContain("Opportunity Finder");
      expect(markup).toContain("Muat sinyal");
      expect(markup).toContain("Atur wilayah dan filter, lalu muat sinyal Google Trends.");
      expect(markup).not.toContain("Belum ada sinyal F&amp;B live");
      expect(markup).not.toContain("Matcha");
      expect(markup).not.toContain("Rempeyek");
      expect(mocks.listForUser).toHaveBeenCalledWith(user.id);
    },
  );

  it("shows profile-data categories for consent without rendering raw profile context", async () => {
    const rawProfileMarker = "synthetic-private-note-should-stay-server-only";
    mocks.currentUser.mockResolvedValue(completedUser);
    mocks.buildProfileContext.mockResolvedValueOnce({
      profile: { persona: USER_TYPES.ENTREPRENEUR, notes: rawProfileMarker },
      dataAvailability: {
        profileFieldsPresent: ["profile.categories", "profile.budget", "profile.location", "profile.notes"],
        profileFieldsMissing: [],
      },
    });

    const markup = renderToStaticMarkup(await OpportunitiesPage({})).replace(/\s+/gu, " ");

    expect(markup).toContain("Kategori konteks profil yang akan digunakan");
    expect(markup).toContain("Catatan profil");
    expect(markup).not.toContain(rawProfileMarker);
    expect(markup).not.toContain(completedUser.email);
  });

  it("rejects an unauthenticated page", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(OpportunitiesPage({})).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.listForUser).not.toHaveBeenCalled();
  });

  it("shows storage unavailability without generating or exposing catalog data", async () => {
    mocks.currentUser.mockResolvedValue(completedUser);
    mocks.listForUser.mockRejectedValue(new Error("database internals"));

    const markup = renderToStaticMarkup(await OpportunitiesPage({})).replace(/\s+/gu, " ");

    expect(markup).toContain("Penyimpanan hipotesis belum siap");
    expect(markup).not.toContain("database internals");
    expect(markup).not.toContain("Matcha");
  });

  it("uses the shared transport decision for a local gateway without requiring tunnel confirmation", async () => {
    mocks.currentUser.mockResolvedValue(completedUser);
    mocks.readNineRouterConfig.mockReturnValue({ baseURL: "http://localhost:20128/v1" });
    mocks.transportAllowed.mockReturnValue(true);
    vi.stubEnv("NINEROUTER_BASE_URL", "http://localhost:20128/v1");
    vi.stubEnv("AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED", "true");
    vi.stubEnv("NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED", "true");

    const markup = renderToStaticMarkup(await OpportunitiesPage({})).replace(/\s+/gu, " ");

    expect(mocks.transportAllowed).toHaveBeenCalledWith("http://localhost:20128/v1");
    expect(markup).not.toContain("tunnel HTTP loopback belum dikonfirmasi");
  });
});
