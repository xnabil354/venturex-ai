import { z } from "zod";
import { trendRadarRequestSchema, trendRadarResponseSchema, type TrendRadarRequest, type TrendRadarResponse } from "./trend-radar-contract";
import { trendRadarInterestResponseSchema, type TrendRadarInterestResponse } from "./trend-radar-interest-contract";
import { radarSnapshotKey } from "@/dashboard/radar-preview";

export const RADAR_HISTORY_LIMIT = 20;
const MAX_BYTES = 1_500_000;
export const RADAR_HISTORY_EVENT = "venturex:radar-history-changed";
export const radarHistoryKey = (userId: string) => `venturex:radar-history:v1:${userId}`;

const entrySchema = z.object({
  id: z.string().min(1).max(180),
  recordedAt: z.string().datetime(),
  geographyLabel: z.string().max(120),
  request: trendRadarRequestSchema.nullable(),
  result: trendRadarResponseSchema,
  interest: trendRadarInterestResponseSchema.nullable(),
}).strict().superRefine((entry, context) => {
  if (entry.interest && (entry.interest.productQuery !== entry.result.productQuery || JSON.stringify(entry.interest.appliedFilters) !== JSON.stringify(entry.result.appliedFilters))) {
    context.addIssue({ code: "custom", message: "History datasets must share one context." });
  }
  if (entry.request && (entry.request.property !== entry.result.appliedFilters.property || (entry.request.geo ?? "") !== entry.result.appliedFilters.geo || (entry.request.period === "year" ? String(entry.request.year) : entry.request.period) !== entry.result.appliedFilters.period)) {
    context.addIssue({ code: "custom", message: "History filters must match the result." });
  }
});
const historySchema = z.object({ version: z.literal(1), activeId: z.string(), entries: z.array(entrySchema).max(RADAR_HISTORY_LIMIT) }).strict().superRefine((history, context) => {
  if (new Set(history.entries.map(entry => entry.id)).size !== history.entries.length || (history.entries.length > 0 && !history.entries.some(entry => entry.id === history.activeId))) {
    context.addIssue({ code: "custom", message: "History selection is invalid." });
  }
});
export type RadarHistoryEntry = z.infer<typeof entrySchema>;
export type RadarHistory = z.infer<typeof historySchema>;

export function readRadarHistory(raw: string | null): RadarHistory | null {
  if (!raw || raw.length > MAX_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const history = historySchema.safeParse(value);
    if (history.success) return history.data;
    const legacy = trendRadarResponseSchema.safeParse(value);
    if (!legacy.success) return null;
    const id = `legacy-${legacy.data.requestId}`;
    const filters = legacy.data.appliedFilters;
    const [start, end] = filters.time.split(" ");
    const inferred = trendRadarRequestSchema.safeParse({
      property: filters.property, geo: filters.geo,
      ...(/^\d{4}$/u.test(filters.period) ? { period: "year", year: Number(filters.period) }
        : filters.period === "custom-date" ? { period: filters.period, startDate: start, endDate: end }
        : filters.period === "custom-hour" ? { period: filters.period, startDateTime: start, endDateTime: end }
        : { period: filters.period }),
    });
    return { version: 1, activeId: id, entries: [{ id, recordedAt: legacy.data.retrievedAt, geographyLabel: filters.geo || "Seluruh dunia", request: inferred.success ? inferred.data : null, result: legacy.data, interest: null }] };
  } catch { return null; }
}

export function getRadarHistoryRaw(userId: string): string | null {
  try { return localStorage.getItem(radarHistoryKey(userId)) ?? localStorage.getItem(radarSnapshotKey(userId)); } catch { return null; }
}

function persistHistory(userId: string, history: RadarHistory): boolean {
  const entries = [...history.entries];
  let serialized = JSON.stringify({ ...history, entries });
  while (serialized.length > MAX_BYTES && entries.length > 1) {
    const removable = entries.findLastIndex(entry => entry.id !== history.activeId);
    if (removable < 0) break;
    entries.splice(removable, 1);
    serialized = JSON.stringify({ ...history, entries });
  }
  if (serialized.length > MAX_BYTES) return false;
  try {
    localStorage.setItem(radarHistoryKey(userId), serialized);
    const active = entries.find(entry => entry.id === history.activeId);
    if (active) {
      try { localStorage.setItem(radarSnapshotKey(userId), JSON.stringify(active.result)); } catch { /* History remains authoritative for the browser preview. */ }
    }
    window.dispatchEvent(new Event(RADAR_HISTORY_EVENT));
    return true;
  } catch { return false; }
}

export function recordRadarHistory(userId: string, result: TrendRadarResponse, interest: TrendRadarInterestResponse | null, request: TrendRadarRequest, geographyLabel: string, recordedAt = new Date().toISOString()): boolean {
  const entry = entrySchema.safeParse({ id: result.requestId, result, interest, request, geographyLabel, recordedAt });
  if (!entry.success) return false;
  const previous = readRadarHistory(getRadarHistoryRaw(userId));
  const entries = [entry.data, ...(previous?.entries ?? []).filter(item => item.id !== entry.data.id)].slice(0, RADAR_HISTORY_LIMIT);
  return persistHistory(userId, { version: 1, activeId: entry.data.id, entries });
}

export function activateRadarHistory(userId: string, id: string): boolean {
  const history = readRadarHistory(getRadarHistoryRaw(userId));
  if (!history?.entries.some(entry => entry.id === id)) return false;
  return persistHistory(userId, { ...history, activeId: id });
}
