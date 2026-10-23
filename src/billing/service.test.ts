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
  });
});
