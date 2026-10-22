import "server-only";
import { randomUUID } from "node:crypto";
import { QueryTypes, type Sequelize, type Transaction } from "sequelize";
import { getSequelize } from "@/db/sequelize";
import { nextRun, type Preferences, type InboxItem } from "./contract";

export type PreferenceRow = {
  user_id: string;
  enabled: boolean;
  settings: Preferences;
  topic_query: string;
  next_run_at: Date;
  attempts: number;
  status: string | null;
};
export type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
export class NotificationRepository {
  constructor(readonly db: Sequelize = getSequelize()) {}
  async preferences(userId: string): Promise<PreferenceRow | null> {
    return (
      (
        await this.db.query<PreferenceRow>(
          "SELECT * FROM notification_preferences WHERE user_id=:userId",
          { replacements: { userId }, type: QueryTypes.SELECT },
        )
      )[0] ?? null
    );
  }
  async savePreferences(
    userId: string,
    preferences: Preferences,
    query: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO notification_preferences(user_id, enabled, settings, topic_query, next_run_at)
      VALUES (:userId,:enabled,CAST(:settings AS jsonb),:query,:next)
      ON CONFLICT(user_id) DO UPDATE SET enabled=EXCLUDED.enabled,settings=EXCLUDED.settings,topic_query=EXCLUDED.topic_query,
      next_run_at=EXCLUDED.next_run_at,attempts=0,status=NULL,updated_at=now()`,
      {
        replacements: {
          userId,
          enabled: preferences.enabled,
          settings: JSON.stringify(preferences),
          query,
          next: nextRun(new Date(), preferences.time, preferences.timezone),
        },
      },
    );
  }
  async inbox(
    userId: string,
    before?: string,
  ): Promise<{
    items: InboxItem[];
    nextCursor: string | null;
    unread: number;
  }> {
    const [rows, counts] = await Promise.all([
      this.db.query<{
        id: string;
        local_date: string;
        digest: InboxItem["digest"];
        read_at: Date | null;
        created_at: Date;
      }>(
        `
        SELECT id,local_date,digest,read_at,created_at FROM trend_notifications WHERE user_id=:userId
        ${before ? "AND (created_at,id) < (SELECT created_at,id FROM trend_notifications WHERE id=:before AND user_id=:userId)" : ""}
        ORDER BY created_at DESC,id DESC LIMIT 21`,
        {
          replacements: { userId, before: before ?? null },
          type: QueryTypes.SELECT,
        },
      ),
      this.db.query<{ count: string }>(
        "SELECT count(*) FROM trend_notifications WHERE user_id=:userId AND read_at IS NULL",
        { replacements: { userId }, type: QueryTypes.SELECT },
      ),
    ]);
    return {
      items: rows.slice(0, 20).map((row) => ({
        id: row.id,
        localDate: row.local_date,
        digest: row.digest,
        readAt: row.read_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
      })),
      nextCursor: rows.length > 20 ? rows[19]!.id : null,
      unread: Number(counts[0]?.count ?? 0),
    };
  }
  async markRead(userId: string, id: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      "UPDATE trend_notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=:userId AND id=:id RETURNING id",
      { replacements: { userId, id }, type: QueryTypes.SELECT },
    );
    return rows.length > 0;
  }
  async subscribe(
    userId: string,
    input: { endpoint: string; keys: SubscriptionRow["keys"] },
  ): Promise<boolean> {
    return this.db.transaction(async (transaction) => {
      // Serialize account registrations to enforce the device cap.
      await this.db.query("SELECT id FROM users WHERE id=:userId FOR UPDATE", {
        replacements: { userId },
        transaction,
      });
      const existing = await this.db.query<{ user_id: string }>(
        "SELECT user_id FROM push_subscriptions WHERE endpoint=:endpoint",
        {
          replacements: { endpoint: input.endpoint },
          transaction,
          type: QueryTypes.SELECT,
        },
      );
      if (existing[0] && existing[0].user_id !== userId) return false;
      const count = await this.db.query<{ count: string }>(
        "SELECT count(*) FROM push_subscriptions WHERE user_id=:userId",
        { replacements: { userId }, transaction, type: QueryTypes.SELECT },
      );
      if (!existing.length && Number(count[0]?.count) >= 5) return false;
      const registered = await this.db.query<{ id: string }>(
        `INSERT INTO push_subscriptions(id,user_id,endpoint,keys) VALUES (:id,:userId,:endpoint,CAST(:keys AS jsonb))
        ON CONFLICT(endpoint) DO UPDATE SET keys=EXCLUDED.keys WHERE push_subscriptions.user_id=EXCLUDED.user_id RETURNING id`,
        {
          replacements: {
            id: randomUUID(),
            userId,
            endpoint: input.endpoint,
            keys: JSON.stringify(input.keys),
          },
          transaction,
          type: QueryTypes.SELECT,
        },
      );
      return registered.length > 0;
    });
  }
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.db.query(
      "DELETE FROM push_subscriptions WHERE user_id=:userId AND endpoint=:endpoint",
      { replacements: { userId, endpoint } },
    );
  }
  async claimTest(
    userId: string,
    endpoint: string,
  ): Promise<SubscriptionRow | null> {
    return (
      (
        await this.db.query<SubscriptionRow>(
          `UPDATE push_subscriptions SET last_test_at=now() WHERE user_id=:userId AND endpoint=:endpoint
      AND (last_test_at IS NULL OR last_test_at < now()-interval '60 seconds') RETURNING *`,
          { replacements: { userId, endpoint }, type: QueryTypes.SELECT },
        )
      )[0] ?? null
    );
  }
  async updateSchedule(
    row: PreferenceRow,
    now: Date,
    status: string,
    transaction: Transaction,
    retry = false,
  ): Promise<void> {
    const attempt = retry ? row.attempts + 1 : 0;
    const attempts = attempt >= 3 ? 0 : attempt;
    const next =
      retry && attempt < 3
        ? new Date(now.getTime() + 300_000)
        : nextRun(now, row.settings.time, row.settings.timezone);
    if (retry && attempt >= 3) status = "UNAVAILABLE";
    await this.db.query(
      "UPDATE notification_preferences SET attempts=:attempts,status=:status,next_run_at=:next,updated_at=now() WHERE user_id=:userId",
      {
        replacements: { attempts, status, next, userId: row.user_id },
        transaction,
      },
    );
  }
}
