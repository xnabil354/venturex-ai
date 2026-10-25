import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  currentAdmin: vi.fn(),
  summaryForUser: vi.fn(),
  redirect: vi.fn((destination: string): never => {
    throw new Error(`REDIRECT:${destination}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/auth/current-admin", () => ({ getCurrentAdmin: mocks.currentAdmin }));
vi.mock("@/billing/service", () => ({
  BillingService: class {
    summaryForUser(...args: unknown[]) { return mocks.summaryForUser(...args); }
  },
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: import("react").ReactNode }) => children,
}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "@/auth/user-types";
import { redirect } from "next/navigation";
import AppLayout from "./layout";

function makeUser(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: userIdSchema.parse("70000000-0000-4000-8000-000000000003"),
    email: "founder@example.com",
    userType: USER_TYPES.ENTREPRENEUR,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
    ...overrides,
  };
}

describe("authenticated app layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.summaryForUser.mockResolvedValue({ availableCredits: 5, requiresRenewal: false });
    mocks.currentAdmin.mockResolvedValue(null);
    mocks.redirect.mockImplementation((destination: string): never => {
      throw new Error(`REDIRECT:${destination}`);
    });
  });

  it("redirects guests to login before rendering a protected route", async () => {
    mocks.currentUser.mockResolvedValue(null);

    await expect(AppLayout({ children: "protected" })).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects an authenticated admin to the operator dashboard", async () => {
    mocks.currentUser.mockResolvedValue(null);
    mocks.currentAdmin.mockResolvedValue({ id: "admin-id", email: "operator@example.com" });

    await expect(AppLayout({ children: "protected" })).rejects.toThrow("REDIRECT:/admin/dashboard");
    expect(redirect).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("redirects users with incomplete onboarding", async () => {
    mocks.currentUser.mockResolvedValue(makeUser({
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
    }));

    await expect(AppLayout({ children: "protected" }))
      .rejects.toThrow("REDIRECT:/onboarding/entrepreneur");
    expect(redirect).toHaveBeenCalledWith("/onboarding/entrepreneur");
  });

  it("renders protected content after completed onboarding", async () => {
    mocks.currentUser.mockResolvedValue(makeUser());

    await expect(AppLayout({ children: "protected" })).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects a user with an expired paid plan to billing", async () => {
    mocks.currentUser.mockResolvedValue(makeUser());
    mocks.summaryForUser.mockResolvedValue({ availableCredits: 10, requiresRenewal: true });

    await expect(AppLayout({ children: "protected" })).rejects.toThrow("REDIRECT:/billing");
    expect(redirect).toHaveBeenCalledWith("/billing");
  });

  it("keeps the app available when the header credit summary is unavailable", async () => {
    mocks.currentUser.mockResolvedValue(makeUser());
    mocks.summaryForUser.mockRejectedValue(new Error("billing unavailable"));

    await expect(AppLayout({ children: "protected" })).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
