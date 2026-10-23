import type { QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

/**
 * Financial records are deliberately append-only. Balance is derived from credit
 * lots, while the ledger preserves the reason for every change.
 */
export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.query(`
    CREATE TABLE billing_accounts (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      active_plan varchar(16) NOT NULL DEFAULT 'FREE' CHECK (active_plan IN ('FREE', 'PREMIUM', 'PRO')),
      plan_starts_at timestamptz,
      plan_ends_at timestamptz,
      scheduled_plan varchar(16) CHECK (scheduled_plan IN ('PREMIUM', 'PRO')),
      scheduled_starts_at timestamptz,
      scheduled_payment_id uuid,
      trial_granted_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((active_plan = 'FREE') OR (plan_starts_at IS NOT NULL AND plan_ends_at IS NOT NULL))
    );

    CREATE TABLE billing_payments (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      product_code varchar(32) NOT NULL CHECK (product_code IN ('PREMIUM_30', 'PRO_30', 'CREDITS_10', 'CREDITS_30', 'CREDITS_100')),
      merchant_order_id varchar(96) NOT NULL UNIQUE,
      amount integer NOT NULL CHECK (amount > 0),
      status varchar(16) NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED')),
      duitku_reference varchar(128) UNIQUE,
      payment_method varchar(64),
      paid_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX billing_payments_user_created_idx ON billing_payments(user_id, created_at DESC);
    CREATE INDEX billing_payments_status_idx ON billing_payments(status, created_at);
    ALTER TABLE billing_accounts ADD CONSTRAINT billing_accounts_scheduled_payment_fk
      FOREIGN KEY (scheduled_payment_id) REFERENCES billing_payments(id) ON DELETE SET NULL;

    CREATE TABLE credit_lots (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      payment_id uuid REFERENCES billing_payments(id) ON DELETE RESTRICT,
      source varchar(16) NOT NULL CHECK (source IN ('TRIAL', 'PLAN', 'TOPUP')),
      initial_credits integer NOT NULL CHECK (initial_credits > 0),
      remaining_credits integer NOT NULL CHECK (remaining_credits >= 0 AND remaining_credits <= initial_credits),
      expires_at timestamptz,
      state varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE', 'FORFEITED', 'EXPIRED')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX credit_lots_spend_idx ON credit_lots(user_id, state, expires_at, created_at);

    CREATE TABLE credit_ledger_entries (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      lot_id uuid REFERENCES credit_lots(id) ON DELETE RESTRICT,
      payment_id uuid REFERENCES billing_payments(id) ON DELETE RESTRICT,
      kind varchar(16) NOT NULL CHECK (kind IN ('GRANT', 'RESERVATION', 'RELEASE', 'DEBIT', 'FORFEIT', 'EXPIRE')),
      credits_delta integer NOT NULL,
      usage_kind varchar(32),
      reference varchar(128) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX credit_ledger_user_created_idx ON credit_ledger_entries(user_id, created_at DESC);

    CREATE TABLE billing_webhook_events (
      id uuid PRIMARY KEY,
      merchant_order_id varchar(96) NOT NULL,
      provider_reference varchar(128),
      result_code varchar(16) NOT NULL,
      signature_valid boolean NOT NULL,
      outcome varchar(32) NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (merchant_order_id, result_code, provider_reference)
    );
  `);
};

export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.query(`
    DROP TABLE IF EXISTS billing_webhook_events;
    DROP TABLE IF EXISTS credit_ledger_entries;
    DROP TABLE IF EXISTS credit_lots;
    DROP TABLE IF EXISTS billing_payments;
    DROP TABLE IF EXISTS billing_accounts;
  `);
};
