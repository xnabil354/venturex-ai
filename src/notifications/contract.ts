import { z } from "zod";
import type {
  TrendRadarRequest,
  TrendRadarResponse,
} from "../trend/trend-radar-contract";

type TrendRadarQueryRow = TrendRadarResponse["top"][number];

// ASVS 2.2.1: the only user-controlled notification preference is an allowlisted boolean.
export const notificationPreferenceSchema = z
  .object({ enabled: z.boolean() })
  .strict();

export const NOTIFICATION_CATEGORY = "Food & Drink";
export const NOTIFICATION_SCOPE = "Worldwide";
export const NOTIFICATION_SCHEDULE_LABEL = "Setiap Senin, 12.00 WIB";

export type Digest = {
  category: typeof NOTIFICATION_CATEGORY;
  scope: typeof NOTIFICATION_SCOPE;
  period: "month";
  startDate: string | null;
  endDate: string | null;
  retrievedAt: string;
  top: TrendRadarQueryRow[];
  rising: TrendRadarQueryRow[];
};
export type InboxItem = {
  id: string;
  weekStart: string;
  digest: Digest;
  createdAt: string;
};
export type NotificationState = {
  enabled: boolean;
  status: string | null;
  category: typeof NOTIFICATION_CATEGORY;
  scope: typeof NOTIFICATION_SCOPE;
  schedule: typeof NOTIFICATION_SCHEDULE_LABEL;
  pushAvailable: boolean;
  publicKey: string | null;
  userId: string;
};

function jakartaDate(now: Date): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
function dateAtNoonWib(date: string): Date {
  return new Date(`${date}T12:00:00+07:00`);
}
function mondayFor(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year!, month! - 1, day!));
  utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
  return utc.toISOString().slice(0, 10);
}
export function weekStart(now: Date): string {
  return mondayFor(jakartaDate(now));
}
export function scheduledMonday(now: Date): Date {
  return dateAtNoonWib(weekStart(now));
}
export function nextWeeklyRun(now: Date): Date {
  const candidate = scheduledMonday(now);
  return candidate.getTime() > now.getTime()
    ? candidate
    : new Date(candidate.getTime() + 7 * 86_400_000);
}
export function isWeeklyDeliveryDay(now: Date): boolean {
  return (
    jakartaDate(now) === weekStart(now) &&
    now.getTime() >= scheduledMonday(now).getTime()
  );
}
export function monthlyDigestRequest(now: Date): TrendRadarRequest {
  const today = jakartaDate(now);
  return {
    period: "custom-date",
    startDate: `${today.slice(0, 7)}-01`,
    endDate: today,
    geo: "",
    property: "web",
  };
}

export function usableRows(
  rows: readonly TrendRadarQueryRow[],
): TrendRadarQueryRow[] {
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      const key = row.query.normalize("NFKC").trim().toLocaleLowerCase("id");
      if (
        !key ||
        key.length > 160 ||
        /\b(?:mutilasi|porn\w*|bokep|bunuh diri|gore|pemerkosaan)\b/iu.test(key) ||
        seen.has(key)
      )
        return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export function isPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (url.hostname === "fcm.googleapis.com" ||
        url.hostname === "updates.push.services.mozilla.com" ||
        url.hostname === "web.push.apple.com" ||
        /^[a-z0-9-]+\.push\.apple\.com$/u.test(url.hostname) ||
        /^[a-z0-9-]+\.notify\.windows\.com$/u.test(url.hostname))
    );
  } catch {
    return false;
  }
}
export const endpointSchema = z.string().url().max(2048).refine(isPushEndpoint);
export const subscriptionSchema = z
  .object({
    endpoint: endpointSchema,
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/u),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/u),
      })
      .strict(),
  })
  .strict();
