import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db/sequelize", () => ({
  getSequelize: () => ({ query: mocks.query }),
}));

import { getAdminDashboardSummary } from "./admin";

describe("getAdminDashboardSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns bounded payment, active-account, and entitlement counts", async () => {
    mocks.query
      .mockResolvedValueOnce([
        { status: "PAID", count: "3", paid_amount: "252000" },
        { status: "PENDING", count: "1", paid_amount: "0" },
      ])
      .mockResolvedValueOnce([{
        active_users: "12",
        active_trial_users: "4",
        active_premium_users: "3",
        active_pro_users: "2",
      }])
      .mockResolvedValueOnce([{
        merchant_order_id: "VX-1",
        email: "member@example.test",
        product_code: "PREMIUM_30",
        amount: 84000,
        granted_credits: 25,
        status: "PAID",
        payment_method: "VC",
        duitku_reference: "reference-1",
        created_at: new Date("2026-10-20T00:00:00.000Z"),
        paid_at: new Date("2026-10-20T00:01:00.000Z"),
      }]);

    const now = new Date("2026-10-24T12:00:00.000Z");
    const result = await getAdminDashboardSummary(now);

    expect(result.windowStart).toEqual(new Date("2026-09-24T12:00:00.000Z"));
    expect(result.transactionCounts).toEqual({ PENDING: 1, PAID: 3, FAILED: 0, EXPIRED: 0 });
    expect(result.paidAmount).toBe(252000);
    expect(result).toMatchObject({
      activeUsers: 12,
      activeTrialUsers: 4,
      activePremiumUsers: 3,
      activeProUsers: 2,
      recentTransactions: [{ merchantOrderId: "VX-1", status: "PAID" }],
    });
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[1]?.[0]).toContain("u.login_disabled_at IS NULL");
    expect(mocks.query.mock.calls[1]?.[0]).toContain("ba.trial_granted_at + interval '30 days' > $1");
    expect(mocks.query.mock.calls[1]?.[0]).toContain("ba.plan_ends_at > $1");
  });
});
