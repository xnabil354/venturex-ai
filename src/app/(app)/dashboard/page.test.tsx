import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), profile: vi.fn(), exploration: vi.fn(), page: vi.fn((_props: Record<string, unknown>) => null) }));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/dashboard/service", () => ({ DashboardQueryService: class { get() { return mocks.profile(); } } }));
vi.mock("@/dashboard/exploration", () => ({ loadDashboardExploration: mocks.exploration }));
vi.mock("@/components/dashboard/dashboard-page", () => ({ DashboardPage: mocks.page }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import DashboardRoutePage from "./page";

describe("Dashboard route exploration composition", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["ENTREPRENEUR", "UMKM_EXISTING"] as const)("uses the signed-in %s owner and its current profile product", async userType => {
    const user = { id: "owner-a", userType, onboardingStatus: "COMPLETED" };
    const dashboard = { userType, profile: { preferredProductType: "Soto", businessName: "Kopi" }, modules: {} };
    const modules = { trends: { status: "EMPTY", preview: [] } };
    mocks.user.mockResolvedValue(user);
    mocks.profile.mockResolvedValue(dashboard);
    mocks.exploration.mockResolvedValue(modules);
    renderToStaticMarkup(await DashboardRoutePage({ searchParams: Promise.resolve({}) }));
    expect(mocks.exploration).toHaveBeenCalledWith(user, userType === "ENTREPRENEUR" ? "Soto" : "Kopi");
    expect(mocks.page.mock.calls[0]?.[0]).toMatchObject({ viewerId: "owner-a", dashboard: { ...dashboard, modules } });
  });
  it("redirects unauthenticated visitors before reading any private previews", async () => {
    mocks.user.mockResolvedValue(null);
    await expect(DashboardRoutePage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/login");
    expect(mocks.exploration).not.toHaveBeenCalled();
    expect(mocks.profile).not.toHaveBeenCalled();
  });
});
