import "server-only";

import { randomUUID } from "node:crypto";
import { QueryTypes, Transaction } from "sequelize";

import type { AdminId } from "@/auth/admin-types";
import { getSequelize } from "@/db/sequelize";

import { BILLING_PRODUCTS, type AiUsageKind, type BillingProductCode } from "./catalog";

export type BillingPaymentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export type AdminProductSetting = {
  readonly productCode: BillingProductCode;
  readonly name: string;
  readonly kind: "PLAN" | "TOPUP";
  readonly plan: "PREMIUM" | "PRO" | null;
  readonly amount: number;
  readonly credits: number;
  readonly version: number;
  readonly updatedAt: Date;
};

export type AdminUsageSetting = {
  readonly usageKind: AiUsageKind;
  readonly creditCost: number;
  readonly version: number;
  readonly updatedAt: Date;
};

export type AdminTransaction = {
  readonly merchantOrderId: string;
  readonly email: string;
  readonly productCode: BillingProductCode;
  readonly amount: number;
  readonly grantedCredits: number;
  readonly status: BillingPaymentStatus;
  readonly paymentMethod: string | null;
  readonly duitkuReference: string | null;
  readonly createdAt: Date;
  readonly paidAt: Date | null;
};

export type AdminDashboardSummary = {
  readonly windowStart: Date;
  readonly windowEnd: Date;
  readonly transactionCounts: Readonly<Record<BillingPaymentStatus, number>>;
  readonly paidAmount: number;
  readonly activeUsers: number;
  readonly activeTrialUsers: number;
  readonly activePremiumUsers: number;
  readonly activeProUsers: number;
  readonly recentTransactions: ReadonlyArray<AdminTransaction>;
};

export class BillingAdminError extends Error {
  override readonly name = "BillingAdminError";
  constructor(readonly code: "NOT_FOUND" | "VERSION_CONFLICT", message: string) {
    super(message);
  }
}

function productMetadata(code: BillingProductCode) {
  return BILLING_PRODUCTS[code];
}

/**
 * Admin-only operational read model. The enclosing /admin layout verifies the
 * authenticated ADMIN session before this function can be rendered.
 * ASVS 1.2.4: every runtime value is passed through a bound SQL parameter.
 */
export async function getAdminDashboardSummary(now: Date = new Date()): Promise<AdminDashboardSummary> {
  const windowEnd = new Date(now);
  const windowStart = new Date(windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const database = getSequelize();
  const [transactionRows, accountRows, recentRows] = await Promise.all([
    database.query<{ status: BillingPaymentStatus; count: string; paid_amount: string }>(
      `SELECT status, COUNT(*)::text AS count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::text AS paid_amount
       FROM billing_payments
       WHERE created_at >= $1 AND created_at < $2
       GROUP BY status`,
      { bind: [windowStart, windowEnd], type: QueryTypes.SELECT },
    ),
    database.query<{
      active_users: string;
      active_trial_users: string;
      active_premium_users: string;
      active_pro_users: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE u.login_disabled_at IS NULL)::text AS active_users,
        COUNT(*) FILTER (
          WHERE u.login_disabled_at IS NULL
            AND ba.active_plan = 'FREE'
            AND EXISTS (
              SELECT 1 FROM credit_lots cl
              WHERE cl.user_id = u.id
                AND cl.source = 'TRIAL'
                AND cl.state = 'ACTIVE'
                AND cl.remaining_credits > 0
                AND (cl.expires_at IS NULL OR cl.expires_at > $1)
            )
        )::text AS active_trial_users,
        COUNT(*) FILTER (
          WHERE u.login_disabled_at IS NULL
            AND ba.active_plan = 'PREMIUM'
            AND ba.plan_ends_at > $1
        )::text AS active_premium_users,
        COUNT(*) FILTER (
          WHERE u.login_disabled_at IS NULL
            AND ba.active_plan = 'PRO'
            AND ba.plan_ends_at > $1
        )::text AS active_pro_users
       FROM users u
       LEFT JOIN billing_accounts ba ON ba.user_id = u.id`,
      { bind: [windowEnd], type: QueryTypes.SELECT },
    ),
    database.query<{
      merchant_order_id: string;
      email: string;
      product_code: BillingProductCode;
      amount: number;
      granted_credits: number;
      status: BillingPaymentStatus;
      payment_method: string | null;
      duitku_reference: string | null;
      created_at: Date;
      paid_at: Date | null;
    }>(
      `SELECT p.merchant_order_id, u.email, p.product_code, p.amount, p.granted_credits,
        p.status, p.payment_method, p.duitku_reference, p.created_at, p.paid_at
       FROM billing_payments p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 5`,
      { type: QueryTypes.SELECT },
    ),
  ]);

  const transactionCounts: Record<BillingPaymentStatus, number> = {
    PENDING: 0,
    PAID: 0,
    FAILED: 0,
    EXPIRED: 0,
  };
  let paidAmount = 0;
  for (const row of transactionRows) {
    transactionCounts[row.status] = Number(row.count);
    paidAmount += Number(row.paid_amount);
  }

  const accounts = accountRows[0];
  return {
    windowStart,
    windowEnd,
    transactionCounts,
    paidAmount,
    activeUsers: Number(accounts?.active_users ?? 0),
    activeTrialUsers: Number(accounts?.active_trial_users ?? 0),
    activePremiumUsers: Number(accounts?.active_premium_users ?? 0),
    activeProUsers: Number(accounts?.active_pro_users ?? 0),
    recentTransactions: recentRows.map((row) => ({
      merchantOrderId: row.merchant_order_id,
      email: row.email,
      productCode: row.product_code,
      amount: row.amount,
      grantedCredits: row.granted_credits,
      status: row.status,
      paymentMethod: row.payment_method,
      duitkuReference: row.duitku_reference,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    })),
  };
}

export async function getBillingSettings(): Promise<{ readonly products: ReadonlyArray<AdminProductSetting>; readonly usage: ReadonlyArray<AdminUsageSetting> }> {
  const database = getSequelize();
  const [productRows, usageRows] = await Promise.all([
    database.query<{ product_code: BillingProductCode; amount: number; granted_credits: number; version: number; updated_at: Date }>(
      "SELECT product_code, amount, granted_credits, version, updated_at FROM billing_product_settings ORDER BY product_code",
      { type: QueryTypes.SELECT },
    ),
    database.query<{ usage_kind: AiUsageKind; credit_cost: number; version: number; updated_at: Date }>(
      "SELECT usage_kind, credit_cost, version, updated_at FROM billing_usage_settings ORDER BY usage_kind",
      { type: QueryTypes.SELECT },
    ),
  ]);
  return {
    products: productRows.map((row) => {
      const metadata = productMetadata(row.product_code);
      return { productCode: row.product_code, name: metadata.name, kind: metadata.kind, plan: metadata.kind === "PLAN" ? metadata.plan : null, amount: row.amount, credits: row.granted_credits, version: row.version, updatedAt: row.updated_at };
    }),
    usage: usageRows.map((row) => ({ usageKind: row.usage_kind, creditCost: row.credit_cost, version: row.version, updatedAt: row.updated_at })),
  };
}

export async function updateProductSetting(input: { readonly adminId: AdminId; readonly productCode: BillingProductCode; readonly amount: number; readonly credits: number; readonly expectedVersion: number }): Promise<AdminProductSetting> {
  return getSequelize().transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
    const [current] = await getSequelize().query<{ amount: number; granted_credits: number; version: number; updated_at: Date }>(
      "SELECT amount, granted_credits, version, updated_at FROM billing_product_settings WHERE product_code = $1 FOR UPDATE",
      { bind: [input.productCode], type: QueryTypes.SELECT, transaction },
    );
    if (!current) throw new BillingAdminError("NOT_FOUND", "Produk tidak ditemukan.");
    if (current.version !== input.expectedVersion) throw new BillingAdminError("VERSION_CONFLICT", "Konfigurasi telah diubah oleh sesi lain. Muat ulang lalu coba lagi.");
    const [updated] = await getSequelize().query<{ amount: number; granted_credits: number; version: number; updated_at: Date }>(
      `UPDATE billing_product_settings
       SET amount = $2, granted_credits = $3, version = version + 1, updated_by_admin_id = $4, updated_at = now()
       WHERE product_code = $1
       RETURNING amount, granted_credits, version, updated_at`,
      { bind: [input.productCode, input.amount, input.credits, input.adminId], type: QueryTypes.SELECT, transaction },
    );
    if (!updated) throw new BillingAdminError("NOT_FOUND", "Produk tidak ditemukan.");
    await getSequelize().query(
      `INSERT INTO billing_admin_audit_logs (id, admin_id, action, target_code, previous_value, next_value)
       VALUES ($1, $2, 'PRODUCT_SETTINGS_UPDATED', $3, $4::jsonb, $5::jsonb)`,
      { bind: [randomUUID(), input.adminId, input.productCode, JSON.stringify({ amount: current.amount, credits: current.granted_credits, version: current.version }), JSON.stringify({ amount: updated.amount, credits: updated.granted_credits, version: updated.version })], transaction },
    );
    const metadata = productMetadata(input.productCode);
    return { productCode: input.productCode, name: metadata.name, kind: metadata.kind, plan: metadata.kind === "PLAN" ? metadata.plan : null, amount: updated.amount, credits: updated.granted_credits, version: updated.version, updatedAt: updated.updated_at };
  });
}

export async function updateUsageSetting(input: { readonly adminId: AdminId; readonly usageKind: AiUsageKind; readonly creditCost: number; readonly expectedVersion: number }): Promise<AdminUsageSetting> {
  return getSequelize().transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
    const [current] = await getSequelize().query<{ credit_cost: number; version: number }>(
      "SELECT credit_cost, version FROM billing_usage_settings WHERE usage_kind = $1 FOR UPDATE",
      { bind: [input.usageKind], type: QueryTypes.SELECT, transaction },
    );
    if (!current) throw new BillingAdminError("NOT_FOUND", "Aksi AI tidak ditemukan.");
    if (current.version !== input.expectedVersion) throw new BillingAdminError("VERSION_CONFLICT", "Konfigurasi telah diubah oleh sesi lain. Muat ulang lalu coba lagi.");
    const [updated] = await getSequelize().query<{ credit_cost: number; version: number; updated_at: Date }>(
      `UPDATE billing_usage_settings
       SET credit_cost = $2, version = version + 1, updated_by_admin_id = $3, updated_at = now()
       WHERE usage_kind = $1
       RETURNING credit_cost, version, updated_at`,
      { bind: [input.usageKind, input.creditCost, input.adminId], type: QueryTypes.SELECT, transaction },
    );
    if (!updated) throw new BillingAdminError("NOT_FOUND", "Aksi AI tidak ditemukan.");
    await getSequelize().query(
      `INSERT INTO billing_admin_audit_logs (id, admin_id, action, target_code, previous_value, next_value)
       VALUES ($1, $2, 'USAGE_SETTINGS_UPDATED', $3, $4::jsonb, $5::jsonb)`,
      { bind: [randomUUID(), input.adminId, input.usageKind, JSON.stringify({ creditCost: current.credit_cost, version: current.version }), JSON.stringify({ creditCost: updated.credit_cost, version: updated.version })], transaction },
    );
    return { usageKind: input.usageKind, creditCost: updated.credit_cost, version: updated.version, updatedAt: updated.updated_at };
  });
}

export async function listTransactions(input: { readonly page: number; readonly pageSize: number; readonly status?: BillingPaymentStatus; readonly productCode?: BillingProductCode; readonly from?: Date; readonly to?: Date }): Promise<{ readonly items: ReadonlyArray<AdminTransaction>; readonly total: number }> {
  const binds: Array<string | number | Date> = [];
  const conditions: string[] = [];
  const add = (condition: string, value: string | Date) => { binds.push(value); conditions.push(condition.replace("?", `$${binds.length}`)); };
  if (input.status) add("p.status = ?", input.status);
  if (input.productCode) add("p.product_code = ?", input.productCode);
  if (input.from) add("p.created_at >= ?", input.from);
  if (input.to) add("p.created_at < ?", input.to);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const database = getSequelize();
  const [countRow] = await database.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM billing_payments p ${where}`,
    { bind: binds, type: QueryTypes.SELECT },
  );
  const listBinds = [...binds, input.pageSize, (input.page - 1) * input.pageSize];
  const rows = await database.query<{ merchant_order_id: string; email: string; product_code: BillingProductCode; amount: number; granted_credits: number; status: BillingPaymentStatus; payment_method: string | null; duitku_reference: string | null; created_at: Date; paid_at: Date | null }>(
    `SELECT p.merchant_order_id, u.email, p.product_code, p.amount, p.granted_credits, p.status, p.payment_method, p.duitku_reference, p.created_at, p.paid_at
     FROM billing_payments p JOIN users u ON u.id = p.user_id
     ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT $${listBinds.length - 1} OFFSET $${listBinds.length}`,
    { bind: listBinds, type: QueryTypes.SELECT },
  );
  return { total: Number(countRow?.total ?? 0), items: rows.map((row) => ({ merchantOrderId: row.merchant_order_id, email: row.email, productCode: row.product_code, amount: row.amount, grantedCredits: row.granted_credits, status: row.status, paymentMethod: row.payment_method, duitkuReference: row.duitku_reference, createdAt: row.created_at, paidAt: row.paid_at })) };
}
