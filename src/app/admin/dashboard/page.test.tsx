import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  summary: vi.fn(),
  redirect: vi.fn((destination: string): never => { throw new Error(`REDIRECT:${destination}`); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/auth/current-admin", () => ({ getCurrentAdmin: mocks.admin }));
vi.mock("@/billing/admin", () => ({ getAdminDashboardSummary: mocks.summary }));

import AdminDashboardPage from "./page";

describe("admin dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.admin.mockResolvedValue({ id: "admin-id", email: "operator@example.com" });
    mocks.summary.mockResolvedValue({
      windowStart: new Date("2026-09-24T00:00:00.000Z"),
      windowEnd: new Date("2026-10-24T00:00:00.000Z"),
      transactionCounts: { PENDING: 1, PAID: 2, FAILED: 0, EXPIRED: 0 },
      paidAmount: 168000,
      activeUsers: 10,
      activeTrialUsers: 4,
      activePremiumUsers: 3,
      activeProUsers: 2,
      recentTransactions: [],
    });
  });

  it("renders real payment and entitlement figures for an admin", async () => {
    const markup = renderToStaticMarkup(await AdminDashboardPage());

    expect(markup).toContain("Rp 168.000");
    expect(markup).toContain("10");
    expect(markup).toContain("Trial aktif");
    expect(markup).toContain("Premium aktif");
    expect(markup).toContain("Pro aktif");
    expect(markup).toContain("Belum ada transaksi yang dibuat.");
  });

  it("does not load operational data for a non-admin", async () => {
    mocks.admin.mockResolvedValue(null);

    await expect(AdminDashboardPage()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.summary).not.toHaveBeenCalled();
  });

  it("shows a controlled fallback if summary loading fails", async () => {
    mocks.summary.mockRejectedValue(new Error("database unavailable"));

    const markup = renderToStaticMarkup(await AdminDashboardPage());
    expect(markup).toContain("Ringkasan belum dapat dimuat.");
    expect(markup).toContain("Buka transaksi");
  });
});
