import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  entrepreneurProfile: vi.fn(),
  businessProfile: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/reference/repository", () => ({ ReferenceRepository: class { async listActiveFnbCategories() { return []; } } }));
vi.mock("@/components/trends/business-query-select", () => ({ BusinessQuerySelect: () => null }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/profile/service", () => ({
  EntrepreneurProfileService: class {
    getForEdit(userId: string) { return mocks.entrepreneurProfile(userId); }
  },
}));
vi.mock("@/profile/business-service", () => ({
  BusinessProfileService: class {
    getForEdit(userId: string) { return mocks.businessProfile(userId); }
  },
}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "@/auth/user-types";
import TrendsPage from "./page";

const completedUser: SafeUser = {
  id: userIdSchema.parse("70000000-0000-4000-8000-000000000002"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

describe("/trends live-first page", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING])(
    "renders the SearchApi Explore flow for %s without archived catalog data",
    async (userType) => {
      mocks.currentUser.mockResolvedValue({ ...completedUser, userType });
      mocks.entrepreneurProfile.mockResolvedValue({ preferredProductType: "Soto Ayam" });
      mocks.businessProfile.mockResolvedValue({ businessName: "Kopi", products: [{ name: "Matcha" }] });
      const markup = renderToStaticMarkup(await TrendsPage({})).replace(/\s+/gu, " ");

      expect(markup).not.toContain("Google Trends Explore");
      expect(markup).toContain("Tren Saat Ini");
      expect(markup).toContain(userType === USER_TYPES.ENTREPRENEUR ? "Soto Ayam" : "Kopi");
      expect(markup).not.toContain("value=\"Matcha\"");
      expect(markup).not.toContain("Trending Now");
      expect(markup).not.toContain("Kata kunci produk dari profil");
      expect(markup).not.toContain("Rempeyek");
    },
  );

  it("rejects an unauthenticated page", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(TrendsPage({})).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
