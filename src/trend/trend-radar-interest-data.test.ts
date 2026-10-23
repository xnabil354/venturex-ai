import { describe, expect, it } from "vitest";

import { normalizeSearchApiRegionalInterest, normalizeSearchApiTimeSeries } from "./trend-radar-interest-data";

describe("Trend Radar interest normalization", () => {
  it("sorts valid Unix-second observations, preserves exact-query zeros and missing values, and omits duplicate/invalid timestamps", () => {
    const result = normalizeSearchApiTimeSeries({
      interest_over_time: {
        averages: [{ query: "Kopi", value: "25", extracted_value: 25 }, { query: "Teh", value: "99", extracted_value: 99 }],
        timeline_data: [
          { date: "Hari kedua", timestamp: "1792267200", values: [{ query: "Kopi", value: "0", extracted_value: 0 }] },
          { date: "Hari pertama", timestamp: 1792180800, values: [{ query: "Kopi", value: "73", extracted_value: 73 }] },
          { date: "Duplikat", timestamp: 1792180800, values: [{ query: "Kopi", value: "10", extracted_value: 10 }] },
          { date: "Bukan query yang sama", timestamp: "1792353600", values: [{ query: "Teh", value: "100", extracted_value: 100 }] },
          { date: "Timestamp rusak", timestamp: "NaN", values: [{ query: "Kopi", value: "20", extracted_value: 20 }] },
          { date: "Nilai kosong", timestamp: "1792440000", values: [{ query: "Kopi", value: "", extracted_value: 0 }] },
        ],
      },
    }, "Kopi");

    expect(result.points).toEqual([
      { timestamp: 1792180800, label: "Hari pertama", interestIndex: 73 },
      { timestamp: 1792267200, label: "Hari kedua", interestIndex: 0 },
      { timestamp: 1792353600, label: "Bukan query yang sama", interestIndex: null },
      { timestamp: 1792440000, label: "Nilai kosong", interestIndex: null },
    ]);
    expect(result.averageInterest).toBe(25);
    expect(result.omittedInvalidPoints).toBe(2);
  });

  it("keeps unknown but syntactically valid region codes in deterministic ranking and never takes another query's values", () => {
    const result = normalizeSearchApiRegionalInterest({
      interest_by_region: [
        { geo: "ID-JI", name: "Jawa Timur", values: [{ query: "Kopi", value: "80", extracted_value: 80 }] },
        { geo: "ID-ZZ", name: "Wilayah baru", values: [{ query: "Teh", value: "100", extracted_value: 100 }] },
        { geo: "ID-BA", name: "Bali", values: [{ query: "Kopi", value: "80", extracted_value: 80 }] },
        { geo: "not-a-region", name: "Invalid", values: [{ query: "Kopi", value: "99", extracted_value: 99 }] },
      ],
    }, "Kopi");

    expect(result.regions).toEqual([
      { position: 1, geoCode: "ID-BA", name: "Bali", interestIndex: 80 },
      { position: 2, geoCode: "ID-JI", name: "Jawa Timur", interestIndex: 80 },
      { position: 3, geoCode: "ID-ZZ", name: "Wilayah baru", interestIndex: null },
    ]);
    expect(result.omittedInvalidRegions).toBe(1);
  });

  it("preserves country and international subdivision codes for a non-Indonesia selection", () => {
    const result = normalizeSearchApiRegionalInterest({
      interest_by_region: [
        { geo: "US", name: "United States", values: [{ query: "Kopi", value: "72", extracted_value: 72 }] },
        { geo: "US-CA", name: "California", values: [{ query: "Kopi", value: "86", extracted_value: 86 }] },
        { geo: "AU-NSW", name: "New South Wales", values: [{ query: "Kopi", value: "91", extracted_value: 91 }] },
      ],
    }, "Kopi");

    expect(result.regions).toEqual([
      { position: 1, geoCode: "AU-NSW", name: "New South Wales", interestIndex: 91 },
      { position: 2, geoCode: "US-CA", name: "California", interestIndex: 86 },
      { position: 3, geoCode: "US", name: "United States", interestIndex: 72 },
    ]);
    expect(result.omittedInvalidRegions).toBe(0);
  });

  it("returns empty datasets but rejects malformed provider envelopes", () => {
    expect(normalizeSearchApiTimeSeries({ interest_over_time: { averages: [], timeline_data: [] } }, "Kopi").points).toEqual([]);
    expect(normalizeSearchApiRegionalInterest({ interest_by_region: [] }, "Kopi").regions).toEqual([]);
    expect(() => normalizeSearchApiTimeSeries({}, "Kopi")).toThrow("PROVIDER_RESPONSE_INVALID");
    expect(() => normalizeSearchApiRegionalInterest({}, "Kopi")).toThrow("PROVIDER_RESPONSE_INVALID");
  });
});
