import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getForEdit: vi.fn(),
  getBusinessForEdit: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  userIds: [] as string[],
  businessUserIds: [] as string[],
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/profile/service", () => ({
  EntrepreneurProfileService: class MockEntrepreneurProfileService {
    async getForEdit(userId: string) {
      mocks.userIds.push(userId);
      return mocks.getForEdit(userId);
    }
  },
}));
vi.mock("@/profile/business-service", () => ({
  BusinessProfileService: class MockBusinessProfileService {
    async getForEdit(userId: string) {
      mocks.businessUserIds.push(userId);
      return mocks.getBusinessForEdit(userId);
    }
  },
}));
vi.mock("@/profile/business-errors", () => ({
  BusinessProfileForbiddenError: class BusinessProfileForbiddenError extends Error {},
  BusinessProfileNotFoundError: class BusinessProfileNotFoundError extends Error {},
  BusinessProfileStateError: class BusinessProfileStateError extends Error {},
}));
vi.mock("@/components/onboarding/entrepreneur-profile-form", () => ({
  EntrepreneurProfileForm: ({ initialValues, mode }: {
    readonly initialValues: { readonly location: { readonly text: string } };
    readonly mode: string;
  }) => (
    <div data-location={initialValues.location.text} data-mode={mode}>
      Entrepreneur profile form
    </div>
  ),
}));
vi.mock("@/components/onboarding/business-profile-form", () => ({
  BusinessProfileForm: ({ initialValues, mode }: {
    readonly initialValues: { readonly businessName: string };
    readonly mode: string;
  }) => (
    <div data-business-name={initialValues.businessName} data-mode={mode}>
      Business profile form
    </div>
  ),
}));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  userIdSchema,
  type SafeUser,
} from "@/auth/user-types";
import { BusinessProfileNotFoundError } from "@/profile/business-errors";
import ProfilePage from "./page";

const user: SafeUser = {
  id: userIdSchema.parse("70000000-0000-4000-8000-000000000002"),
  email: "founder@example.com",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

const storedProfile = {
  location: { text: "Bandung", city: "Bandung", province: "Jawa Barat", countryCode: "ID" as const },
  budget: { min: 2_000_000, max: 8_000_000 },
  experienceLevel: "SOME_EXPERIENCE" as const,
  timeCommitment: "FULL_TIME" as const,
  interestCategoryIds: ["10000000-0000-4000-8000-000000000001"],
  customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
  salesChannelIds: ["30000000-0000-4000-8000-000000000001"],
  preferredProductType: null,
  businessObjective: "Menguji usaha makanan.",
  notes: null,
};

const businessUser: SafeUser = {
  ...user,
  userType: USER_TYPES.UMKM_EXISTING,
};

const storedBusinessProfile = {
  businessName: "Kedai Pagi",
  businessCategoryId: "10000000-0000-4000-8000-000000000001",
  location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
  averagePrice: { min: 15000, max: 35000 },
  products: [
    { name: "Kopi Susu", categoryId: "10000000-0000-4000-8000-000000000001", price: 18000 },
    { name: "Teh Lemon", categoryId: null, price: null },
  ],
  customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
  salesChannelIds: ["30000000-0000-4000-8000-000000000001"],
  businessDescription: "Kedai minuman keluarga.",
  notes: "Catatan pemilik.",
};

describe("/profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userIds.length = 0;
    mocks.businessUserIds.length = 0;
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`REDIRECT:${destination}`);
    });
    mocks.notFound.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
  });

  it("loads the signed-in entrepreneur's persisted data into edit mode", async () => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.getForEdit.mockResolvedValue(storedProfile);

    const markup = renderToStaticMarkup(await ProfilePage()).replace(/\s+/gu, " ");

    expect(markup).toContain("data-mode=\"edit\"");
    expect(markup).toContain("data-location=\"Bandung\"");
    expect(mocks.userIds).toEqual([user.id]);
  });

  it("redirects guests to login before loading profile data", async () => {
    mocks.currentUser.mockResolvedValue(null);

    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.getForEdit).not.toHaveBeenCalled();
  });

  it("loads the signed-in UMKM owner's complete business profile into edit mode", async () => {
    mocks.currentUser.mockResolvedValue(businessUser);
    mocks.getBusinessForEdit.mockResolvedValue(storedBusinessProfile);

    const markup = renderToStaticMarkup(await ProfilePage()).replace(/\s+/gu, " ");

    expect(markup).toContain("data-mode=\"edit\"");
    expect(markup).toContain("data-business-name=\"Kedai Pagi\"");
    expect(mocks.businessUserIds).toEqual([businessUser.id]);
    expect(mocks.userIds).toEqual([]);
  });

  it("does not expose an unavailable business profile", async () => {
    mocks.currentUser.mockResolvedValue(businessUser);
    mocks.getBusinessForEdit.mockRejectedValue(new BusinessProfileNotFoundError());

    await expect(ProfilePage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.businessUserIds).toEqual([businessUser.id]);
  });

  it("redirects unsupported user types to Dashboard without loading profile data", async () => {
    mocks.currentUser.mockResolvedValue({ ...user, userType: null });

    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.getForEdit).not.toHaveBeenCalled();
    expect(mocks.getBusinessForEdit).not.toHaveBeenCalled();
  });

  it.each([
    [user, "/onboarding/entrepreneur"],
    [businessUser, "/onboarding/business"],
  ] as const)("sends users without completed onboarding back to the existing onboarding flow", async (currentUser, destination) => {
    mocks.currentUser.mockResolvedValue({
      ...currentUser,
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    });

    await expect(ProfilePage()).rejects.toThrow(`REDIRECT:${destination}`);
    expect(mocks.getForEdit).not.toHaveBeenCalled();
    expect(mocks.getBusinessForEdit).not.toHaveBeenCalled();
  });
});
