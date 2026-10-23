import { describe, expect, it } from "vitest";

import type { BrightDataGoogleTrendsCandidate } from "./brightdata-google-trends";
import { screenFnbCandidates } from "./fnb-candidate-screening";

function candidate(
  query: string,
  overrides: Partial<BrightDataGoogleTrendsCandidate> = {},
): BrightDataGoogleTrendsCandidate {
  return {
    query,
    geo: "ID",
    volume: 100,
    volumeChange: 12,
    categories: [{ name: "synthetic category" }],
    active: true,
    startedAtUnixSeconds: 1_760_000_000,
    relatedQueries: ["synthetic related query"],
    provenance: {
      provider: "BRIGHTDATA",
      zone: "venturex_trends_serp",
      sourceName: "Google Trends Trending Now",
      sourceUrl:
        "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
      retrievedAt: "2026-10-11T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("screenFnbCandidates", () => {
  it("marks direct Indonesian F&B terms as likely and explains the match", () => {
    const [result] = screenFnbCandidates([candidate("KOPI—SUSU GULA AREN")]);

    expect(result).toMatchObject({
      normalizedQuery: "kopi susu gula aren",
      classification: "LIKELY_FNB",
      explanation: expect.stringContaining("bukan validasi faktual"),
    });
    expect(result?.matchedKeywords).toContain("kopi");
  });

  it("sends ambiguous terms to manual review", () => {
    const [result] = screenFnbCandidates([
      candidate("menu viral untuk protein"),
    ]);

    expect(result).toMatchObject({
      classification: "REVIEW_REQUIRED",
      explanation: expect.stringContaining("tinjauan manual"),
    });
    expect(result?.matchedKeywords).toEqual(["menu", "viral", "protein"]);
  });

  it("recognizes common Indonesian food names", () => {
    const [result] = screenFnbCandidates([candidate("Tahu Sumedang")]);

    expect(result?.classification).toBe("LIKELY_FNB");
    expect(result?.matchedKeywords).toContain("tahu");
  });

  it("marks candidates without F&B indicators out of scope", () => {
    const [result] = screenFnbCandidates([candidate("sepeda listrik")]);

    expect(result).toMatchObject({
      classification: "OUT_OF_SCOPE",
      matchedKeywords: [],
    });
  });

  it("uses token boundaries to avoid substring matches", () => {
    const [result] = screenFnbCandidates([candidate("mengopiang")]);

    expect(result?.classification).toBe("OUT_OF_SCOPE");
  });

  it("groups equivalent queries from the same region and event timestamp", () => {
    const first = candidate("Kopi Susu", { volume: 120 });
    const duplicate = candidate(" kopi   susu ", {
      volume: 240,
      volumeChange: "+20%",
      relatedQueries: ["kopi susu kekinian"],
    });

    const [result] = screenFnbCandidates([first, duplicate]);

    expect(result).toMatchObject({
      query: "Kopi Susu",
      normalizedQuery: "kopi susu",
      classification: "LIKELY_FNB",
    });
    expect(result?.observations).toEqual([first, duplicate]);
    expect(result?.observations.map((item) => item.geo)).toEqual(["ID", "ID"]);
    expect(
      result?.observations.map((item) => item.startedAtUnixSeconds),
    ).toEqual([1_760_000_000, 1_760_000_000]);
    expect(result?.observations.map((item) => item.volume)).toEqual([120, 240]);
    expect(result?.observations[1]?.volumeChange).toBe("+20%");
    expect(result?.observations[1]?.relatedQueries).toEqual([
      "kopi susu kekinian",
    ]);
  });

  it("keeps equivalent queries with different event timestamps in separate groups", () => {
    const firstEvent = candidate("Kopi Susu", {
      volume: 120,
      startedAtUnixSeconds: 1_760_000_000,
    });
    const nextEvent = candidate(" kopi   susu ", {
      volume: 240,
      volumeChange: "+20%",
      startedAtUnixSeconds: 1_760_000_060,
    });

    const results = screenFnbCandidates([firstEvent, nextEvent]);

    expect(results).toHaveLength(2);
    expect(results.map((item) => item.normalizedQuery)).toEqual([
      "kopi susu",
      "kopi susu",
    ]);
    expect(results.map((item) => item.observations)).toEqual([
      [firstEvent],
      [nextEvent],
    ]);
    expect(
      results.map((item) => item.observations[0]?.startedAtUnixSeconds),
    ).toEqual([1_760_000_000, 1_760_000_060]);
    expect(results.map((item) => item.observations[0]?.volume)).toEqual([
      120,
      240,
    ]);
  });

  it("keeps output order stable and preserves provenance on each observation", () => {
    const inputs = [
      candidate("sate ayam"),
      candidate("sepeda listrik"),
      candidate("teh hangat"),
    ];

    const results = screenFnbCandidates(inputs);

    expect(results.map((item) => item.query)).toEqual([
      "sate ayam",
      "sepeda listrik",
      "teh hangat",
    ]);
    expect(results.map((item) => item.classification)).toEqual([
      "LIKELY_FNB",
      "OUT_OF_SCOPE",
      "REVIEW_REQUIRED",
    ]);
    expect(results[0]?.observations[0]?.provenance.sourceUrl).toContain(
      "trending?geo=ID",
    );
  });
});
