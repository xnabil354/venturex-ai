import { describe, expect, it } from "vitest";

import {
  InvalidTrendRadarTimeError,
  toSearchApiProperty,
  toSearchApiTime,
  trendRadarRequestSchema,
  type TrendRadarRequest,
} from "./trend-radar-contract";

const fixedNow = new Date("2026-10-17T12:00:00.000Z");

describe("Trend Radar request and SearchApi parameter contract", () => {
  it.each([
    ["1h", "now 1-H"],
    ["4h", "now 4-H"],
    ["24h", "now 1-d"],
    ["7d", "now 7-d"],
    ["1m", "today 1-m"],
    ["3m", "today 3-m"],
    ["1y", "today 12-m"],
    ["5y", "today 5-y"],
    ["all", "all"],
  ] as const)("maps preset %s to %s", (period, expected) => {
    expect(toSearchApiTime({ period, property: "web" }, fixedNow)).toBe(expected);
  });

  it.each([
    ["web", null],
    ["images", "images"],
    ["news", "news"],
    ["shopping", "froogle"],
    ["youtube", "youtube"],
  ] as const)("maps property %s", (property, expected) => {
    expect(toSearchApiProperty(property)).toBe(expected);
  });

  it("generates a year range through the current Asia/Jakarta date", () => {
    const input: TrendRadarRequest = { period: "year", year: 2026, property: "web" };
    expect(toSearchApiTime(input, fixedNow)).toBe("2026-01-01 2026-10-17");
    expect(toSearchApiTime({ ...input, year: 2025 }, fixedNow)).toBe("2025-01-01 2025-12-31");
    expect(() => toSearchApiTime({ ...input, year: 2003 }, fixedNow)).toThrow(InvalidTrendRadarTimeError);
    expect(() => toSearchApiTime({ ...input, year: 2027 }, fixedNow)).toThrow(InvalidTrendRadarTimeError);
  });

  it("validates custom calendar dates and custom hour ranges in Asia/Jakarta", () => {
    expect(toSearchApiTime({
      period: "custom-date",
      property: "web",
      startDate: "2026-10-01",
      endDate: "2026-10-17",
    }, fixedNow)).toBe("2026-10-01 2026-10-17");

    expect(toSearchApiTime({
      period: "custom-hour",
      property: "web",
      startDateTime: "2026-10-15T08",
      endDateTime: "2026-10-17T18",
    }, fixedNow)).toBe("2026-10-15T08 2026-10-17T18");

    expect(() => toSearchApiTime({
      period: "custom-date",
      property: "web",
      startDate: "2026-02-30",
      endDate: "2026-03-01",
    }, fixedNow)).toThrow(InvalidTrendRadarTimeError);
    expect(() => toSearchApiTime({
      period: "custom-date",
      property: "web",
      startDate: "2026-10-18",
      endDate: "2026-10-18",
    }, fixedNow)).toThrow(InvalidTrendRadarTimeError);
    expect(() => toSearchApiTime({
      period: "custom-hour",
      property: "web",
      startDateTime: "2026-10-09T18",
      endDateTime: "2026-10-10T18",
    }, fixedNow)).toThrow(InvalidTrendRadarTimeError);
  });

  it("rejects client-supplied queries and unrelated range fields", () => {
    expect(trendRadarRequestSchema.safeParse({ period: "24h", property: "web", q: "attacker query" }).success).toBe(false);
    expect(trendRadarRequestSchema.safeParse({ period: "24h", property: "web", year: 2025 }).success).toBe(false);
    expect(trendRadarRequestSchema.safeParse({ period: "custom-date", property: "web" }).success).toBe(false);
  });

  it("defaults omitted geography to Worldwide and accepts provider geography codes", () => {
    expect(trendRadarRequestSchema.parse({ period: "24h", property: "web" }).geo).toBe("");
    expect(trendRadarRequestSchema.parse({ period: "24h", property: "web", geo: "US-CA" }).geo).toBe("US-CA");
    expect(trendRadarRequestSchema.safeParse({ period: "24h", property: "web", geo: "US-CA-" }).success).toBe(false);
  });
});
