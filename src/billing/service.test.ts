import { describe, expect, it, vi } from "vitest";

import { userIdSchema } from "@/auth/user-types";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/sequelize", () => ({
  getSequelize: () => ({
    query: mocks.query,
    transaction: mocks.transaction,
  }),
}));

import { BillingService } from "./service";

describe("BillingService credit reservation", () => {
  it.each([
    ["PREMIUM", "PREMIUM_30"],
    ["PRO", "PRO_30"],
  ] as const)("rejects a second %s checkout while the plan is active", async (activePlan, productCode) => {
    const transaction = { id: "checkout-transaction" };
    mocks.transaction.mockImplementation(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction));
    mocks.query.mockImplementation(async (statement: string) => {
      if (statement.includes("SELECT user_id FROM billing_accounts")) return [{ user_id: "70000000-0000-4000-8000-000000000001" }];
      if (statement.includes("SELECT active_plan")) return [{ active_plan: activePlan, plan_ends_at: new Date("2999-01-01T00:00:00Z"), scheduled_plan: null, scheduled_starts_at: null, scheduled_payment_id: null }];
      return [];
    });

    await expect(new BillingService().createPendingPayment(userIdSchema.parse("70000000-0000-4000-8000-000000000001"), productCode))
      .rejects.toMatchObject({ code: "PLAN_ALREADY_ACTIVE" });
    expect(mocks.query.mock.calls.some(([statement]) => String(statement).includes("INSERT INTO billing_payments"))).toBe(false);
  });

  it("allows the same plan after its previous period has expired", async () => {
    const transaction = { id: "checkout-transaction" };
    mocks.transaction.mockImplementation(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction));
    mocks.query.mockImplementation(async (statement: string) => {
      if (statement.includes("SELECT user_id FROM billing_accounts")) return [{ user_id: "70000000-0000-4000-8000-000000000001" }];
      if (statement.includes("SELECT active_plan")) return [{ active_plan: "PREMIUM", plan_ends_at: new Date("2020-01-01T00:00:00Z"), scheduled_plan: null, scheduled_starts_at: null, scheduled_payment_id: null }];
      if (statement.includes("SELECT amount, granted_credits")) return [{ amount: 84_000, granted_credits: 25 }];
      return [];
    });

    await expect(new BillingService().createPendingPayment(userIdSchema.parse("70000000-0000-4000-8000-000000000001"), "PREMIUM_30"))
      .resolves.toMatchObject({ amount: 84_000 });
    expect(mocks.query.mock.calls.some(([statement]) => String(statement).includes("INSERT INTO billing_payments"))).toBe(true);
  });

  it.each([
    { plan: "PREMIUM", endsAt: new Date("2020-01-01T00:00:00Z"), expected: true },
    { plan: "PRO", endsAt: new Date("2999-01-01T00:00:00Z"), expected: false },
    { plan: "FREE", endsAt: null, expected: false },
  ] as const)("marks renewal required only for an expired paid $plan plan", async ({ plan, endsAt, expected }) => {
    mocks.query.mockImplementation(async (statement: string) => {
      if (statement.includes("SELECT user_id FROM billing_accounts")) return [{ user_id: "70000000-0000-4000-8000-000000000001" }];
      if (statement.includes("SELECT active_plan")) return [{ active_plan: plan, plan_ends_at: endsAt, scheduled_plan: null, scheduled_starts_at: null, scheduled_payment_id: null }];
      if (statement.includes("COALESCE(SUM(remaining_credits)")) return [{ total: "10", expiring: "0", topup: "10", trial: "0" }];
      return [];
    });
    const summary = await new BillingService().summaryForUser(userIdSchema.parse("70000000-0000-4000-8000-000000000001"));
    expect(summary.requiresRenewal).toBe(expected);
  });

  it("locks spendable credit lots before calculating trial access", async () => {
    const transaction = { id: "transaction" };
    mocks.transaction.mockImplementation(async (callback: (value: typeof transaction) => Promise<unknown>) => callback(transaction));
    mocks.query.mockImplementation(async (statement: string) => {
      if (statement.includes("SELECT user_id FROM billing_accounts")) return [{ user_id: "70000000-0000-4000-8000-000000000001" }];
      if (statement.includes("SELECT credit_cost")) return [{ credit_cost: 2 }];
      if (statement.includes("SELECT active_plan")) return [{ active_plan: "FREE", plan_ends_at: null, scheduled_plan: null, scheduled_starts_at: null, scheduled_payment_id: null }];
      if (statement.includes("SUM(remaining_credits)")) return [{ remaining: "5" }];
      if (statement.includes("SELECT id,")) return [{ id: "lot-1", source: "TRIAL", remaining_credits: 5 }];
      return undefined;
    });

    const service = new BillingService();
    const reserveCredits = Reflect.get(service, "reserveCredits");
    if (typeof reserveCredits !== "function") throw new Error("reserveCredits is unavailable");

    await Reflect.apply(reserveCredits, service, [
      userIdSchema.parse("70000000-0000-4000-8000-000000000001"),
      "OPPORTUNITY_HYPOTHESIS",
      "request-1",
    ]);

    const queries = mocks.query.mock.calls.map(([statement]) => String(statement));
    expect(queries.some((statement) => /SUM\(remaining_credits\)[\s\S]*FOR UPDATE/u.test(statement))).toBe(false);
    expect(queries).toContainEqual(expect.stringContaining("SELECT id, source, remaining_credits FROM credit_lots"));
    expect(queries).toContainEqual(expect.stringContaining("FOR UPDATE"));
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("pg_notify('venturex_billing_changed'"), expect.objectContaining({ bind: ["70000000-0000-4000-8000-000000000001"], transaction }));
  });
});
