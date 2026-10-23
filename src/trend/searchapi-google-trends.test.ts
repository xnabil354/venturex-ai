import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  normalizeSearchApiRelatedQueries,
  readSearchApiConfig,
  SearchApiGoogleTrendsAdapter,
  SearchApiTrendsError,
  type SearchApiConfig,
  type SearchApiConfigResult,
} from "./searchapi-google-trends";

const config: SearchApiConfig = {
  apiKey: "unit-test-searchapi-key",
  baseUrl: "https://www.searchapi.io/api/v1/search",
  timeoutMs: 5_000,
  relatedQueriesTimeoutMs: 30_000,
  geoMapTimeoutMs: 25_000,
  enabled: true,
  timezoneOffsetMinutes: -420,
  category: 0,
  shortCacheTtlMs: 60_000,
  longCacheTtlMs: 300_000,
  maxRequestsPerDay: 10,
};
const enabled: SearchApiConfigResult = { enabled: true, config };
const providerPayload = {
  related_queries: {
    top: [
      { position: 1, query: "kopi susu", values: "100", extracted_value: 100, link: "https://trends.google.com/trends/explore?q=kopi" },
      { position: 2, query: "es kopi", values: "42", extracted_value: 42 },
      { position: 3, values: "20", extracted_value: 20 },
    ],
    rising: [
      { position: 1, query: "kopi gula aren", values: "Breakout", extracted_value: 45000, link: "https://trends.google.com/trends/explore?q=aren" },
      { position: 2, query: "kopi literan", values: "+250%", extracted_value: 250 },
    ],
  },
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("SearchApi Google Trends adapter", () => {
  it("returns and caches successful insufficient-data responses independently for all three datasets", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({
      search_metadata: { status: "Success", id: "search_no_data" },
      error: "Your search doesn't have enough data to show here",
    }));
    const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, fetcher);
    const request = { period: "24h", property: "web", geo: "ID" } as const;
    const related = await adapter.relatedQueries("ayam geprek carbonara", request);
    expect(related).toMatchObject({ top: [], rising: [], cacheStatus: "NETWORK", providerDiagnostics: { httpStatus: 200, searchStatus: "Success", rawCounts: { top: 0, rising: 0 } } });
    expect(await adapter.interestOverTime("ayam geprek carbonara", request)).toMatchObject({ points: [], averageInterest: null });
    expect(await adapter.interestByRegion("ayam geprek carbonara", request)).toMatchObject({ regions: [] });
    expect(await adapter.relatedQueries("ayam geprek carbonara", request)).toMatchObject({ cacheStatus: "HIT" });
    expect(await adapter.interestOverTime("ayam geprek carbonara", request)).toMatchObject({ cacheStatus: "HIT" });
    expect(await adapter.interestByRegion("ayam geprek carbonara", request)).toMatchObject({ cacheStatus: "HIT" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("keeps unknown provider errors and unsuccessful no-data envelopes as failures", async () => {
    for (const payload of [
      { search_metadata: { status: "Success" }, error: "Unexpected upstream failure" },
      { search_metadata: { status: "Error" }, error: "Your search doesn't have enough data to show here" },
      { error: "Your search doesn't have enough data to show here" },
    ]) {
      const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, vi.fn<typeof fetch>(async () => response(payload)));
      const request = { period: "24h", property: "web", geo: "ID" } as const;
      await expect(adapter.relatedQueries("ayam geprek carbonara", request)).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_INVALID" });
      await expect(adapter.interestOverTime("ayam geprek carbonara", request)).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_INVALID" });
      await expect(adapter.interestByRegion("ayam geprek carbonara", request)).rejects.toMatchObject({ code: "PROVIDER_RESPONSE_INVALID" });
    }
  });
  it("uses a canonical local Maps query and partitions its cache by province", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({ local_results: [{ title: "Bakso A", address: "Kota Jkt. Utara", place_id: "a" }] }));
    const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, fetcher);
    const first = await adapter.localCompetitors("bakso", "Kota Administrasi Jakarta Utara", "DKI Jakarta");
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.searchParams.get("engine")).toBe("google_maps");
    expect(url.searchParams.get("q")).toBe("bakso Jakarta Utara, DKI Jakarta, Indonesia");
    expect(first.sampleCount).toBe(1);
    await adapter.localCompetitors("bakso", "Kota Administrasi Jakarta Utara", "DKI Jakarta");
    expect(fetcher).toHaveBeenCalledOnce();
    await adapter.localCompetitors("bakso", "Kota Administrasi Jakarta Utara", "Other province");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  beforeEach(() => vi.restoreAllMocks());

  it("normalizes Top and Rising rows, preserves Breakout semantics, and omits malformed rows", () => {
    expect(normalizeSearchApiRelatedQueries(providerPayload)).toEqual({
      top: [
        { position: 1, query: "kopi susu", interestIndex: 100, sourceUrl: "https://trends.google.com/trends/explore?q=kopi" },
        { position: 2, query: "es kopi", interestIndex: 42, sourceUrl: null },
      ],
      rising: [
        { position: 1, query: "kopi gula aren", growthLabel: "Breakout", growthPercent: null, isBreakout: true, sourceUrl: "https://trends.google.com/trends/explore?q=aren" },
        { position: 2, query: "kopi literan", growthLabel: "+250%", growthPercent: 250, isBreakout: false, sourceUrl: null },
      ],
      omittedInvalidRows: { top: 1, rising: 0 },
    });
  });

  it("treats missing arrays or malformed provider JSON as invalid, while accepting empty arrays", () => {
    expect(() => normalizeSearchApiRelatedQueries({ related_queries: { top: [] } })).toThrow(SearchApiTrendsError);
    expect(normalizeSearchApiRelatedQueries({ related_queries: { top: [], rising: [] } }).top).toEqual([]);
  });

  it("does not print or expose credentials and validates the enabled configuration", () => {
    expect(readSearchApiConfig({ TREND_RADAR_SEARCHAPI_ENABLED: "false" })).toEqual({ enabled: false });
    expect(readSearchApiConfig({
      TREND_RADAR_SEARCHAPI_ENABLED: "true",
      SEARCHAPI_API_KEY: "secret-test-key",
    })).toMatchObject({ enabled: true, config: { baseUrl: config.baseUrl, timezoneOffsetMinutes: -420, category: 0 } });
    expect(() => readSearchApiConfig({
      TREND_RADAR_SEARCHAPI_ENABLED: "true",
      SEARCHAPI_API_KEY: "secret-test-key",
      SEARCHAPI_BASE_URL: "https://attacker.example/api",
    })).toThrow(SearchApiTrendsError);
    expect(readSearchApiConfig({
      TREND_RADAR_SEARCHAPI_ENABLED: "true",
      SEARCHAPI_API_KEY: "secret-test-key",
      SEARCHAPI_BASE_URL: "https://www.searchapi.io/api/v1/",
    })).toMatchObject({ enabled: true, config: { baseUrl: config.baseUrl } });
    expect(() => readSearchApiConfig({
      TREND_RADAR_SEARCHAPI_ENABLED: "true",
      SEARCHAPI_API_KEY: "",
    })).toThrow(SearchApiTrendsError);
  });

  it("sends the approved provider parameters and keeps the bearer key out of the URL", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({
      ...providerPayload,
      search_metadata: { id: "safe-provider-request", status: "Success" },
    }));
    const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, fetcher, () => new Date("2026-10-17T12:00:00.000Z"));
    const result = await adapter.relatedQueries("Kopi", { period: "24h", property: "web" });
    const [input, init] = fetcher.mock.calls[0]!;
    const url = new URL(String(input));

    expect(url.origin + url.pathname).toBe(config.baseUrl);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      engine: "google_trends",
      data_type: "RELATED_QUERIES",
      q: "Kopi",
      geo: "",
      cat: "0",
      tz: "-420",
      time: "now 1-d",
    });
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer " + config.apiKey);
    expect(url.search).not.toContain(config.apiKey);
    expect(result.cacheStatus).toBe("NETWORK");
    expect(result.time).toBe("now 1-d");
    expect(result.providerDiagnostics).toMatchObject({
      httpStatus: 200,
      searchStatus: "Success",
      requestId: "safe-provider-request",
      rawCounts: { top: 3, rising: 2 },
    });
    expect(result.providerDiagnostics.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("requests TIMESERIES and GEO_MAP with shared filters, exact region granularity, and independent cached entries", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      return url.searchParams.get("data_type") === "TIMESERIES"
        ? response({ interest_over_time: { averages: [{ query: "Kopi", value: "30", extracted_value: 30 }], timeline_data: [{ date: "Oct 18, 2026", timestamp: "1792353600", values: [{ query: "Kopi", value: "30", extracted_value: 30 }] }] } })
        : response({ interest_by_region: [{ geo: "US-CA", name: "California", values: [{ query: "Kopi", value: "30", extracted_value: 30 }] }] });
    });
    const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, fetcher, () => new Date("2026-10-17T12:00:00.000Z"));
    const request = { period: "24h" as const, property: "images" as const, geo: "US-CA" };
    const [timeSeries, regional] = await Promise.all([
      adapter.interestOverTime("Kopi", request, "now 1-d"),
      adapter.interestByRegion("Kopi", request, "now 1-d"),
    ]);

    expect(timeSeries.points).toEqual([{ timestamp: 1792353600, label: "Oct 18, 2026", interestIndex: 30 }]);
    expect(regional.regions[0]).toMatchObject({ geoCode: "US-CA", name: "California", interestIndex: 30 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const parameters = fetcher.mock.calls.map(([input]) => Object.fromEntries(new URL(String(input)).searchParams));
    expect(parameters).toEqual(expect.arrayContaining([
      { engine: "google_trends", data_type: "TIMESERIES", q: "Kopi", geo: "US-CA", cat: "0", tz: "-420", time: "now 1-d", gprop: "images" },
      { engine: "google_trends", data_type: "GEO_MAP", q: "Kopi", geo: "US-CA", cat: "0", tz: "-420", time: "now 1-d", region: "REGION", gprop: "images" },
    ]));
    expect((await adapter.interestOverTime("Kopi", request, "now 1-d")).cacheStatus).toBe("HIT");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("sends a selected international geography through each provider request", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({ related_queries: { top: [], rising: [] } }));
    const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, fetcher);
    await adapter.relatedQueries("Kopi", { period: "24h", property: "web", geo: "US-CA" });

    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get("geo")).toBe("US-CA");
  });

  it("keeps SearchApi cache entries separate for different geographies", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({ related_queries: { top: [], rising: [] } }));
    const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, fetcher);

    await adapter.relatedQueries("Kopi", { period: "24h", property: "web", geo: "US" });
    await adapter.relatedQueries("Kopi", { period: "24h", property: "web", geo: "SG" });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("geo"))).toEqual(["US", "SG"]);
  });

  it.each([
    ["web", undefined],
    ["images", "images"],
    ["news", "news"],
    ["shopping", "froogle"],
    ["youtube", "youtube"],
  ] as const)("maps provider property %s", async (property, gprop) => {
    const fetcher = vi.fn<typeof fetch>(async () => response({ related_queries: { top: [], rising: [] } }));
    const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, fetcher);
    await adapter.relatedQueries("Kopi", { period: "24h", property });
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.searchParams.get("gprop") ?? undefined).toBe(gprop);
  });

  it("uses in-process cache, coalesces duplicates, and enforces its daily request budget without retries", async () => {
    const limited = { ...config, maxRequestsPerDay: 1 };
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    const adapter = new SearchApiGoogleTrendsAdapter(() => ({ enabled: true, config: limited }), fetcher);
    const firstRequest = adapter.relatedQueries("Kopi", { period: "24h", property: "web" });
    const concurrentRequest = adapter.relatedQueries("Kopi", { period: "24h", property: "web" });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    resolveFetch!(response({ related_queries: { top: [], rising: [] } }));
    const [first, concurrent] = await Promise.all([firstRequest, concurrentRequest]);
    expect(first.cacheStatus).toBe("NETWORK");
    expect(concurrent.cacheStatus).toBe("COALESCED");
    expect((await adapter.relatedQueries("Kopi", { period: "24h", property: "web" })).cacheStatus).toBe("HIT");
    await expect(adapter.relatedQueries("Teh", { period: "24h", property: "web" })).rejects.toMatchObject({ code: "REQUEST_BUDGET_EXCEEDED" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    [429, "PROVIDER_RATE_LIMITED"],
    [402, "PROVIDER_QUOTA_EXCEEDED"],
  ] as const)("maps provider status %s without retry", async (status, code) => {
    const fetcher = vi.fn<typeof fetch>(async () => response({}, status));
    const adapter = new SearchApiGoogleTrendsAdapter(() => enabled, fetcher);
    await expect(adapter.relatedQueries("Kopi", { period: "24h", property: "web" })).rejects.toMatchObject({ code, upstreamStatus: status });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("maps timeout and invalid JSON into safe provider errors", async () => {
    const timeout = Object.assign(new Error("synthetic timeout"), { name: "TimeoutError" });
    const timeoutFetch = vi.fn<typeof fetch>(async () => { throw timeout; });
    await expect(new SearchApiGoogleTrendsAdapter(() => enabled, timeoutFetch).relatedQueries("Kopi", { period: "24h", property: "web" }))
      .rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });

    const invalidFetch = vi.fn<typeof fetch>(async () => new Response("{", { status: 200 }));
    await expect(new SearchApiGoogleTrendsAdapter(() => enabled, invalidFetch).relatedQueries("Kopi", { period: "24h", property: "web" }))
      .rejects.toMatchObject({ code: "PROVIDER_RESPONSE_INVALID" });
  });

  it("applies the same safe timeout, rate-limit, and invalid-response handling to interest datasets", async () => {
    const timeout = Object.assign(new Error("synthetic timeout"), { name: "TimeoutError" });
    const timeoutFetch = vi.fn<typeof fetch>(async () => { throw timeout; });
    await expect(new SearchApiGoogleTrendsAdapter(() => enabled, timeoutFetch).interestOverTime("Kopi", { period: "24h", property: "web" }))
      .rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });

    const limitedFetch = vi.fn<typeof fetch>(async () => response({}, 429));
    await expect(new SearchApiGoogleTrendsAdapter(() => enabled, limitedFetch).interestByRegion("Kopi", { period: "24h", property: "web" }))
      .rejects.toMatchObject({ code: "PROVIDER_RATE_LIMITED" });

    const invalidFetch = vi.fn<typeof fetch>(async () => response({ interest_by_region: "not-an-array" }));
    await expect(new SearchApiGoogleTrendsAdapter(() => enabled, invalidFetch).interestByRegion("Kopi", { period: "24h", property: "web" }))
      .rejects.toMatchObject({ code: "PROVIDER_RESPONSE_INVALID" });
  });
});
