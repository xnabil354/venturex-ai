// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { activateRadarHistory, getRadarHistoryRaw, readRadarHistory, recordRadarHistory } from "./trend-radar-history";
import type { TrendRadarResponse } from "./trend-radar-contract";

const result: TrendRadarResponse = {
  provider: "SearchApi.io", retrievedAt: "2026-10-21T00:00:00.000Z", cacheStatus: "NETWORK", requestId: "first", productQuery: "Kopi",
  appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "", category: 0, timezoneOffsetMinutes: -420, timezone: "Asia/Jakarta" },
  top: [], rising: [], omittedInvalidRows: { top: 0, rising: 0 },
};
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe("radar history", () => {
  it("bounds successful history, keeps empty observations, and restores a prior selection per account", () => {
    for (let i = 0; i < 25; i++) expect(recordRadarHistory("a", { ...result, requestId: `request-${i}` }, null, { period: "24h", property: "web" }, "Seluruh dunia")).toBe(true);
    const history = readRadarHistory(getRadarHistoryRaw("a"));
    expect(history?.entries).toHaveLength(20);
    expect(history?.entries[0]?.id).toBe("request-24");
    expect(history?.entries[0]?.result.top).toEqual([]);
    expect(activateRadarHistory("a", "request-5")).toBe(true);
    expect(readRadarHistory(getRadarHistoryRaw("a"))?.activeId).toBe("request-5");
    expect(getRadarHistoryRaw("b")).toBeNull();
    expect(activateRadarHistory("a", "missing")).toBe(false);
  });
  it("rejects corrupt data and inconsistent filters without overwriting valid history", () => {
    recordRadarHistory("a", result, null, { period: "24h", property: "web" }, "Seluruh dunia");
    const before = getRadarHistoryRaw("a");
    expect(recordRadarHistory("a", result, null, { period: "7d", property: "web" }, "Seluruh dunia")).toBe(false);
    expect(getRadarHistoryRaw("a")).toBe(before);
    expect(readRadarHistory("{broken")).toBeNull();
    expect(readRadarHistory(JSON.stringify({ version: 1, activeId: "missing", entries: readRadarHistory(before)?.entries }))).toBeNull();
  });
  it("migrates the previous snapshot and handles denied storage safely", () => {
    expect(readRadarHistory(JSON.stringify(result))?.entries[0]?.result).toEqual(result);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(recordRadarHistory("a", result, null, { period: "24h", property: "web" }, "Seluruh dunia")).toBe(false);
  });
  it("preserves custom range options and matching interest data", () => {
    const filters = { ...result.appliedFilters, period: "custom-date", time: "2026-10-01 2026-10-10", geo: "US" };
    const interest = {
      provider: "SearchApi.io" as const, productQuery: "Kopi", appliedFilters: filters,
      timeSeries: null, regionalInterest: null,
      availability: { timeSeries: "empty" as const, regionalInterest: "empty" as const },
      datasets: {
        timeSeries: { status: "NETWORK" as const, retrievedAt: result.retrievedAt, error: null },
        regionalInterest: { status: "NETWORK" as const, retrievedAt: result.retrievedAt, error: null },
      }, requestId: "interest",
    };
    const request = { period: "custom-date" as const, property: "web" as const, geo: "US", startDate: "2026-10-01", endDate: "2026-10-10" };
    expect(recordRadarHistory("a", { ...result, appliedFilters: filters }, interest, request, "Amerika Serikat")).toBe(true);
    const stored = readRadarHistory(getRadarHistoryRaw("a"))?.entries[0];
    expect(stored?.request).toEqual(request);
    expect(stored?.interest).toEqual(interest);
    expect(recordRadarHistory("a", { ...result, appliedFilters: filters }, { ...interest, productQuery: "Teh" }, request, "Amerika Serikat")).toBe(false);
  });
});
