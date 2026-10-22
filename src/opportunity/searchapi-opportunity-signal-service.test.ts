import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SearchApiGoogleTrendsAdapter, SearchApiRelatedQueries } from "@/trend/searchapi-google-trends";
import type { TrendRadarRequest } from "@/trend/trend-radar-contract";
import { userIdSchema } from "@/auth/user-types";
import { openSearchApiOpportunityEvidence } from "./searchapi-evidence-token";
import { SearchApiOpportunitySignalService } from "./searchapi-opportunity-signal-service";

const now = new Date("2026-10-18T04:00:00.000Z");
const environment = { AUTH_SECRET: "test-auth-secret-for-opportunity-source-token" };
const userId = userIdSchema.parse("80000000-0000-4000-8000-000000000001");
const request: TrendRadarRequest = { period: "24h", property: "web", geo: "US" };

function resultWithRows(
  top: SearchApiRelatedQueries["top"],
  rising: SearchApiRelatedQueries["rising"],
  expiresAt = new Date(now.getTime() + 300_000).toISOString(),
): SearchApiRelatedQueries {
  return {
    top,
    rising,
    retrievedAt: now.toISOString(),
    expiresAt,
    time: "now 1-d",
    cacheStatus: "HIT",
    omittedInvalidRows: { top: 0, rising: 0 },
    providerDiagnostics: {
      httpStatus: 200,
      searchStatus: "Success",
      requestId: "searchapi-test-request",
      durationMs: 18,
      rawCounts: { top: top.length, rising: rising.length },
    },
  };
}

function result(expiresAt = new Date(now.getTime() + 300_000).toISOString()): SearchApiRelatedQueries {
  return resultWithRows(
    [{ position: 1, query: "soto ayam terdekat", interestIndex: 100, sourceUrl: null }],
    [{
      position: 2,
      query: "soto ayam viral",
      growthLabel: "Breakout",
      growthPercent: null,
      isBreakout: true,
      sourceUrl: "https://trends.google.com/trends/explore?q=soto+ayam",
    }],
    expiresAt,
  );
}

function service(providerResult: SearchApiRelatedQueries, env: Readonly<Record<string, string | undefined>> = environment) {
  const provider = { relatedQueries: vi.fn().mockResolvedValue(providerResult) } as unknown as SearchApiGoogleTrendsAdapter;
  const resolveProfileQuery = vi.fn().mockResolvedValue("Soto Ayam");
  return {
    instance: new SearchApiOpportunitySignalService(provider, resolveProfileQuery, env, () => now),
    provider,
    resolveProfileQuery,
  };
}

describe("SearchApi Opportunity signal service", () => {
  it("maps Top and Rising observations without conflating their metrics and issues owner-bound source references", async () => {
    const { instance, provider, resolveProfileQuery } = service(result());
    const response = await instance.listForUser(userId, "ENTREPRENEUR", request);

    expect(resolveProfileQuery).toHaveBeenCalledWith(userId, "ENTREPRENEUR");
    expect(provider.relatedQueries).toHaveBeenCalledWith("Soto Ayam", request, "now 1-d");
    expect(response.appliedFilters).toEqual({ period: "24h", time: "now 1-d", property: "web", geo: "US" });
    expect(response.top[0]).toMatchObject({ sourceType: "RELATED_QUERY_TOP", query: "soto ayam terdekat", interestIndex: 100, growthLabel: null, growthPercent: null, isBreakout: false });
    expect(response.rising[0]).toMatchObject({ sourceType: "RELATED_QUERY_RISING", query: "soto ayam viral", interestIndex: null, growthLabel: "Breakout", growthPercent: null, isBreakout: true });
    expect(response.top[0]?.url).toContain("https://trends.google.com/trends/explore?");
    expect(response.top[0]?.url).toContain("geo=US");
    expect(response.top[0]?.sourceToken).not.toContain("Soto Ayam");
    expect(openSearchApiOpportunityEvidence({ userId, token: response.top[0]!.sourceToken, env: environment, now })).toMatchObject({
      productQuery: "Soto Ayam",
      query: "soto ayam terdekat",
      sourceType: "RELATED_QUERY_TOP",
    });
    expect(openSearchApiOpportunityEvidence({
      userId: "80000000-0000-4000-8000-000000000002",
      token: response.top[0]!.sourceToken,
      env: environment,
      now,
    })).toBeNull();
  });

  it("classifies expired cache metadata instead of returning a false empty result", async () => {
    const { instance, resolveProfileQuery } = service(result(new Date(now.getTime() - 1).toISOString()));
    await expect(instance.listForUser(userId, "UMKM_EXISTING", request)).rejects.toMatchObject({ code: "CACHE_INCONSISTENT" });

    expect(resolveProfileQuery).toHaveBeenCalledWith(userId, "UMKM_EXISTING");
  });

  it.each([
    ["invalid retrieval time", { retrievedAt: "invalid" }],
    ["future retrieval time", { retrievedAt: new Date(now.getTime() + 1).toISOString() }],
    ["expiry before retrieval", { expiresAt: new Date(now.getTime() - 1).toISOString() }],
  ] as const)("classifies %s as cache inconsistency", async (_label, metadata) => {
    const providerResult = { ...result(), ...metadata };
    const { instance } = service(providerResult);
    await expect(instance.listForUser(userId, "ENTREPRENEUR", request)).rejects.toMatchObject({ code: "CACHE_INCONSISTENT" });
  });

  it.each(["PROVIDER_TIMEOUT", "PROVIDER_QUOTA_EXCEEDED"] as const)("does not convert %s into an empty result", async (code) => {
    const { instance, provider } = service(result());
    vi.mocked(provider.relatedQueries).mockRejectedValue(Object.assign(new Error(code), { code }));
    await expect(instance.listForUser(userId, "ENTREPRENEUR", request)).rejects.toMatchObject({ code });
  });

  it("reports evidence-token configuration failure instead of returning empty source options", async () => {
    const { instance } = service(result(), {});
    await expect(instance.listForUser(userId, "ENTREPRENEUR", request)).rejects.toMatchObject({ code: "CONFIGURATION_UNAVAILABLE" });
  });

  it.each([
    ["Top only", [{ position: 1, query: "soto ayam", interestIndex: 100, sourceUrl: null }], []],
    ["Rising only", [], [{ position: 1, query: "soto ayam viral", growthLabel: "+50%", growthPercent: 50, isBreakout: false, sourceUrl: null }]],
    ["both empty", [], []],
  ] as const)("preserves a valid %s provider result", async (_label, top, rising) => {
    const { instance } = service(resultWithRows(top, rising));
    const response = await instance.listForUser(userId, "ENTREPRENEUR", request);
    expect(response.top).toHaveLength(top.length);
    expect(response.rising).toHaveLength(rising.length);
  });

  it("does not present all-invalid normalized provider rows as a genuine empty response", async () => {
    const empty = resultWithRows([], []);
    const providerResult: SearchApiRelatedQueries = {
      ...empty,
      omittedInvalidRows: { top: 2, rising: 1 },
      providerDiagnostics: { ...empty.providerDiagnostics, rawCounts: { top: 2, rising: 1 } },
    };
    const { instance } = service(providerResult);
    const onDiagnostics = vi.fn();

    await expect(instance.listForUser(userId, "ENTREPRENEUR", request, onDiagnostics))
      .rejects.toMatchObject({ code: "PROVIDER_RESPONSE_INVALID" });
    expect(onDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      rawTopCount: 2,
      rawRisingCount: 1,
      normalizedTopCount: 0,
      normalizedRisingCount: 0,
      invalidTopCount: 2,
      invalidRisingCount: 1,
    }));
  });

  it("maps all 25 Top and Rising fixture rows and emits safe stage counts", async () => {
    const top = Array.from({ length: 25 }, (_, index) => ({
      position: index + 1,
      query: `soto ayam ${index + 1}`,
      interestIndex: 100 - index,
      sourceUrl: null,
    }));
    const rising = Array.from({ length: 25 }, (_, index) => ({
      position: index + 1,
      query: `soto ayam populer ${index + 1}`,
      growthLabel: "+50%",
      growthPercent: 50,
      isBreakout: false,
      sourceUrl: null,
    }));
    const { instance } = service(resultWithRows(top, rising));
    const onDiagnostics = vi.fn();
    const response = await instance.listForUser(userId, "ENTREPRENEUR", request, onDiagnostics);

    expect(response.top).toHaveLength(25);
    expect(response.rising).toHaveLength(25);
    expect(onDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      providerHttpStatus: 200,
      providerSearchStatus: "Success",
      providerRequestId: "searchapi-test-request",
      cacheStatus: "HIT",
      networkRequestOccurred: false,
      rawTopCount: 25,
      rawRisingCount: 25,
      normalizedTopCount: 25,
      normalizedRisingCount: 25,
      acceptedTopCount: 25,
      acceptedRisingCount: 25,
      rejectedTopCount: 0,
      rejectedRisingCount: 0,
      createdTokenCount: 50,
    }));
    expect(JSON.stringify(onDiagnostics.mock.calls)).not.toContain("sourceToken");
  });

  it("keeps eligible rows when one normalized provider row fails the evidence contract", async () => {
    const tooLongQuery = "s".repeat(251);
    const { instance } = service(resultWithRows([
      { position: 1, query: tooLongQuery, interestIndex: 100, sourceUrl: null },
      { position: 2, query: "soto ayam", interestIndex: 90, sourceUrl: null },
    ], []));
    const onDiagnostics = vi.fn();
    const response = await instance.listForUser(userId, "ENTREPRENEUR", request, onDiagnostics);

    expect(response.top).toHaveLength(1);
    expect(response.top[0]?.query).toBe("soto ayam");
    expect(onDiagnostics).toHaveBeenCalledWith(expect.objectContaining({
      rejectedTopCount: 1,
      rejectionReasons: [{ code: "EVIDENCE_CONTRACT_REJECTED", count: 1 }],
      createdTokenCount: 1,
    }));
  });

  it("classifies evidence-contract rejection when no normalized rows are eligible", async () => {
    const { instance } = service(resultWithRows([
      { position: 1, query: "s".repeat(251), interestIndex: 100, sourceUrl: null },
    ], []));
    await expect(instance.listForUser(userId, "ENTREPRENEUR", request)).rejects.toMatchObject({ code: "EVIDENCE_ROWS_REJECTED" });
  });

  it("uses the request's selected Google Trends property and keeps a missing provider link missing", async () => {
    const { instance, provider } = service(result());
    const selectedRequest: TrendRadarRequest = { period: "7d", property: "images", geo: "US-CA" };
    const response = await instance.listForUser(userId, "ENTREPRENEUR", selectedRequest);

    expect(provider.relatedQueries).toHaveBeenCalledWith("Soto Ayam", selectedRequest, "now 7-d");
    expect(response.top[0]).toMatchObject({ searchProperty: "images", providerSourceUrl: null });
    expect(response.top[0]?.url).toContain("gprop=images");
  });
});
