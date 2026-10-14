import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  entrepreneurProfile: vi.fn(),
  businessProfile: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("server-only", () => ({}));
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
    "renders the live observation flow for %s without archived catalog data",
    async (userType) => {
      mocks.currentUser.mockResolvedValue({ ...completedUser, userType });
      mocks.entrepreneurProfile.mockResolvedValue({ preferredProductType: "Bakso" });
      mocks.businessProfile.mockResolvedValue({ products: [{ name: "Bakso" }] });
      const markup = renderToStaticMarkup(await TrendsPage()).replace(/\s+/gu, " ");

      expect(markup).toContain("Observasi Google Trends Indonesia");
      expect(markup).toContain("Muat sinyal terbaru");
      expect(markup).toContain('value="Bakso"');
      expect(markup).not.toContain("Matcha");
      expect(markup).not.toContain("Rempeyek");
    },
  );

  it("rejects an unauthenticated page", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(TrendsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
