import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  currentAdmin: vi.fn(),
  redirect: vi.fn((destination: string): never => { throw new Error(`REDIRECT:${destination}`); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/auth/current-admin", () => ({ getCurrentAdmin: mocks.currentAdmin }));
vi.mock("@/components/auth/auth-layout", () => ({ AuthLayout: ({ children }: { children: import("react").ReactNode }) => children }));

import AuthenticationLayout from "./layout";

describe("authentication layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue(null);
    mocks.currentAdmin.mockResolvedValue(null);
  });

  it("redirects a current admin away from the login route", async () => {
    mocks.currentAdmin.mockResolvedValue({ id: "admin-id", email: "operator@example.com" });

    await expect(AuthenticationLayout({ children: "login" })).rejects.toThrow("REDIRECT:/admin/dashboard");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/dashboard");
  });
});
