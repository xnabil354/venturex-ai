import { describe, expect, it } from "vitest";

import { timeSeriesAverage, trendInterestColor } from "./trend-radar-visualization";

describe("Trend Radar choropleth scale", () => {
  it("uses a stable ascending 0-100 scale and distinct neutral no-data styling", () => {
    const colors = [0, 20, 40, 60, 80, 100].map(trendInterestColor);
    expect(new Set(colors).size).toBe(6);
    expect(trendInterestColor(null)).not.toBe(trendInterestColor(0));
    expect(trendInterestColor(50)).toBe(trendInterestColor(60));
  });
});

describe("display average", () => {
  it("derives an observation mean excluding missing/invalid values but including zero", () => {
    const series = { averageInterest: null, points: [0, 40, 60, null, NaN, 101, -1].map(interestIndex => ({ interestIndex })) };
    expect(timeSeriesAverage(series)).toEqual({ value: 100 / 3, basis: "OBSERVATIONS", validCount: 3 });
    expect(series.averageInterest).toBeNull();
  });
  it("preserves provider values, including zero, and leaves an all-missing series unknown", () => {
    expect(timeSeriesAverage({ averageInterest: 0, points: [{ interestIndex: 100 }] }).value).toBe(0);
    expect(timeSeriesAverage({ averageInterest: null, points: [{ interestIndex: null }] }).value).toBeNull();
  });
});
