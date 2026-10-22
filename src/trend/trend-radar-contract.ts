import { z } from "zod";

export const TREND_RADAR_TIME_PRESETS = {
  "1h": "now 1-H",
  "4h": "now 4-H",
  "24h": "now 1-d",
  "7d": "now 7-d",
  "1m": "today 1-m",
  "3m": "today 3-m",
  "1y": "today 12-m",
  "5y": "today 5-y",
  all: "all",
} as const;

export const TREND_RADAR_PROPERTIES = {
  web: null,
  images: "images",
  news: "news",
  shopping: "froogle",
  youtube: "youtube",
} as const;

export type TrendRadarPreset = keyof typeof TREND_RADAR_TIME_PRESETS;
export type TrendRadarProperty = keyof typeof TREND_RADAR_PROPERTIES;
export type GoogleTrendsGeoOption = Readonly<{ readonly geo: string; readonly label: string }>;
export const WORLDWIDE_TREND_GEO: GoogleTrendsGeoOption = { geo: "", label: "Seluruh dunia" };
export type TrendRadarRequest = {
  readonly queryKey?: string | undefined;
  readonly period: TrendRadarPreset | "year" | "custom-date" | "custom-hour";
  readonly property: TrendRadarProperty;
  readonly geo?: string | undefined;
  readonly year?: number | undefined;
  readonly startDate?: string | undefined;
  readonly endDate?: string | undefined;
  readonly startDateTime?: string | undefined;
  readonly endDateTime?: string | undefined;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
const hourPattern = /^\d{4}-\d{2}-\d{2}T\d{2}$/u;
const googleTrendsGeoCodeSchema = z.string().max(9).regex(/^(?:|[A-Z0-9]+(?:-[A-Z0-9]+)*)$/u);

export const trendRadarRequestSchema = z.object({
  queryKey: z.string().regex(/^(?:business|category|product:(?:[0-9]|1[0-9]))$/u).optional(),
  period: z.enum(["1h", "4h", "24h", "7d", "1m", "3m", "1y", "5y", "all", "year", "custom-date", "custom-hour"]),
  property: z.enum(["web", "images", "news", "shopping", "youtube"]),
  geo: googleTrendsGeoCodeSchema.default(""),
  year: z.number().int().optional(),
  startDate: z.string().regex(datePattern).optional(),
  endDate: z.string().regex(datePattern).optional(),
  startDateTime: z.string().regex(hourPattern).optional(),
  endDateTime: z.string().regex(hourPattern).optional(),
}).strict().superRefine((value, context) => {
  if (value.period === "year") {
    if (value.year === undefined) context.addIssue({ code: "custom", path: ["year"], message: "A year is required." });
    if (value.startDate !== undefined || value.endDate !== undefined || value.startDateTime !== undefined || value.endDateTime !== undefined) {
      context.addIssue({ code: "custom", message: "Year requests cannot include custom range fields." });
    }
    return;
  }
  if (value.period === "custom-date") {
    if (value.startDate === undefined) context.addIssue({ code: "custom", path: ["startDate"], message: "A start date is required." });
    if (value.endDate === undefined) context.addIssue({ code: "custom", path: ["endDate"], message: "An end date is required." });
    if (value.year !== undefined || value.startDateTime !== undefined || value.endDateTime !== undefined) {
      context.addIssue({ code: "custom", message: "Date requests contain unsupported range fields." });
    }
    return;
  }
  if (value.period === "custom-hour") {
    if (value.startDateTime === undefined) context.addIssue({ code: "custom", path: ["startDateTime"], message: "A start hour is required." });
    if (value.endDateTime === undefined) context.addIssue({ code: "custom", path: ["endDateTime"], message: "An end hour is required." });
    if (value.year !== undefined || value.startDate !== undefined || value.endDate !== undefined) {
      context.addIssue({ code: "custom", message: "Hourly requests contain unsupported range fields." });
    }
    return;
  }
  if (value.year !== undefined || value.startDate !== undefined || value.endDate !== undefined || value.startDateTime !== undefined || value.endDateTime !== undefined) {
    context.addIssue({ code: "custom", message: "Preset requests cannot include range fields." });
  }
});

export type TrendRadarQueryRow = {
  readonly position: number;
  readonly query: string;
  readonly interestIndex?: number | null;
  readonly growthLabel?: string | null;
  readonly growthPercent?: number | null;
  readonly isBreakout?: boolean;
  readonly sourceUrl: string | null;
};

export const trendRadarQueryRowSchema = z.object({
  position: z.number().int().positive(),
  query: z.string().min(1),
  interestIndex: z.number().finite().nonnegative().nullable().optional(),
  growthLabel: z.string().nullable().optional(),
  growthPercent: z.number().finite().nonnegative().nullable().optional(),
  isBreakout: z.boolean().optional(),
  sourceUrl: z.string().url().nullable(),
}).strict();

export const trendRadarResponseSchema = z.object({
  provider: z.literal("SearchApi.io"),
  retrievedAt: z.string().datetime(),
  cacheStatus: z.enum(["NETWORK", "HIT", "COALESCED"]),
  appliedFilters: z.object({
    period: z.string(),
    time: z.string(),
    property: z.enum(["web", "images", "news", "shopping", "youtube"]),
    geo: googleTrendsGeoCodeSchema,
    category: z.literal(0),
    timezoneOffsetMinutes: z.literal(-420),
    timezone: z.literal("Asia/Jakarta"),
  }).strict(),
  productQuery: z.string().min(1),
  top: z.array(trendRadarQueryRowSchema),
  rising: z.array(trendRadarQueryRowSchema),
  omittedInvalidRows: z.object({ top: z.number().int().nonnegative(), rising: z.number().int().nonnegative() }).strict(),
  requestId: z.string().min(1),
}).strict();

export const googleTrendsGeoOptionSchema = z.object({
  geo: googleTrendsGeoCodeSchema,
  label: z.string().trim().min(1).max(120),
}).strict();

export const googleTrendsGeoOptionsResponseSchema = z.object({
  options: z.array(googleTrendsGeoOptionSchema).max(40),
}).strict();

export type TrendRadarResponse = z.infer<typeof trendRadarResponseSchema>;

function jakartaDateParts(now: Date): { year: number; date: string; hour: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  return {
    year,
    date: String(values.year) + "-" + String(values.month) + "-" + String(values.day),
    hour: String(values.hour),
  };
}

export function getJakartaCurrentYear(now: Date = new Date()): number {
  return jakartaDateParts(now).year;
}

export function getJakartaToday(now: Date = new Date()): string {
  return jakartaDateParts(now).date;
}

function isRealDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function isRealHour(value: string): boolean {
  if (!hourPattern.test(value)) return false;
  const [date, hour] = value.split("T");
  return isRealDate(date!) && Number(hour) <= 23;
}

function localJakartaHourEpoch(value: string): number {
  // Asia/Jakarta is UTC+07:00. The provider offset is sent separately as the approved -420 value.
  return Date.parse(value + ":00+07:00");
}

export class InvalidTrendRadarTimeError extends Error {
  override readonly name = "InvalidTrendRadarTimeError";
}

export function toSearchApiTime(request: TrendRadarRequest, now: Date = new Date()): string {
  if (request.period in TREND_RADAR_TIME_PRESETS) {
    return TREND_RADAR_TIME_PRESETS[request.period as TrendRadarPreset];
  }

  const current = jakartaDateParts(now);
  if (request.period === "year") {
    if (!request.year || request.year < 2004 || request.year > current.year) {
      throw new InvalidTrendRadarTimeError();
    }
    return String(request.year) + "-01-01 " + (request.year === current.year ? current.date : String(request.year) + "-12-31");
  }

  if (request.period === "custom-date") {
    const start = request.startDate;
    const end = request.endDate;
    if (!start || !end || !isRealDate(start) || !isRealDate(end) || start > end || end > current.date) {
      throw new InvalidTrendRadarTimeError();
    }
    return start + " " + end;
  }

  const start = request.startDateTime;
  const end = request.endDateTime;
  if (!start || !end || !isRealHour(start) || !isRealHour(end) || start >= end) {
    throw new InvalidTrendRadarTimeError();
  }
  const lowerBound = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  if (localJakartaHourEpoch(start) < lowerBound || localJakartaHourEpoch(end) > now.getTime()) {
    throw new InvalidTrendRadarTimeError();
  }
  return start + " " + end;
}

export function toSearchApiProperty(property: TrendRadarProperty): string | null {
  return TREND_RADAR_PROPERTIES[property];
}

export function isShortTrendRadarPeriod(request: TrendRadarRequest): boolean {
  return request.period === "1h" || request.period === "4h" || request.period === "24h" || request.period === "7d" || request.period === "custom-hour";
}
