import type { QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

/** Trend Radar is available without consuming an AI credit. */
export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.transaction(async (transaction) => {
    await context.sequelize.query(`
      ALTER TABLE billing_usage_settings DROP CONSTRAINT billing_usage_settings_usage_kind_check;
      DELETE FROM billing_usage_settings WHERE usage_kind = 'TREND_INSIGHT';
      ALTER TABLE billing_usage_settings
        ADD CONSTRAINT billing_usage_settings_usage_kind_check
        CHECK (usage_kind IN ('OPPORTUNITY_HYPOTHESIS', 'DETAILED_ANALYSIS'));
    `, { transaction });
  });
};

export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.transaction(async (transaction) => {
    await context.sequelize.query(`
      ALTER TABLE billing_usage_settings DROP CONSTRAINT billing_usage_settings_usage_kind_check;
      INSERT INTO billing_usage_settings (usage_kind, credit_cost)
        VALUES ('TREND_INSIGHT', 1)
        ON CONFLICT (usage_kind) DO NOTHING;
      ALTER TABLE billing_usage_settings
        ADD CONSTRAINT billing_usage_settings_usage_kind_check
        CHECK (usage_kind IN ('TREND_INSIGHT', 'OPPORTUNITY_HYPOTHESIS', 'DETAILED_ANALYSIS'));
    `, { transaction });
  });
};
