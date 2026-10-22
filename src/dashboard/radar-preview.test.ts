import { describe, expect, it } from "vitest";
import type { TrendRadarResponse } from "@/trend/trend-radar-contract";
import { buildRadarPreview, radarMetric, radarSnapshotKey, readRadarSnapshot } from "./radar-preview";

export const radarResult: TrendRadarResponse = {
  provider: "SearchApi.io", retrievedAt: "2026-10-20T07:00:00.000Z", cacheStatus: "NETWORK", requestId: "preview-test", productQuery: "Kopi",
  appliedFilters: { period: "24h", time: "now 1-d", property: "web", geo: "US", category: 0, timezoneOffsetMinutes: -420, timezone: "Asia/Jakarta" },
  top: [1, 2, 3].map(position => ({ position, query: `kopi ${position}`, interestIndex: 100 - position, sourceUrl: null })),
  rising: [{ position: 1, query: "kopi gula aren", isBreakout: true, growthLabel: "Breakout", growthPercent: null, sourceUrl: null }],
  omittedInvalidRows: { top: 0, rising: 0 },
};

describe("dashboard radar preview", () => {
  it("keeps real Top and Rising metrics distinct and limits the preview", () => {
    const result = buildRadarPreview(radarResult);
    expect(result.preview).toHaveLength(3);
    expect(result.preview[0]?.summary).toBe("Indeks minat 99/100");
    expect(result.preview[2]?.summary).toBe("Breakout · minat meningkat tajam");
    expect(result.preview.every(row => row.href === "/trends")).toBe(true);
    expect(result.context).toContain("US · 24 jam · Web");
    expect(result.observedAt).toBe(radarResult.retrievedAt);
    expect(radarMetric({ growthPercent: 50 }, true)).toBe("Pertumbuhan +50%");
  });

  it("rejects malformed, oversized and outdated-profile snapshots", () => {
    expect(readRadarSnapshot("{", "Kopi")).toBeNull();
    expect(readRadarSnapshot("x".repeat(200_001), "Kopi")).toBeNull();
    expect(readRadarSnapshot(JSON.stringify({ productQuery: "Kopi" }), "Kopi")).toBeNull();
    expect(readRadarSnapshot(JSON.stringify(radarResult), "Soto")).toBeNull();
    expect(readRadarSnapshot(JSON.stringify(radarResult), "  Kopi  ")?.productQuery).toBe("Kopi");
    expect(radarSnapshotKey("account-a")).not.toBe(radarSnapshotKey("account-b"));
  });

  it("does not invent observations when a successful provider result is empty", () => {
    const result = buildRadarPreview({ ...radarResult, top: [], rising: [] });
    expect(result.status).toBe("EMPTY");
    expect(result.preview).toEqual([]);
    expect(result.observedAt).toBe(radarResult.retrievedAt);
  });
});
