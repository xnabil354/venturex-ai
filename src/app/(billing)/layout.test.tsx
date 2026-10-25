import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  currentAdmin: vi.fn(),
  summaryForUser: vi.fn(),
  redirect: vi.fn((destination: string): never => { throw new Error(`REDIRECT:${destination}`); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/auth/current-admin", () => ({ getCurrentAdmin: mocks.currentAdmin }));
vi.mock("@/billing/service", () => ({ BillingService: class { summaryForUser(...args: unknown[]) { return mocks.summaryForUser(...args); } } }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: import("react").ReactNode }) => children }));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema } from "@/auth/user-types";
import BillingLayout from "./layout";

describe("billing layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentAdmin.mockResolvedValue(null);
    mocks.currentUser.mockResolvedValue({
      id: userIdSchema.parse("70000000-0000-4000-8000-000000000003"),
      email: "founder@example.com",
      userType: USER_TYPES.ENTREPRENEUR,
      onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
    });
    mocks.summaryForUser.mockResolvedValue({ availableCredits: 10, requiresRenewal: true });
  });

  it("keeps billing accessible after a paid plan expires", async () => {
    await expect(BillingLayout({ children: "billing" })).resolves.toBeDefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("still requires authentication", async () => {
    mocks.currentUser.mockResolvedValue(null);
    await expect(BillingLayout({ children: "billing" })).rejects.toThrow("REDIRECT:/login");
  });
});
