import { z } from "zod";
import type {
  TrendRadarRequest,
  TrendRadarResponse,
} from "../trend/trend-radar-contract";
type TrendRadarQueryRow = TrendRadarResponse["top"][number];

export const preferenceSchema = z
  .object({
    enabled: z.boolean(),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
    timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]),
    period: z.enum(["24h", "7d", "month"]),
    queryKey: z
      .string()
      .regex(/^(?:preferred|business|category|product:(?:[0-9]|1[0-9]))$/u),
  })
  .strict();
export type Preferences = z.infer<typeof preferenceSchema>;
export const defaultPreferences: Preferences = {
  enabled: false,
  time: "08:00",
  timezone: "Asia/Jakarta",
  period: "24h",
  queryKey: "preferred",
};
export type TopicOption = { key: string; label: string; query: string };
export type Digest = {
  query: string;
  queryKey?: string;
  period: Preferences["period"];
  startDate: string | null;
  endDate: string | null;
  retrievedAt: string;
  top: TrendRadarQueryRow[];
  rising: TrendRadarQueryRow[];
};
export type InboxItem = {
  id: string;
  localDate: string;
  digest: Digest;
  readAt: string | null;
  createdAt: string;
};
export type NotificationState = {
  preferences: Preferences;
  topicQuery: string | null;
  status: string | null;
  options: TopicOption[];
  pushAvailable: boolean;
  publicKey: string | null;
  userId: string;
};

const offsets = {
  "Asia/Jakarta": 7,
  "Asia/Makassar": 8,
  "Asia/Jayapura": 9,
} as const;
export function localDate(
  now: Date,
  timezone: Preferences["timezone"],
): string {
  return new Date(now.getTime() + offsets[timezone] * 3_600_000)
    .toISOString()
    .slice(0, 10);
}
export function nextRun(
  now: Date,
  time: string,
  timezone: Preferences["timezone"],
): Date {
  const candidate = scheduledToday(now, time, timezone);
  return candidate.getTime() > now.getTime()
    ? candidate
    : new Date(candidate.getTime() + 86_400_000);
}
export function scheduledToday(
  now: Date,
  time: string,
  timezone: Preferences["timezone"],
): Date {
  return new Date(
    `${localDate(now, timezone)}T${time}:00+0${offsets[timezone]}:00`,
  );
}
export function digestRequest(
  preferences: Preferences,
  now: Date,
): TrendRadarRequest {
  const base = {
    property: "web" as const,
    geo: "ID",
    ...(preferences.queryKey === "preferred"
      ? {}
      : { queryKey: preferences.queryKey }),
  };
  if (preferences.period !== "month")
    return { ...base, period: preferences.period };
  // Source dates follow the existing Radar observation timezone, independently of delivery timezone.
  const today = localDate(now, "Asia/Jakarta");
  return {
    ...base,
    period: "custom-date",
    startDate: `${today.slice(0, 7)}-01`,
    endDate: today,
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
        /\b(?:mutilasi|porn\w*|bokep|bunuh diri|gore|pemerkosaan)\b/iu.test(
          key,
        ) ||
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
