import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { screenFnbCandidates } from "./fnb-candidate-screening";
import type { BrightDataGoogleTrendsBatchCandidate, BrightDataScreenedCandidateBatch } from "./brightdata-google-trends";
import { getTrendAnalysisAvailability, LiveSignalsError, LiveTrendSignalsService } from "./live-signals";

const baseEnvironment = {
  NODE_ENV: "test",
  BRIGHTDATA_TRENDS_DISPLAY_RIGHTS_CONFIRMED: "true",
  VENTUREX_TRENDS_LIVE_PREVIEW_ENABLED: "true",
  BRIGHTDATA_TRENDS_ENABLED: "true",
  BRIGHTDATA_TRENDS_API_KEY: "not-a-real-key",
  NINEROUTER_BRIGHTDATA_PROCESSING_CONFIRMED: "true",
  AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED: "true",
  AI_PROVIDER: "ninerouter",
  NINEROUTER_BASE_URL: "https://router.example.test/v1",
  NINEROUTER_API_KEY: "not-a-real-key",
  NINEROUTER_MODEL: "cx/gpt-6-luna-xhigh",
};

function observation(query: string, startedAtUnixSeconds = 1_765_000_000): BrightDataGoogleTrendsBatchCandidate {
  return {
    query,
    geo: "ID",
    volume: "2K+",
    volumeChange: "+350%",
    categories: ["provided-category"],
    active: true,
    startedAtUnixSeconds,
    relatedQueries: { availability: "AVAILABLE", values: [] },
    provenance: {
      provider: "BRIGHTDATA",
      zone: "venturex_trends_serp",
      sourceName: "Google Trends Trending Now",
      sourceUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
      retrievedAt: "2026-10-14T04:00:00.000Z",
    },
  };
}

function batch(): BrightDataScreenedCandidateBatch {
  const candidates = screenFnbCandidates([
    observation("kopi susu"),
    observation("matcha"),
    observation("pertandingan sepak bola"),
  ]);
  return {
    status: "PARTIAL",
    candidates,
    screenedRecords: candidates.length,
    totalRecords: 3,
    acceptedRecords: 3,
    rejectedRecords: 0,
    fieldAvailability: { relatedQueries: { available: 3, unavailable: 0, invalid: 0, uninspectable: 0 } },
    rejectionReasons: {},
    screeningSummary: {
      inputRecords: 3,
      acceptedParsedRecords: 3,
      rejectedParsedRecords: 0,
      uniqueScreenedGroups: 3,
      classifications: { LIKELY_FNB: 1, REVIEW_REQUIRED: 1, OUT_OF_SCOPE: 1 },
    },
  };
}

function service(options: ConstructorParameters<typeof LiveTrendSignalsService>[0] = {}) {
  const ids = [
    "80000000-0000-4000-8000-000000000001",
    "80000000-0000-4000-8000-000000000002",
    "80000000-0000-4000-8000-000000000003",
    "80000000-0000-4000-8000-000000000004",
  ];
  let index = 0;
  return new LiveTrendSignalsService({
    environment: baseEnvironment,
    createProvider: () => ({ collectAndScreenCandidateBatch: async () => batch() }),
    now: () => new Date("2026-10-14T04:01:00.000Z"),
    id: () => ids[index++] ?? "80000000-0000-4000-8000-000000000099",
    ...options,
  });
}

describe("LiveTrendSignalsService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps actual provider values, attribution, unknown period and heuristic labels explicit", async () => {
    const provider = { collectAndScreenCandidateBatch: vi.fn(async () => batch()) };
    const instance = service({ createProvider: () => provider });
    const result = await instance.refresh("user-a");

    expect(provider.collectAndScreenCandidateBatch).toHaveBeenCalledOnce();
    expect(result.mode).toBe("LIVE_PROVIDER");
    expect(result.cache).toBe("NETWORK");
    expect(result.batchStatus).toBe("PARTIAL");
    expect(result.screening.classifications).toEqual({ LIKELY_FNB: 1, REVIEW_REQUIRED: 1, OUT_OF_SCOPE: 1 });
    expect(result.signals).toHaveLength(2);
    expect(result.signals[0]).toMatchObject({
      title: "kopi susu",
      classification: "LIKELY_FNB",
      source: { publisher: "Google Trends", geo: "ID", timeWindowHours: 24 },
      metrics: { volume: { value: "2K+", unit: "UNSPECIFIED" }, volumeChange: { value: "+350%", unit: "UNSPECIFIED" } },
    });
    expect(result.signals[1]?.classification).toBe("REVIEW_REQUIRED");
    expect(JSON.stringify(result.signals)).not.toContain("pertandingan sepak bola");
  });

  it("blocks display while rights are unverified before any provider request", async () => {
    const provider = { collectAndScreenCandidateBatch: vi.fn(async () => batch()) };
    const instance = service({
      environment: { ...baseEnvironment, BRIGHTDATA_TRENDS_DISPLAY_RIGHTS_CONFIRMED: "false" },
      createProvider: () => provider,
    });
    await expect(instance.refresh("user-a")).rejects.toMatchObject({ code: "DISPLAY_RIGHTS_UNVERIFIED" });
    expect(provider.collectAndScreenCandidateBatch).not.toHaveBeenCalled();
  });

  it("coalesces simultaneous refreshes and then serves cached data without another provider request", async () => {
    let release: ((value: BrightDataScreenedCandidateBatch) => void) | undefined;
    const promise = new Promise<BrightDataScreenedCandidateBatch>((resolve) => { release = resolve; });
    const provider = { collectAndScreenCandidateBatch: vi.fn(() => promise) };
    const instance = service({ createProvider: () => provider });
    const firstPromise = instance.refresh("user-a");
    const secondPromise = instance.refresh("user-b");
    release?.(batch());
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(provider.collectAndScreenCandidateBatch).toHaveBeenCalledOnce();
    expect(first.cache).toBe("NETWORK");
    expect(second.cache).toBe("COALESCED");
    expect(first.snapshotId).not.toBe(second.snapshotId);
    expect(await instance.refresh("user-c")).toMatchObject({ cache: "CACHE", freshness: "CURRENT" });
    expect(provider.collectAndScreenCandidateBatch).toHaveBeenCalledOnce();
  });

  it("requests and caches each supported Trending Now time window independently", async () => {
    let now = new Date("2026-10-14T04:01:00.000Z");
    const provider = { collectAndScreenCandidateBatch: vi.fn(async () => batch()) };
    const instance = service({ createProvider: () => provider, now: () => now });

    const recent = await instance.refresh("user-a", 24);
    now = new Date(now.getTime() + 60_001);
    const week = await instance.refresh("user-a", 168);
    const cachedWeek = await instance.refresh("user-a", 168);

    expect(provider.collectAndScreenCandidateBatch).toHaveBeenNthCalledWith(1, { hours: 24 });
    expect(provider.collectAndScreenCandidateBatch).toHaveBeenNthCalledWith(2, { hours: 168 });
    expect(provider.collectAndScreenCandidateBatch).toHaveBeenCalledTimes(2);
    expect(recent.source).toMatchObject({ timeWindowHours: 24 });
    expect(week.source).toMatchObject({ timeWindowHours: 168, url: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1&hours=168" });
    expect(week.signals[0]?.source.timeWindowHours).toBe(168);
    expect(cachedWeek.cache).toBe("CACHE");
  });

  it("keeps snapshot resolution bound to the authenticated user and opaque IDs", async () => {
    const instance = service();
    const response = await instance.refresh("owner");
    const signalId = response.signals[0]?.id;
    expect(signalId).toBeTruthy();
    expect(instance.resolve("owner", response.snapshotId, signalId!)).toMatchObject({ snapshotId: response.snapshotId });
    expect(() => instance.resolve("other-user", response.snapshotId, signalId!)).toThrow(LiveSignalsError);
    expect(() => instance.resolve("owner", response.snapshotId, "90000000-0000-4000-8000-000000000001")).toThrow(LiveSignalsError);
  });

  it("keeps Trend inference blocked until feature, source processing, and secure provider configuration are available", () => {
    expect(getTrendAnalysisAvailability({
      ...baseEnvironment,
      AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED: "false",
    })).toEqual({ status: "BLOCKED", reason: "AI_FEATURE_DISABLED" });
    expect(getTrendAnalysisAvailability({
      ...baseEnvironment,
      NINEROUTER_BRIGHTDATA_PROCESSING_CONFIRMED: "false",
    })).toEqual({ status: "BLOCKED", reason: "SOURCE_PROCESSING_NOT_APPROVED" });
    expect(getTrendAnalysisAvailability({
      ...baseEnvironment,
      NINEROUTER_BASE_URL: "http://72.62.247.63:20128/v1",
    })).toEqual({ status: "BLOCKED", reason: "AI_PROVIDER_CONFIGURATION_UNAVAILABLE" });
  });
});
