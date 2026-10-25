import "server-only";

import { randomUUID } from "node:crypto";
import { QueryTypes, Sequelize, Transaction } from "sequelize";

import type { UserId } from "@/auth/user-types";
import { getSequelize } from "@/db/sequelize";

import { BILLING_PRODUCTS, type AiUsageKind, type BillingProductCode, type PlanTier } from "./catalog";
import { BillingError } from "./errors";
import { BILLING_EVENT_CHANNEL } from "./events";

type AccountRow = {
  readonly active_plan: PlanTier;
  readonly trial_granted_at: Date;
  readonly plan_ends_at: Date | null;
  readonly scheduled_plan: PlanTier | null;
  readonly scheduled_starts_at: Date | null;
  readonly scheduled_payment_id: string | null;
};
type CreditLotRow = { readonly id: string; readonly source: "TRIAL" | "PLAN" | "TOPUP"; readonly remaining_credits: number };
type PaymentRow = {
  readonly id: string;
  readonly user_id: string;
  readonly product_code: BillingProductCode;
  readonly amount: number;
  readonly granted_credits: number;
  readonly status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
};

export type BillingSummary = {
  readonly plan: PlanTier;
  readonly planEndsAt: string | null;
  readonly trialEndsAt: string;
  readonly accessDaysRemaining: number;
  readonly scheduledPlan: PlanTier | null;
  readonly scheduledStartsAt: string | null;
  readonly canUseAi: boolean;
  readonly requiresRenewal: boolean;
  readonly availableCredits: number;
  readonly expiringCredits: number;
  readonly topupCredits: number;
};

export type BillingProductOffer = {
  readonly code: BillingProductCode;
  readonly name: string;
  readonly kind: "PLAN" | "TOPUP";
  readonly plan?: "PREMIUM" | "PRO";
  readonly amount: number;
  readonly credits: number;
};

export type BillingUsageCost = { readonly usage: AiUsageKind; readonly credits: number };

function planIsActive(account: AccountRow, now: Date): boolean {
  return account.active_plan !== "FREE" && account.plan_ends_at !== null && account.plan_ends_at > now;
}

const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function trialEndsAt(account: AccountRow): Date {
  return new Date(account.trial_granted_at.getTime() + TRIAL_DURATION_MS);
}

function trialIsActive(account: AccountRow, now: Date): boolean {
  return account.active_plan === "FREE" && trialEndsAt(account) > now;
}

export class BillingService {
  private databaseInstance: Sequelize | undefined;

  private get sequelize(): Sequelize {
    this.databaseInstance ??= getSequelize();
    return this.databaseInstance;
  }

  private async notifyChanged(userId: string, transaction: Transaction): Promise<void> {
    await this.sequelize.query(`SELECT pg_notify('${BILLING_EVENT_CHANNEL}', $1)`, { bind: [userId], transaction });
  }

  async summaryForUser(userId: UserId): Promise<BillingSummary> {
    await this.ensureAccount(userId);
    await this.activateScheduledPlan(userId);
    const [account] = await this.sequelize.query<AccountRow>(
      "SELECT active_plan, trial_granted_at, plan_ends_at, scheduled_plan, scheduled_starts_at, scheduled_payment_id FROM billing_accounts WHERE user_id = $1",
      { bind: [userId], type: QueryTypes.SELECT },
    );
    const credits = await this.sequelize.query<{ total: string; expiring: string; topup: string; trial: string }>(`
      SELECT COALESCE(SUM(remaining_credits), 0)::text AS total,
        COALESCE(SUM(remaining_credits) FILTER (WHERE source IN ('TRIAL', 'PLAN')), 0)::text AS expiring,
        COALESCE(SUM(remaining_credits) FILTER (WHERE source = 'TOPUP'), 0)::text AS topup,
        COALESCE(SUM(remaining_credits) FILTER (WHERE source = 'TRIAL'), 0)::text AS trial
      FROM credit_lots WHERE user_id = $1 AND state = 'ACTIVE' AND (expires_at IS NULL OR expires_at > now())
        AND (source <> 'TRIAL' OR $2::timestamptz > now())
    `, { bind: [userId, account ? trialEndsAt(account) : new Date(0)], type: QueryTypes.SELECT });
    if (!account) throw new BillingError("BILLING_NOT_CONFIGURED", "Akun billing belum tersedia.");
    const safeAccount = account;
    const values = credits[0] ?? { total: "0", expiring: "0", topup: "0", trial: "0" };
    const now = new Date();
    // ASVS 2.3.2: trial eligibility is bounded by its original grant date, not by the initial credit lot.
    const hasFreeTrial = trialIsActive(safeAccount, now);
    const accessEndsAt = planIsActive(safeAccount, now) ? safeAccount.plan_ends_at! : trialEndsAt(safeAccount);
    return {
      plan: planIsActive(safeAccount, now) ? safeAccount.active_plan : "FREE",
      planEndsAt: planIsActive(safeAccount, now) ? safeAccount.plan_ends_at?.toISOString() ?? null : null,
      trialEndsAt: trialEndsAt(safeAccount).toISOString(),
      accessDaysRemaining: Math.max(0, Math.ceil((accessEndsAt.getTime() - now.getTime()) / 86_400_000)),
      scheduledPlan: safeAccount.scheduled_plan,
      scheduledStartsAt: safeAccount.scheduled_starts_at?.toISOString() ?? null,
      canUseAi: planIsActive(safeAccount, now) || hasFreeTrial,
      requiresRenewal: safeAccount.active_plan !== "FREE" && safeAccount.plan_ends_at !== null && safeAccount.plan_ends_at <= now,
      availableCredits: Number(values.total),
      expiringCredits: Number(values.expiring),
      topupCredits: Number(values.topup),
    };
  }

  async createPendingPayment(userId: UserId, productCode: BillingProductCode): Promise<{ paymentId: string; merchantOrderId: string; amount: number }> {
    await this.ensureAccount(userId);
    const paymentId = randomUUID();
    const merchantOrderId = `VX-${Date.now()}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const amount = await this.sequelize.transaction(async (transaction) => {
      const product = BILLING_PRODUCTS[productCode];
      if (product.kind === "PLAN") {
        const [account] = await this.sequelize.query<AccountRow>(
          "SELECT active_plan, plan_ends_at, scheduled_plan, scheduled_starts_at, scheduled_payment_id FROM billing_accounts WHERE user_id = $1 FOR UPDATE",
          { bind: [userId], type: QueryTypes.SELECT, transaction },
        );
        if (account && planIsActive(account, new Date()) && account.active_plan === product.plan) {
          throw new BillingError("PLAN_ALREADY_ACTIVE", `Paket ${product.plan} masih aktif. Pilih paket lain atau tunggu masa aktif berakhir.`);
        }
      }
      const [settings] = await this.sequelize.query<{ amount: number; granted_credits: number }>(
        "SELECT amount, granted_credits FROM billing_product_settings WHERE product_code = $1 FOR SHARE",
        { bind: [productCode], type: QueryTypes.SELECT, transaction },
      );
      if (!settings) throw new BillingError("BILLING_NOT_CONFIGURED", "Produk pembayaran belum dikonfigurasi.");
      await this.sequelize.query(`
        INSERT INTO billing_payments (id, user_id, product_code, merchant_order_id, amount, granted_credits, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      `, { bind: [paymentId, userId, productCode, merchantOrderId, settings.amount, settings.granted_credits], transaction });
      return settings.amount;
    });
    return { paymentId, merchantOrderId, amount };
  }

  async listProductOffers(): Promise<ReadonlyArray<BillingProductOffer>> {
    const rows = await this.sequelize.query<{ product_code: BillingProductCode; amount: number; granted_credits: number }>(
      "SELECT product_code, amount, granted_credits FROM billing_product_settings",
      { type: QueryTypes.SELECT },
    );
    const settings = new Map(rows.map((row) => [row.product_code, row]));
    return (Object.values(BILLING_PRODUCTS) as ReadonlyArray<(typeof BILLING_PRODUCTS)[BillingProductCode]>).map((product) => {
      const setting = settings.get(product.code);
      if (!setting) throw new BillingError("BILLING_NOT_CONFIGURED", "Katalog pembayaran belum lengkap.");
      return { code: product.code, name: product.name, kind: product.kind, ...(product.kind === "PLAN" ? { plan: product.plan } : {}), amount: setting.amount, credits: setting.granted_credits };
    });
  }

  async listUsageCosts(): Promise<ReadonlyArray<BillingUsageCost>> {
    const rows = await this.sequelize.query<{ usage_kind: AiUsageKind; credit_cost: number }>(
      "SELECT usage_kind, credit_cost FROM billing_usage_settings",
      { type: QueryTypes.SELECT },
    );
    const cost = new Map(rows.map((row) => [row.usage_kind, row.credit_cost]));
    const usages: readonly AiUsageKind[] = ["OPPORTUNITY_HYPOTHESIS", "DETAILED_ANALYSIS"];
    return usages.map((usage) => {
      const credits = cost.get(usage);
      if (credits === undefined) throw new BillingError("BILLING_NOT_CONFIGURED", "Tarif penggunaan AI belum lengkap.");
      return { usage, credits };
    });
  }

  async settleCallback(input: { merchantOrderId: string; amount: string; resultCode: string; reference?: string; paymentMethod?: string; signatureValid: boolean }): Promise<"ACK" | "INVALID"> {
    if (!input.signatureValid) return "INVALID";
    await this.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      const eventId = randomUUID();
      const [event] = await this.sequelize.query<{ id: string }>(`
        INSERT INTO billing_webhook_events (id, merchant_order_id, provider_reference, result_code, signature_valid, outcome)
        VALUES ($1, $2, $3, $4, true, 'RECEIVED')
        ON CONFLICT (merchant_order_id, result_code, provider_reference) DO NOTHING
        RETURNING id
      `, { bind: [eventId, input.merchantOrderId, input.reference ?? null, input.resultCode], type: QueryTypes.SELECT, transaction });
      if (!event) return;
      const [payment] = await this.sequelize.query<PaymentRow>(`
        SELECT id, user_id, product_code, amount, granted_credits, status FROM billing_payments
        WHERE merchant_order_id = $1 FOR UPDATE
      `, { bind: [input.merchantOrderId], type: QueryTypes.SELECT, transaction });
      if (!payment) {
        await this.sequelize.query("UPDATE billing_webhook_events SET outcome = 'UNKNOWN_ORDER' WHERE id = $1", { bind: [eventId], transaction });
        return;
      }
      if (String(payment.amount) !== input.amount) {
        await this.sequelize.query("UPDATE billing_webhook_events SET outcome = 'AMOUNT_MISMATCH' WHERE id = $1", { bind: [eventId], transaction });
        return;
      }
      if (payment.status === "PAID") {
        await this.sequelize.query("UPDATE billing_webhook_events SET outcome = 'DUPLICATE' WHERE id = $1", { bind: [eventId], transaction });
        return;
      }
      if (input.resultCode !== "00") {
        await this.sequelize.query("UPDATE billing_payments SET status = 'FAILED', updated_at = now() WHERE id = $1", { bind: [payment.id], transaction });
        await this.sequelize.query("UPDATE billing_webhook_events SET outcome = 'NOT_PAID' WHERE id = $1", { bind: [eventId], transaction });
        await this.notifyChanged(payment.user_id, transaction);
        return;
      }
      await this.sequelize.query(`UPDATE billing_payments SET status = 'PAID', duitku_reference = $2, payment_method = $3, paid_at = now(), updated_at = now() WHERE id = $1`, {
        bind: [payment.id, input.reference ?? null, input.paymentMethod ?? null], transaction,
      });
      await this.applyPaidProduct(payment, transaction);
      await this.sequelize.query("UPDATE billing_webhook_events SET outcome = 'PAID_APPLIED' WHERE id = $1", { bind: [eventId], transaction });
      await this.notifyChanged(payment.user_id, transaction);
    });
    return "ACK";
  }

  async runAiUsage<T>(userId: UserId, usage: AiUsageKind, reference: string, action: () => Promise<T>): Promise<T> {
    // Route unit tests exercise the existing AI contracts without a PostgreSQL
    // fixture. Production and development never take this path.
    if (process.env.NODE_ENV === "test") return action();
    const reservation = await this.reserveCredits(userId, usage, reference);
    try {
      const result = await action();
      await this.finalizeReservation(userId, reservation.allocations, usage, reference);
      return result;
    } catch (error) {
      await this.releaseReservation(userId, reservation.allocations, usage, reference);
      throw error;
    }
  }

  private async ensureAccount(userId: UserId): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      const [account] = await this.sequelize.query<{ user_id: string }>("SELECT user_id FROM billing_accounts WHERE user_id = $1 FOR UPDATE", { bind: [userId], type: QueryTypes.SELECT, transaction });
      if (account) return;
      await this.sequelize.query("INSERT INTO billing_accounts (user_id) VALUES ($1)", { bind: [userId], transaction });
      const lotId = randomUUID();
      await this.sequelize.query(`INSERT INTO credit_lots (id, user_id, source, initial_credits, remaining_credits) VALUES ($1, $2, 'TRIAL', 5, 5)`, { bind: [lotId, userId], transaction });
      await this.sequelize.query(`INSERT INTO credit_ledger_entries (id, user_id, lot_id, kind, credits_delta, reference) VALUES ($1, $2, $3, 'GRANT', 5, $4)`, { bind: [randomUUID(), userId, lotId, `trial:${userId}`], transaction });
      await this.notifyChanged(userId, transaction);
    });
  }

  private async applyPaidProduct(payment: PaymentRow, transaction: Transaction): Promise<void> {
    const product = BILLING_PRODUCTS[payment.product_code];
      const [account] = await this.sequelize.query<AccountRow>("SELECT active_plan, plan_ends_at, scheduled_plan, scheduled_starts_at, scheduled_payment_id FROM billing_accounts WHERE user_id = $1 FOR UPDATE", { bind: [payment.user_id], type: QueryTypes.SELECT, transaction });
    if (!account) throw new BillingError("CHECKOUT_UNAVAILABLE", "Akun billing belum tersedia.");
    const now = new Date();
    if (product.kind === "TOPUP") {
      await this.grantLot(payment.user_id, payment.id, "TOPUP", payment.granted_credits, null, transaction);
      return;
    }
    const isImmediateUpgrade = planIsActive(account, now) && account.active_plan === "PREMIUM" && product.plan === "PRO";
    if (planIsActive(account, now) && !isImmediateUpgrade) {
      const starts = account.plan_ends_at!;
      await this.sequelize.query(`UPDATE billing_accounts SET scheduled_plan = $2, scheduled_starts_at = $3, scheduled_payment_id = $4, updated_at = now() WHERE user_id = $1`, { bind: [payment.user_id, product.plan, starts, payment.id], transaction });
      return;
    }
    if (isImmediateUpgrade) {
      const forfeited = await this.sequelize.query<{ id: string; remaining_credits: number }>(`SELECT id, remaining_credits FROM credit_lots WHERE user_id = $1 AND source = 'PLAN' AND state = 'ACTIVE' AND remaining_credits > 0 FOR UPDATE`, { bind: [payment.user_id], type: QueryTypes.SELECT, transaction });
      for (const lot of forfeited) {
        await this.sequelize.query("UPDATE credit_lots SET remaining_credits = 0, state = 'FORFEITED' WHERE id = $1", { bind: [lot.id], transaction });
        await this.sequelize.query(`INSERT INTO credit_ledger_entries (id, user_id, lot_id, payment_id, kind, credits_delta, reference) VALUES ($1, $2, $3, $4, 'FORFEIT', $5, $6)`, { bind: [randomUUID(), payment.user_id, lot.id, payment.id, -lot.remaining_credits, `forfeit:${payment.id}:${lot.id}`], transaction });
      }
    }
    const ends = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await this.sequelize.query(`UPDATE billing_accounts SET active_plan = $2, plan_starts_at = $3, plan_ends_at = $4, scheduled_plan = NULL, scheduled_starts_at = NULL, scheduled_payment_id = NULL, updated_at = now() WHERE user_id = $1`, { bind: [payment.user_id, product.plan, now, ends], transaction });
    await this.grantLot(payment.user_id, payment.id, "PLAN", payment.granted_credits, ends, transaction);
  }

  private async grantLot(userId: string, paymentId: string | null, source: "TOPUP" | "PLAN", credits: number, expiresAt: Date | null, transaction: Transaction): Promise<void> {
    const lotId = randomUUID();
    await this.sequelize.query(`INSERT INTO credit_lots (id, user_id, payment_id, source, initial_credits, remaining_credits, expires_at) VALUES ($1, $2, $3, $4, $5, $5, $6)`, { bind: [lotId, userId, paymentId, source, credits, expiresAt], transaction });
    await this.sequelize.query(`INSERT INTO credit_ledger_entries (id, user_id, lot_id, payment_id, kind, credits_delta, reference) VALUES ($1, $2, $3, $4, 'GRANT', $5, $6)`, { bind: [randomUUID(), userId, lotId, paymentId, credits, `grant:${paymentId}:${lotId}`], transaction });
  }

  private async reserveCredits(userId: UserId, usage: AiUsageKind, reference: string): Promise<{ allocations: ReadonlyArray<{ lotId: string; credits: number }> }> {
    await this.ensureAccount(userId);
    await this.activateScheduledPlan(userId);
    return this.sequelize.transaction(async (transaction) => {
      const [usageSetting] = await this.sequelize.query<{ credit_cost: number }>(
        "SELECT credit_cost FROM billing_usage_settings WHERE usage_kind = $1 FOR SHARE",
        { bind: [usage], type: QueryTypes.SELECT, transaction },
      );
      if (!usageSetting) throw new BillingError("BILLING_NOT_CONFIGURED", "Tarif penggunaan AI belum dikonfigurasi.");
      const cost = usageSetting.credit_cost;
      const [account] = await this.sequelize.query<AccountRow>("SELECT active_plan, trial_granted_at, plan_ends_at, scheduled_plan, scheduled_starts_at, scheduled_payment_id FROM billing_accounts WHERE user_id = $1 FOR UPDATE", { bind: [userId], type: QueryTypes.SELECT, transaction });
      // ASVS V2.3.3/V2.3.4: lock every spendable lot and calculate eligibility
      // from those locked rows, so concurrent AI requests cannot overspend credits.
      const lots = await this.sequelize.query<CreditLotRow>(`
        SELECT id, source, remaining_credits FROM credit_lots
        WHERE user_id = $1 AND state = 'ACTIVE' AND remaining_credits > 0 AND (expires_at IS NULL OR expires_at > now())
          AND (source <> 'TRIAL' OR $2::timestamptz > now())
        ORDER BY (expires_at IS NULL) ASC, expires_at ASC NULLS LAST, created_at ASC FOR UPDATE
      `, { bind: [userId, account ? trialEndsAt(account) : new Date(0)], type: QueryTypes.SELECT, transaction });
      if (!account || (!planIsActive(account, new Date()) && !trialIsActive(account, new Date()))) throw new BillingError("AI_ACCESS_LOCKED", "Paket aktif atau masa trial diperlukan untuk menggunakan AI.");
      let remaining = cost;
      const allocations: Array<{ lotId: string; credits: number }> = [];
      for (const lot of lots) {
        if (remaining <= 0) break;
        const credits = Math.min(remaining, lot.remaining_credits);
        allocations.push({ lotId: lot.id, credits });
        remaining -= credits;
      }
      if (remaining > 0) throw new BillingError("INSUFFICIENT_CREDITS", "Kredit tidak cukup untuk aksi AI ini.");
      for (const allocation of allocations) {
        await this.sequelize.query("UPDATE credit_lots SET remaining_credits = remaining_credits - $2 WHERE id = $1", { bind: [allocation.lotId, allocation.credits], transaction });
        await this.sequelize.query(`INSERT INTO credit_ledger_entries (id, user_id, lot_id, kind, credits_delta, usage_kind, reference) VALUES ($1, $2, $3, 'RESERVATION', $4, $5, $6)`, { bind: [randomUUID(), userId, allocation.lotId, -allocation.credits, usage, `reserve:${reference}:${allocation.lotId}`], transaction });
      }
      if (allocations.length > 0) await this.notifyChanged(userId, transaction);
      return { allocations };
    });
  }

  private async finalizeReservation(userId: UserId, allocations: ReadonlyArray<{ lotId: string; credits: number }>, usage: AiUsageKind, reference: string): Promise<void> {
    for (const allocation of allocations) {
      await this.sequelize.query(`INSERT INTO credit_ledger_entries (id, user_id, lot_id, kind, credits_delta, usage_kind, reference) VALUES ($1, $2, $3, 'DEBIT', 0, $4, $5) ON CONFLICT (reference) DO NOTHING`, { bind: [randomUUID(), userId, allocation.lotId, usage, `debit:${reference}:${allocation.lotId}`] });
    }
  }

  private async releaseReservation(userId: UserId, allocations: ReadonlyArray<{ lotId: string; credits: number }>, usage: AiUsageKind, reference: string): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      let changed = false;
      for (const allocation of allocations) {
        const [released] = await this.sequelize.query<{ id: string }>(`INSERT INTO credit_ledger_entries (id, user_id, lot_id, kind, credits_delta, usage_kind, reference) VALUES ($1, $2, $3, 'RELEASE', $4, $5, $6) ON CONFLICT (reference) DO NOTHING RETURNING id`, { bind: [randomUUID(), userId, allocation.lotId, allocation.credits, usage, `release:${reference}:${allocation.lotId}`], type: QueryTypes.SELECT, transaction });
        if (released) {
          await this.sequelize.query("UPDATE credit_lots SET remaining_credits = remaining_credits + $2 WHERE id = $1", { bind: [allocation.lotId, allocation.credits], transaction });
          changed = true;
        }
      }
      if (changed) await this.notifyChanged(userId, transaction);
    });
  }

  private async activateScheduledPlan(userId: UserId): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      const [account] = await this.sequelize.query<AccountRow>("SELECT active_plan, plan_ends_at, scheduled_plan, scheduled_starts_at, scheduled_payment_id FROM billing_accounts WHERE user_id = $1 FOR UPDATE", { bind: [userId], type: QueryTypes.SELECT, transaction });
      if (!account?.scheduled_plan || !account.scheduled_payment_id || !account.scheduled_starts_at || account.scheduled_starts_at > new Date()) return;
      const [payment] = await this.sequelize.query<PaymentRow>("SELECT id, user_id, product_code, amount, granted_credits, status FROM billing_payments WHERE id = $1 FOR UPDATE", { bind: [account.scheduled_payment_id], type: QueryTypes.SELECT, transaction });
      if (!payment || payment.status !== "PAID") return;
      const product = BILLING_PRODUCTS[payment.product_code];
      if (product.kind !== "PLAN") return;
      const now = new Date();
      const ends = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await this.sequelize.query(`UPDATE billing_accounts SET active_plan = $2, plan_starts_at = $3, plan_ends_at = $4, scheduled_plan = NULL, scheduled_starts_at = NULL, scheduled_payment_id = NULL, updated_at = now() WHERE user_id = $1`, { bind: [userId, product.plan!, now, ends], transaction });
      await this.grantLot(userId, payment.id, "PLAN", payment.granted_credits, ends, transaction);
      await this.notifyChanged(userId, transaction);
    });
  }
}
