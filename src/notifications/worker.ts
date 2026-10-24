import "server-only";
import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { getSearchApiGoogleTrendsAdapter } from "@/trend/searchapi-google-trends";
import {
  isWeeklyDeliveryDay,
  monthlyDigestRequest,
  usableRows,
  weekStart,
  type Digest,
} from "./contract";
import {
  NotificationRepository,
  type PreferenceRow,
  type SubscriptionRow,
} from "./repository";
import { pushConfig, sendPush } from "./push";

export async function processDigest(
  repository = new NotificationRepository(),
  now = new Date(),
): Promise<boolean> {
  return repository.db.transaction(async (transaction) => {
    const rows = await repository.db.query<PreferenceRow>(
      `
      SELECT p.* FROM notification_preferences p JOIN users u ON u.id=p.user_id
      WHERE p.enabled AND p.next_run_at<=:now AND u.onboarding_status='COMPLETED'
      AND u.user_type IN ('ENTREPRENEUR','UMKM_EXISTING') ORDER BY p.next_run_at LIMIT 1 FOR UPDATE OF p SKIP LOCKED`,
      { replacements: { now }, transaction, type: QueryTypes.SELECT },
    );
    const row = rows[0];
    if (!row) return false;

    // ASVS 2.3.1: a missed weekly job is advanced, never replayed on another day.
    if (!isWeeklyDeliveryDay(now)) {
      await repository.updateSchedule(row, now, "READY", transaction);
      return true;
    }

    try {
      const deliveryWeek = weekStart(now);
      const existing = await repository.db.query(
        "SELECT id FROM trend_notifications WHERE user_id=:id AND week_start=:weekStart",
        {
          replacements: { id: row.user_id, weekStart: deliveryWeek },
          transaction,
          type: QueryTypes.SELECT,
        },
      );
      if (existing.length) {
        await repository.updateSchedule(row, now, "READY", transaction);
        return true;
      }

      const request = monthlyDigestRequest(now);
      const result = await getSearchApiGoogleTrendsAdapter().foodAndDrinkRelatedQueries(
        request,
      );
      const top = usableRows(result.top);
      const rising = usableRows(result.rising);
      if (!top.length && !rising.length) {
        await repository.updateSchedule(row, now, "NO_DATA", transaction);
        return true;
      }
      const digest: Digest = {
        category: "Food & Drink",
        scope: "Worldwide",
        period: "month",
        startDate: request.startDate ?? null,
        endDate: request.endDate ?? null,
        retrievedAt: result.retrievedAt,
        top,
        rising,
      };
      const id = randomUUID();
      await repository.db.query(
        `INSERT INTO trend_notifications(id,user_id,week_start,digest,created_at)
        VALUES (:id,:userId,:weekStart,CAST(:digest AS jsonb),:now) ON CONFLICT(user_id,week_start) DO NOTHING`,
        {
          replacements: {
            id,
            userId: row.user_id,
            weekStart: deliveryWeek,
            digest: JSON.stringify(digest),
            now,
          },
          transaction,
        },
      );
      await repository.db.query(
        `INSERT INTO notification_push_deliveries(notification_id,subscription_id)
        SELECT :id,id FROM push_subscriptions WHERE user_id=:userId ON CONFLICT DO NOTHING`,
        { replacements: { id, userId: row.user_id }, transaction },
      );
      await repository.updateSchedule(row, now, "READY", transaction);
    } catch {
      // Never persist provider errors, profile data, or credentials in public job status.
      await repository.updateSchedule(row, now, "RETRY", transaction, true);
    }
    return true;
  });
}

export async function processPush(
  repository = new NotificationRepository(),
  now = new Date(),
): Promise<boolean> {
  if (!pushConfig()) return false;
  return repository.db.transaction(async (transaction) => {
    const row = (
      await repository.db.query<
        SubscriptionRow & {
          notification_id: string;
          subscription_id: string;
          enabled: boolean;
        }
      >(
        `
        SELECT s.*,d.notification_id,d.subscription_id,p.enabled FROM notification_push_deliveries d
        JOIN push_subscriptions s ON s.id=d.subscription_id JOIN trend_notifications n ON n.id=d.notification_id AND n.user_id=s.user_id
        JOIN notification_preferences p ON p.user_id=s.user_id
        WHERE d.delivered_at IS NULL AND d.attempts<3 AND d.next_attempt_at<=:now
        ORDER BY d.next_attempt_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED`,
        { replacements: { now }, transaction, type: QueryTypes.SELECT },
      )
    )[0];
    if (!row) return false;
    const replacements = {
      notification: row.notification_id,
      subscription: row.subscription_id,
      now,
    };
    const fresh = await repository.db.query(
      "SELECT id FROM trend_notifications WHERE id=:notification AND created_at>CAST(:now AS timestamptz)-interval '8 days'",
      { replacements, transaction, type: QueryTypes.SELECT },
    );
    if (!row.enabled || !fresh.length) {
      await repository.db.query(
        "UPDATE notification_push_deliveries SET attempts=3 WHERE notification_id=:notification AND subscription_id=:subscription",
        { replacements, transaction },
      );
      return true;
    }
    try {
      await sendPush(row, { id: row.notification_id, userId: row.user_id });
      await repository.db.query(
        "UPDATE notification_push_deliveries SET delivered_at=:now,attempts=attempts+1 WHERE notification_id=:notification AND subscription_id=:subscription",
        { replacements, transaction },
      );
    } catch (error) {
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (status === 404 || status === 410) {
        await repository.db.query(
          "DELETE FROM push_subscriptions WHERE id=:subscription",
          { replacements, transaction },
        );
      } else {
        await repository.db.query(
          "UPDATE notification_push_deliveries SET attempts=attempts+1,next_attempt_at=:retry WHERE notification_id=:notification AND subscription_id=:subscription",
          {
            replacements: {
              ...replacements,
              retry: new Date(now.getTime() + 300_000),
            },
            transaction,
          },
        );
      }
    }
    return true;
  });
}

export async function runNotificationTick(): Promise<{
  digests: number;
  pushes: number;
}> {
  const repository = new NotificationRepository();
  getSearchApiGoogleTrendsAdapter();
  let digests = 0;
  let pushes = 0;
  while (digests < 100 && (await processDigest(repository))) {
    digests++;
    for (
      let device = 0;
      device < 5 && pushes < 500 && (await processPush(repository));
      device++
    )
      pushes++;
  }
  while (pushes < 500 && (await processPush(repository))) pushes++;
  return { digests, pushes };
}
