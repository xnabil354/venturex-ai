import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BrightDataConfigurationError,
  BrightDataGoogleTrendsProvider,
  BrightDataProviderError,
  BRIGHTDATA_TRENDS_ENDPOINT,
  GOOGLE_TRENDS_INDONESIA_TARGET,
  parseBrightDataTrendsConfig,
} from "./brightdata-google-trends";

const TEST_API_KEY = "synthetic-test-api-key";
const FIXED_DATE = new Date("2026-10-11T00:00:00.000Z");

const syntheticRecord = {
  query: "kopi susu gula aren",
  geo: "ID",
  volume: 1200,
  volume_change: "+35%",
  categories: [{ id: 71, name: "Food & Drink" }],
  active: true,
  started_at: 1_760_000_000,
  related_queries: ["es kopi susu", "kopi aren"],
};

function enabledEnvironment(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    BRIGHTDATA_TRENDS_ENABLED: "true",
    BRIGHTDATA_TRENDS_API_KEY: TEST_API_KEY,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("parseBrightDataTrendsConfig", () => {
  it("defaults to disabled without requiring an API key", () => {
    expect(parseBrightDataTrendsConfig({})).toMatchObject({
      enabled: false,
      timeoutMs: 10_000,
      zone: "venturex_trends_serp",
    });
  });

  it("requires a key when enabled and reports only the variable name", () => {
    expect(() =>
      parseBrightDataTrendsConfig({
        BRIGHTDATA_TRENDS_ENABLED: "true",
      }),
    ).toThrow(BrightDataConfigurationError);

    try {
      parseBrightDataTrendsConfig({
        BRIGHTDATA_TRENDS_ENABLED: "true",
      });
    } catch (error) {
      expect(String(error)).toContain("BRIGHTDATA_TRENDS_API_KEY");
      expect(String(error)).not.toContain(TEST_API_KEY);
    }
  });

  it("rejects invalid enabled values and timeout bounds without echoing values", () => {
    for (const timeout of ["249", "30001", "not-a-number"]) {
      expect(() =>
        parseBrightDataTrendsConfig(
          enabledEnvironment({ BRIGHTDATA_TRENDS_TIMEOUT_MS: timeout }),
        ),
      ).toThrow(BrightDataConfigurationError);
    }

    expect(() =>
      parseBrightDataTrendsConfig(
        enabledEnvironment({ BRIGHTDATA_TRENDS_ENABLED: "yes" }),
      ),
    ).toThrow(BrightDataConfigurationError);
  });
});

describe("BrightDataGoogleTrendsProvider", () => {
  it("does not call fetch while disabled", async () => {
    const fetcher = vi.fn<typeof fetch>();

    const provider = new BrightDataGoogleTrendsProvider({
      environment: {},
      fetcher,
    });

    await expect(provider.collectCandidates()).rejects.toMatchObject({
      code: "DISABLED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends one authenticated request and normalizes a synthetic array response", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse([syntheticRecord]));
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
      now: () => FIXED_DATE,
    });

    const candidates = await provider.collectCandidates();

    expect(fetcher).toHaveBeenCalledOnce();
    const call = fetcher.mock.calls[0];
    expect(call?.[0]).toBe(BRIGHTDATA_TRENDS_ENDPOINT);
    const init = call?.[1];
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer " + TEST_API_KEY,
    );
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({
      zone: "venturex_trends_serp",
      url: GOOGLE_TRENDS_INDONESIA_TARGET,
      format: "raw",
    });

    expect(candidates).toEqual([
      {
        query: syntheticRecord.query,
        geo: "ID",
        volume: 1200,
        volumeChange: "+35%",
        categories: syntheticRecord.categories,
        active: true,
        startedAtUnixSeconds: 1_760_000_000,
        relatedQueries: syntheticRecord.related_queries,
        provenance: {
          provider: "BRIGHTDATA",
          zone: "venturex_trends_serp",
          sourceName: "Google Trends Trending Now",
          sourceUrl: GOOGLE_TRENDS_INDONESIA_TARGET,
          retrievedAt: FIXED_DATE.toISOString(),
        },
      },
    ]);
  });

  it("collects and screens candidates without changing provider observations", async () => {
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([syntheticRecord]),
      ),
      now: () => FIXED_DATE,
    });

    const candidates = await provider.collectAndScreenCandidates();

    expect(candidates).toMatchObject([
      {
        query: "kopi susu gula aren",
        classification: "LIKELY_FNB",
        observations: [
          {
            volume: 1200,
            volumeChange: "+35%",
            startedAtUnixSeconds: 1_760_000_000,
          },
        ],
      },
    ]);
  });

  it("returns an empty collection for a valid empty top-level array", async () => {
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () => jsonResponse([])),
    });

    await expect(provider.collectCandidates()).resolves.toEqual([]);
  });

  it("fails closed on a non-success response without exposing its body or retrying", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response("synthetic upstream detail", { status: 402 }),
    );
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
    });

    const result = provider.collectCandidates();
    await expect(result).rejects.toBeInstanceOf(BrightDataProviderError);
    await expect(result).rejects.toMatchObject({
      code: "UPSTREAM_ERROR",
      statusCode: 402,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    await expect(result).rejects.not.toThrow(TEST_API_KEY);
    await expect(result).rejects.not.toThrow("synthetic upstream detail");
  });

  it("maps a timeout to a controlled error and does not retry", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new DOMException("synthetic timeout detail", "TimeoutError");
    });
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
    });

    await expect(provider.collectCandidates()).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("maps network errors to a safe error without retrying", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error(TEST_API_KEY);
    });
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
    });

    const result = provider.collectCandidates();
    await expect(result).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(result).rejects.not.toThrow(TEST_API_KEY);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects invalid JSON and provider records with the wrong shape", async () => {
    const invalidJsonProvider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(
        async () => new Response("not-json", { status: 200 }),
      ),
    });
    await expect(invalidJsonProvider.collectCandidates()).rejects.toMatchObject({
      code: "INVALID_JSON",
    });

    const invalidRecordProvider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([{ ...syntheticRecord, geo: "US" }]),
      ),
    });
    await expect(invalidRecordProvider.collectCandidates()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });

    const missingFieldProvider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([{ ...syntheticRecord, related_queries: undefined }]),
      ),
    });
    await expect(missingFieldProvider.collectCandidates()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("requires categories and related queries to be arrays of observed item types", async () => {
    const malformedRecords = [
      { ...syntheticRecord, categories: { id: 71, name: "Food & Drink" } },
      { ...syntheticRecord, related_queries: "es kopi susu" },
      { ...syntheticRecord, related_queries: ["es kopi susu", 42] },
    ];

    for (const record of malformedRecords) {
      const provider = new BrightDataGoogleTrendsProvider({
        environment: enabledEnvironment(),
        fetcher: vi.fn<typeof fetch>(async () => jsonResponse([record])),
      });

      await expect(provider.collectCandidates()).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    }
  });

  it("preserves opaque category items and string related-query arrays", async () => {
    const category = { providerDefinedValue: ["opaque"] };
    const relatedQueries = ["es kopi susu", "kopi aren"];
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([
          {
            ...syntheticRecord,
            categories: [category],
            related_queries: relatedQueries,
          },
        ]),
      ),
    });

    const [candidate] = await provider.collectCandidates();

    expect(candidate?.categories).toEqual([category]);
    expect(candidate?.relatedQueries).toEqual(relatedQueries);
  });

  it("rejects an oversized response", async () => {
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(
        async () => new Response("x".repeat(1_000_001), { status: 200 }),
      ),
    });

    await expect(provider.collectCandidates()).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
    });
  });
});
