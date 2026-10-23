import { randomUUID } from "node:crypto";
import type { QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const LEGACY_ADMIN_EMAIL = "adminventurex@gmail.com";

/**
 * Separates operator credentials from customer records and makes every payment
 * retain the entitlement that was offered when its checkout was created.
 */
export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.transaction(async (transaction) => {
    await context.sequelize.query(`
      ALTER TABLE users ADD COLUMN login_disabled_at timestamptz;

      CREATE TABLE admins (
        id uuid PRIMARY KEY,
        email varchar(320) NOT NULL UNIQUE,
        password_hash varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE billing_product_settings (
        product_code varchar(32) PRIMARY KEY CHECK (product_code IN ('PREMIUM_30', 'PRO_30', 'CREDITS_10', 'CREDITS_30', 'CREDITS_100')),
        amount integer NOT NULL CHECK (amount > 0),
        granted_credits integer NOT NULL CHECK (granted_credits > 0),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        updated_by_admin_id uuid REFERENCES admins(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE billing_usage_settings (
        usage_kind varchar(32) PRIMARY KEY CHECK (usage_kind IN ('TREND_INSIGHT', 'OPPORTUNITY_HYPOTHESIS', 'DETAILED_ANALYSIS')),
        credit_cost integer NOT NULL CHECK (credit_cost >= 0 AND credit_cost <= 100),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        updated_by_admin_id uuid REFERENCES admins(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE billing_admin_audit_logs (
        id uuid PRIMARY KEY,
        admin_id uuid NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
        action varchar(48) NOT NULL CHECK (action IN ('PRODUCT_SETTINGS_UPDATED', 'USAGE_SETTINGS_UPDATED')),
        target_code varchar(32) NOT NULL,
        previous_value jsonb NOT NULL,
        next_value jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX billing_admin_audit_logs_target_created_idx ON billing_admin_audit_logs(target_code, created_at DESC);

      ALTER TABLE billing_payments ADD COLUMN granted_credits integer;
    `, { transaction });

    const [legacyRows] = await context.sequelize.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE email = $1 FOR UPDATE",
      { bind: [LEGACY_ADMIN_EMAIL], transaction },
    );
    const legacy = legacyRows[0];
    if (!legacy) {
      throw new Error("Legacy admin account was not found; refusing to leave the admin area without an owner.");
    }

    await context.sequelize.query(
      "INSERT INTO admins (id, email, password_hash) VALUES ($1, $2, $3)",
      { bind: [randomUUID(), LEGACY_ADMIN_EMAIL, legacy.password_hash], transaction },
    );
    await context.sequelize.query(
      "UPDATE users SET login_disabled_at = now(), updated_at = now() WHERE email = $1",
      { bind: [LEGACY_ADMIN_EMAIL], transaction },
    );

    await context.sequelize.query(`
      INSERT INTO billing_product_settings (product_code, amount, granted_credits) VALUES
        ('PREMIUM_30', 84000, 25),
        ('PRO_30', 146000, 50),
        ('CREDITS_10', 20000, 10),
        ('CREDITS_30', 50000, 30),
        ('CREDITS_100', 150000, 100);

      INSERT INTO billing_usage_settings (usage_kind, credit_cost) VALUES
        ('TREND_INSIGHT', 1),
        ('OPPORTUNITY_HYPOTHESIS', 2),
        ('DETAILED_ANALYSIS', 3);

      UPDATE billing_payments SET granted_credits = CASE product_code
        WHEN 'PREMIUM_30' THEN 25
        WHEN 'PRO_30' THEN 50
        WHEN 'CREDITS_10' THEN 10
        WHEN 'CREDITS_30' THEN 30
        WHEN 'CREDITS_100' THEN 100
      END;
      ALTER TABLE billing_payments ALTER COLUMN granted_credits SET NOT NULL;
      ALTER TABLE billing_payments ADD CONSTRAINT billing_payments_granted_credits_check CHECK (granted_credits > 0);
    `, { transaction });
  });
};

export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.transaction(async (transaction) => {
    await context.sequelize.query(`
      ALTER TABLE billing_payments DROP CONSTRAINT IF EXISTS billing_payments_granted_credits_check;
      ALTER TABLE billing_payments DROP COLUMN IF EXISTS granted_credits;
      DROP TABLE IF EXISTS billing_admin_audit_logs;
      DROP TABLE IF EXISTS billing_usage_settings;
      DROP TABLE IF EXISTS billing_product_settings;
      DROP TABLE IF EXISTS admins;
      UPDATE users SET login_disabled_at = NULL WHERE email = '${LEGACY_ADMIN_EMAIL}';
      ALTER TABLE users DROP COLUMN IF EXISTS login_disabled_at;
    `, { transaction });
  });
};
