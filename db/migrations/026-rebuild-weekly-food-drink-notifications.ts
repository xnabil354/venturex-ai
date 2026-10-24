import type { QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.transaction(async (transaction) => {
    // Product-approved reset: legacy personalized digests and device consent do not carry forward.
    await context.sequelize.query(
      `
      DELETE FROM notification_push_deliveries;
      DELETE FROM trend_notifications;
      DELETE FROM push_subscriptions;
      DELETE FROM notification_preferences;

      DROP INDEX IF EXISTS trend_notifications_unread;
      ALTER TABLE trend_notifications DROP CONSTRAINT IF EXISTS trend_notifications_user_id_local_date_key;
      ALTER TABLE trend_notifications RENAME COLUMN local_date TO week_start;
      ALTER TABLE trend_notifications DROP COLUMN read_at;
      ALTER TABLE trend_notifications ADD CONSTRAINT trend_notifications_user_id_week_start_key UNIQUE(user_id, week_start);

      ALTER TABLE notification_preferences DROP COLUMN settings;
      ALTER TABLE notification_preferences DROP COLUMN topic_query;
      ALTER TABLE push_subscriptions DROP COLUMN last_test_at;
      `,
      { transaction },
    );
  });
};

export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.transaction(async (transaction) => {
    await context.sequelize.query(
      `
      ALTER TABLE push_subscriptions ADD COLUMN last_test_at timestamptz;
      ALTER TABLE notification_preferences ADD COLUMN settings jsonb NOT NULL DEFAULT '{"enabled":false,"time":"08:00","timezone":"Asia/Jakarta","period":"24h","queryKey":"preferred"}'::jsonb;
      ALTER TABLE notification_preferences ADD COLUMN topic_query varchar(80) NOT NULL DEFAULT '';

      ALTER TABLE trend_notifications DROP CONSTRAINT IF EXISTS trend_notifications_user_id_week_start_key;
      ALTER TABLE trend_notifications ADD COLUMN read_at timestamptz;
      ALTER TABLE trend_notifications RENAME COLUMN week_start TO local_date;
      ALTER TABLE trend_notifications ADD CONSTRAINT trend_notifications_user_id_local_date_key UNIQUE(user_id, local_date);
      CREATE INDEX trend_notifications_unread ON trend_notifications(user_id) WHERE read_at IS NULL;
      `,
      { transaction },
    );
  });
};
