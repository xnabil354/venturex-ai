import type { TrendRegionalInterest, TrendTimeSeries, TrendTimePoint } from "./trend-radar-interest-contract";
import { isSearchApiTrendsNoData } from "./searchapi-trends-no-data";

export class TrendRadarInterestDataError extends Error {
  override readonly name = "TrendRadarInterestDataError";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function indexValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value.replace(/%$/u, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function pointIndex(value: unknown, extracted: unknown): number | null {
  if (typeof value === "string" && value.trim() === "" && extracted === 0) return null;
  return indexValue(extracted) ?? indexValue(value);
}

function unixTimestamp(value: unknown): number | null {
  const seconds = typeof value === "number" ? value : typeof value === "string" && /^\d{1,12}$/u.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const milliseconds = seconds * 1_000;
  return Number.isSafeInteger(milliseconds) && Number.isFinite(new Date(milliseconds).getTime()) ? seconds : null;
}

function exactValue(values: unknown, query: string): Record<string, unknown> | null {
  if (!Array.isArray(values)) return null;
  let unlabeledSingleValue: Record<string, unknown> | null = null;
  for (const value of values) {
    const record = asRecord(value);
    if (record?.query === query) return record;
    if (record && (typeof record.query !== "string" || !record.query.trim())) unlabeledSingleValue = record;
  }
  return !query.includes(",") && values.length === 1 ? unlabeledSingleValue : null;
}

export function normalizeSearchApiTimeSeries(payload: unknown, query: string): TrendTimeSeries {
  if (isSearchApiTrendsNoData(payload)) return { query, points: [], averageInterest: null, omittedInvalidPoints: 0 };
  const root = asRecord(payload);
  const interest = asRecord(root?.interest_over_time);
  if (!interest || !Array.isArray(interest.timeline_data)) {
    throw new TrendRadarInterestDataError("PROVIDER_RESPONSE_INVALID");
  }

  const points: TrendTimePoint[] = [];
  const seen = new Set<number>();
  let omittedInvalidPoints = 0;
  for (const raw of interest.timeline_data) {
    const row = asRecord(raw);
    const timestamp = unixTimestamp(row?.timestamp);
    const label = typeof row?.date === "string" && row.date.trim() ? row.date.trim().slice(0, 120) : null;
    const hasValues = Array.isArray(row?.values);
    const matched = exactValue(row?.values, query);
    if (!timestamp || !label || !hasValues || seen.has(timestamp)) {
      omittedInvalidPoints += 1;
      continue;
    }
    seen.add(timestamp);
    points.push({ timestamp, label, interestIndex: matched ? pointIndex(matched.value, matched.extracted_value) : null });
  }
  points.sort((left, right) => left.timestamp - right.timestamp);

  const averages = Array.isArray(interest.averages) ? interest.averages : [];
  const average = exactValue(averages, query);
  const averageInterest = average ? pointIndex(average.value, average.extracted_value) : null;
  return { query, points, averageInterest, omittedInvalidPoints };
}

export function normalizeSearchApiRegionalInterest(payload: unknown, query: string): TrendRegionalInterest {
  if (isSearchApiTrendsNoData(payload)) return { query, regions: [], omittedInvalidRegions: 0 };
  const root = asRecord(payload);
  if (!root || !Array.isArray(root.interest_by_region)) throw new TrendRadarInterestDataError("PROVIDER_RESPONSE_INVALID");

  const rows: Array<Omit<TrendRegionalInterest["regions"][number], "position">> = [];
  const seen = new Set<string>();
  let omittedInvalidRegions = 0;
  for (const raw of root.interest_by_region) {
    const row = asRecord(raw);
    const sourceGeoCode = typeof row?.geo === "string" ? row.geo.trim() : "";
    const geoCode = sourceGeoCode.toUpperCase();
    const name = typeof row?.name === "string" ? row.name.trim().slice(0, 120) : "";
    const hasValues = Array.isArray(row?.values);
    const matched = exactValue(row?.values, query);
    if (sourceGeoCode !== geoCode || geoCode.length > 9 || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/u.test(geoCode) || !name || !hasValues || seen.has(geoCode)) {
      omittedInvalidRegions += 1;
      continue;
    }
    seen.add(geoCode);
    rows.push({ geoCode, name, interestIndex: matched ? pointIndex(matched.value, matched.extracted_value) : null });
  }
  rows.sort((left, right) => {
    if (left.interestIndex === null) return right.interestIndex === null ? left.geoCode.localeCompare(right.geoCode, "en") : 1;
    if (right.interestIndex === null) return -1;
    return right.interestIndex - left.interestIndex || left.geoCode.localeCompare(right.geoCode, "en");
  });
  return {
    query,
    regions: rows.map((row, index) => ({ ...row, position: index + 1 })),
    omittedInvalidRegions,
  };
}
