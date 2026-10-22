import type { QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

export const up: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.transaction(async (transaction) => {
    await context.sequelize.query(
      `
      CREATE TABLE notification_preferences (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        enabled boolean NOT NULL DEFAULT false,
        settings jsonb NOT NULL,
        topic_query varchar(80) NOT NULL,
        next_run_at timestamptz NOT NULL,
        attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
        status varchar(32), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX notification_preferences_due ON notification_preferences(next_run_at) WHERE enabled;
      CREATE TABLE trend_notifications (
        id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        local_date date NOT NULL, digest jsonb NOT NULL, read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, local_date)
      );
      CREATE INDEX trend_notifications_owner ON trend_notifications(user_id, created_at DESC, id DESC);
      CREATE INDEX trend_notifications_unread ON trend_notifications(user_id) WHERE read_at IS NULL;
      CREATE TABLE push_subscriptions (
        id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint varchar(2048) NOT NULL UNIQUE, keys jsonb NOT NULL,
        last_test_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX push_subscriptions_owner ON push_subscriptions(user_id);
      CREATE TABLE notification_push_deliveries (
        notification_id uuid NOT NULL REFERENCES trend_notifications(id) ON DELETE CASCADE,
        subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
        attempts integer NOT NULL DEFAULT 0, delivered_at timestamptz,
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(notification_id, subscription_id)
      );
      CREATE INDEX notification_push_due ON notification_push_deliveries(next_attempt_at) WHERE delivered_at IS NULL AND attempts < 3;
    `,
      { transaction },
    );
  });
};
export const down: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.sequelize.transaction(async (transaction) => {
    for (const table of [
      "notification_push_deliveries",
      "push_subscriptions",
      "trend_notifications",
      "notification_preferences",
    ]) {
      await context.dropTable(table, { transaction });
    }
  });
};
