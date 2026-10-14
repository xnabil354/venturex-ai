import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BrightDataGoogleTrendsProvider,
} from "./brightdata-google-trends";
import {
  createCandidatePreviewReport,
  formatCandidatePreviewReport,
  MAX_CANDIDATE_PREVIEW_TITLES,
} from "./candidate-preview";

const FIXED_RETRIEVAL_TIME = new Date("2026-10-13T03:00:00.000Z");
const syntheticFixture = JSON.parse(
  readFileSync(
    new URL(
      "../../scripts/trend/fixtures/brightdata-candidate-preview.synthetic.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as unknown[];

function validRecord(
  query: string,
  startedAt: number,
  relatedQueries: string[] = [],
): Record<string, unknown> {
  return {
    query,
    geo: "ID",
    volume: null,
    volume_change: null,
    categories: [],
    active: true,
    started_at: startedAt,
    related_queries: relatedQueries,
  };
}

function createProvider(records: unknown[]) {
  const fetcher = vi.fn(async () =>
    new Response(JSON.stringify(records), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  const provider = new BrightDataGoogleTrendsProvider({
    environment: {
      BRIGHTDATA_TRENDS_ENABLED: "true",
      BRIGHTDATA_TRENDS_API_KEY: "synthetic-test-key",
    },
    fetcher,
    now: () => FIXED_RETRIEVAL_TIME,
  });
  return { provider, fetcher };
}

describe("Bright Data candidate preview report", () => {
  it("reports partial parsing, field availability, deduplicated screening groups, and all classifications", async () => {
    const { provider, fetcher } = createProvider(syntheticFixture);
    const batch = await provider.collectAndScreenCandidateBatch();
    const report = createCandidatePreviewReport(batch, {
      mode: "OFFLINE_SYNTHETIC",
      generatedAt: FIXED_RETRIEVAL_TIME.toISOString(),
      retrievedAt: FIXED_RETRIEVAL_TIME.toISOString(),
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(batch).toMatchObject({
      status: "PARTIAL",
      totalRecords: 5,
      acceptedRecords: 4,
      rejectedRecords: 1,
      fieldAvailability: {
        relatedQueries: {
          available: 3,
          unavailable: 1,
          invalid: 1,
          uninspectable: 0,
        },
      },
      screeningSummary: {
        inputRecords: 5,
        acceptedParsedRecords: 4,
        rejectedParsedRecords: 1,
        uniqueScreenedGroups: 3,
        classifications: {
          LIKELY_FNB: 1,
          REVIEW_REQUIRED: 1,
          OUT_OF_SCOPE: 1,
        },
      },
    });
    expect(report).toMatchObject({
      mode: "OFFLINE_SYNTHETIC",
      source: expect.stringContaining("Synthetic fixture"),
      retrievedAt: null,
      providerRequests: 0,
      status: "PARTIAL",
      records: { retrieved: 5, accepted: 4, rejected: 1 },
    });
    expect(report.titles.map((candidate) => candidate.title)).toEqual([
      "kopi susu",
      "matcha",
      "pemilu 2024",
    ]);
    expect(report.titles.every(({ candidateId }) => /^gtrends-[a-f0-9]{64}$/u.test(candidateId))).toBe(true);
    expect(formatCandidatePreviewReport(report)).toContain("candidate-id=gtrends-");
  });

  it("treats a present empty related_queries array as available data", async () => {
    const { provider } = createProvider([validRecord("kopi susu", 1, [])]);
    const batch = await provider.collectAndScreenCandidateBatch();
    const report = createCandidatePreviewReport(batch, {
      mode: "LIVE_PROVIDER",
      generatedAt: "2026-10-13T03:01:00.000Z",
      retrievedAt: FIXED_RETRIEVAL_TIME.toISOString(),
    });

    expect(batch.status).toBe("COMPLETE");
    expect(report.relatedQueriesAvailability).toEqual({
      available: 1,
      unavailable: 0,
      invalid: 0,
      uninspectable: 0,
    });
    expect(report).toMatchObject({
      source: "Google Trends Trending Now (Indonesia) via Bright Data SERP API",
      retrievedAt: "2026-10-13T03:00:00.000Z",
      providerRequests: 1,
    });
  });

  it("represents an empty provider batch without inventing candidates", async () => {
    const { provider, fetcher } = createProvider([]);
    const batch = await provider.collectAndScreenCandidateBatch();
    const report = createCandidatePreviewReport(batch, {
      mode: "OFFLINE_SYNTHETIC",
      generatedAt: FIXED_RETRIEVAL_TIME.toISOString(),
      retrievedAt: FIXED_RETRIEVAL_TIME.toISOString(),
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(batch).toMatchObject({
      status: "COMPLETE",
      totalRecords: 0,
      acceptedRecords: 0,
      rejectedRecords: 0,
      screeningSummary: {
        uniqueScreenedGroups: 0,
        classifications: {
          LIKELY_FNB: 0,
          REVIEW_REQUIRED: 0,
          OUT_OF_SCOPE: 0,
        },
      },
    });
    expect(report.titles).toEqual([]);
    expect(formatCandidatePreviewReport(report)).toContain(
      "No accepted candidate groups.",
    );
  });

  it("fails closed when a non-empty response has zero valid records", async () => {
    const { provider, fetcher } = createProvider([
      { ...validRecord("kopi susu", 1), related_queries: null },
    ]);

    await expect(provider.collectAndScreenCandidateBatch()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("strips terminal controls and caps titles and list size", async () => {
    const records = Array.from({ length: MAX_CANDIDATE_PREVIEW_TITLES + 2 }, (_, index) =>
      validRecord(
        index === 0 ? "\u001b[31mPemilu\u001b[0m\r\n2024" : `politik ${index}`,
        index + 1,
      ),
    );
    const { provider } = createProvider(records);
    const batch = await provider.collectAndScreenCandidateBatch();
    const report = createCandidatePreviewReport(batch, {
      mode: "OFFLINE_SYNTHETIC",
      generatedAt: FIXED_RETRIEVAL_TIME.toISOString(),
      retrievedAt: FIXED_RETRIEVAL_TIME.toISOString(),
    });
    const output = formatCandidatePreviewReport(report);

    expect(report.titles).toHaveLength(MAX_CANDIDATE_PREVIEW_TITLES);
    expect(report.omittedTitles).toBe(2);
    expect(output).toContain("[OUT_OF_SCOPE] Pemilu 2024");
    expect(report.titles[0]?.title).toBe("Pemilu 2024");
    expect(output).not.toContain("\u001b");
    expect(output).not.toContain("\r");
    expect(output).toContain("deterministic keyword heuristic, not factual validation");
  });
});
