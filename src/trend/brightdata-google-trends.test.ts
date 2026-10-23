import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BrightDataConfigurationError,
  BrightDataGoogleTrendsProvider,
  BrightDataProviderError,
  BRIGHTDATA_TRENDS_ENDPOINT,
  GOOGLE_TRENDS_INDONESIA_TARGET,
  buildGoogleTrendsTrendingNowTarget,
  parseBrightDataTrendsConfig,
  type BrightDataScreenedCandidateBatch,
  type BrightDataResponseDiagnostic,
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
  it.each([4, 24, 48, 168] as const)("builds a supported Google Trends Trending Now URL for %i hours", (hours) => {
    expect(buildGoogleTrendsTrendingNowTarget(hours)).toBe(
      `${GOOGLE_TRENDS_INDONESIA_TARGET}&hours=${hours}`,
    );
  });

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

  it("passes a supported time window through to the source URL and provenance", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => jsonResponse([syntheticRecord]));
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
      now: () => FIXED_DATE,
    });

    const batch = await provider.collectCandidateBatch({ hours: 168 });

    const requestBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as { url: string };
    expect(requestBody.url).toBe(`${GOOGLE_TRENDS_INDONESIA_TARGET}&hours=168`);
    expect(batch.candidates[0]?.provenance.sourceUrl).toBe(requestBody.url);
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
    await expect(provider.collectCandidateBatch()).resolves.toMatchObject({
      status: "COMPLETE",
      candidates: [],
      totalRecords: 0,
      acceptedRecords: 0,
      rejectedRecords: 0,
      fieldAvailability: {
        relatedQueries: {
          available: 0,
          unavailable: 0,
          invalid: 0,
          uninspectable: 0,
        },
      },
    });
  });

  it("marks a fully valid nonempty batch complete without changing row order", async () => {
    const secondRecord = { ...syntheticRecord, query: "matcha latte" };
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([syntheticRecord, secondRecord]),
      ),
    });

    const batch = await provider.collectCandidateBatch();

    expect(batch).toMatchObject({
      status: "COMPLETE",
      totalRecords: 2,
      acceptedRecords: 2,
      rejectedRecords: 0,
      fieldAvailability: {
        relatedQueries: {
          available: 2,
          unavailable: 0,
          invalid: 0,
          uninspectable: 0,
        },
      },
    });
    expect(batch.candidates.map(({ query }) => query)).toEqual([
      syntheticRecord.query,
      secondRecord.query,
    ]);
  });

  it("accepts missing auxiliary queries as unavailable and rejects malformed query fields", async () => {
    const records: unknown[] = [
      syntheticRecord,
      { ...syntheticRecord, query: "missing related queries", related_queries: undefined },
      { ...syntheticRecord, query: "null related queries", related_queries: null },
      { ...syntheticRecord, query: "string related queries", related_queries: "kopi" },
      { ...syntheticRecord, query: "number related queries", related_queries: 7 },
      { ...syntheticRecord, query: "boolean related queries", related_queries: false },
      { ...syntheticRecord, query: "object related queries", related_queries: { term: "kopi" } },
      { ...syntheticRecord, query: "invalid array member", related_queries: ["kopi", 7] },
    ];
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () => jsonResponse(records)),
      now: () => FIXED_DATE,
    });

    const batch = await provider.collectCandidateBatch();

    expect(batch).toMatchObject({
      status: "PARTIAL",
      totalRecords: 8,
      acceptedRecords: 2,
      rejectedRecords: 6,
      rejectionReasons: {
        RELATED_QUERIES_NULL: 1,
        RELATED_QUERIES_STRING: 1,
        RELATED_QUERIES_NUMBER: 1,
        RELATED_QUERIES_BOOLEAN: 1,
        RELATED_QUERIES_OBJECT: 1,
        RELATED_QUERIES_ARRAY_ITEM_TYPE: 1,
      },
      fieldAvailability: {
        relatedQueries: {
          available: 1,
          unavailable: 1,
          invalid: 6,
          uninspectable: 0,
        },
      },
    });
    expect(batch.candidates.map(({ query }) => query)).toEqual([
      syntheticRecord.query,
      "missing related queries",
    ]);
    expect(batch.candidates[1]?.relatedQueries).toEqual({
      availability: "UNAVAILABLE",
      reason: "MISSING_FROM_PROVIDER_RESPONSE",
    });
  });

  it("distinguishes a present empty related-query array from an absent field", async () => {
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([{ ...syntheticRecord, related_queries: [] }]),
      ),
      now: () => FIXED_DATE,
    });

    const batch = await provider.collectCandidateBatch();

    expect(batch.status).toBe("COMPLETE");
    expect(batch.candidates).toHaveLength(1);
    expect(batch.candidates[0]?.relatedQueries).toEqual({
      availability: "AVAILABLE",
      values: [],
    });
    expect(batch.fieldAvailability.relatedQueries).toEqual({
      available: 1,
      unavailable: 0,
      invalid: 0,
      uninspectable: 0,
    });
  });

  it("keeps the legacy array API fail-closed when the separate batch API can report partial results", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([
        { ...syntheticRecord, query: "missing related queries", related_queries: undefined },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { ...syntheticRecord, query: "missing related queries", related_queries: undefined },
      ]));
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
    });

    await expect(provider.collectCandidateBatch()).resolves.toMatchObject({
      status: "PARTIAL",
      acceptedRecords: 1,
      rejectedRecords: 0,
      fieldAvailability: {
        relatedQueries: { available: 0, unavailable: 1, invalid: 0, uninspectable: 0 },
      },
    });
    await expect(provider.collectCandidates()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a row has another schema error alongside related-query errors", async () => {
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([
          syntheticRecord,
          { ...syntheticRecord, geo: "US", related_queries: null },
        ]),
      ),
    });

    await expect(provider.collectCandidateBatch()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("fails closed when every nonempty response row is rejected", async () => {
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([
          { ...syntheticRecord, related_queries: null },
          { ...syntheticRecord, related_queries: ["bad", 1] },
        ]),
      ),
    });

    await expect(provider.collectCandidateBatch()).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("keeps screening status visible and screens only records accepted by the parser", async () => {
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([
          syntheticRecord,
          {
            ...syntheticRecord,
            query: "world news headline",
            related_queries: [],
          },
          { ...syntheticRecord, query: "rejected row", related_queries: null },
        ]),
      ),
    });

    const batch = await provider.collectAndScreenCandidateBatch();

    expect(batch).toMatchObject({
      status: "PARTIAL",
      totalRecords: 3,
      acceptedRecords: 2,
      rejectedRecords: 1,
      screenedRecords: 2,
      screeningSummary: {
        inputRecords: 3,
        acceptedParsedRecords: 2,
        rejectedParsedRecords: 1,
        uniqueScreenedGroups: 2,
        classifications: {
          LIKELY_FNB: 1,
          REVIEW_REQUIRED: 0,
          OUT_OF_SCOPE: 1,
        },
      },
      rejectionReasons: { RELATED_QUERIES_NULL: 1 },
    });
    expect(batch.candidates.map((candidate) => candidate.query)).toEqual([
      syntheticRecord.query,
      "world news headline",
    ]);
  });

  it("reports unique screening groups and every heuristic classification", async () => {
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () =>
        jsonResponse([
          { ...syntheticRecord, query: "Kopi Susu" },
          {
            ...syntheticRecord,
            query: " kopi   susu ",
            related_queries: undefined,
            volume: "1.2K",
          },
          { ...syntheticRecord, query: "matcha" },
          { ...syntheticRecord, query: "sepeda listrik" },
          { ...syntheticRecord, query: "invalid", related_queries: null },
        ]),
      ),
    });

    const batch = await provider.collectAndScreenCandidateBatch();

    expect(batch).toMatchObject({
      status: "PARTIAL",
      totalRecords: 5,
      acceptedRecords: 4,
      rejectedRecords: 1,
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
    expect(batch.candidates).toHaveLength(3);
    expect(batch.candidates[0]?.observations[1]?.relatedQueries).toEqual({
      availability: "UNAVAILABLE",
      reason: "MISSING_FROM_PROVIDER_RESPONSE",
    });
    expect(batch.candidates[0]?.observations[1]?.volume).toBe("1.2K");
    expect(
      batch.candidates.map(({ classification }) => classification),
    ).toEqual(["LIKELY_FNB", "REVIEW_REQUIRED", "OUT_OF_SCOPE"]);
  });

  it("accepts records with additional provider fields without changing supported metric values", async () => {
    const providerOnlyField = "synthetic-private-provider-value";
    const record = {
      ...syntheticRecord,
      volume: "1.2K",
      volume_change: null,
      provider_only: providerOnlyField,
    };
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () => jsonResponse([record])),
    });

    const [candidate] = (await provider.collectCandidateBatch()).candidates;

    expect(candidate).toMatchObject({
      volume: "1.2K",
      volumeChange: null,
      relatedQueries: {
        availability: "AVAILABLE",
        values: syntheticRecord.related_queries,
      },
    });
    expect(JSON.stringify(candidate)).not.toContain(providerOnlyField);
  });

  it("reports bounded aggregate diagnostics for more than twenty malformed rows without values", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const onDevelopmentDiagnostic = vi.fn<
      (diagnostic: BrightDataResponseDiagnostic) => void
    >();
    const rows = [
      syntheticRecord,
      ...Array.from({ length: 24 }, (_, index) => ({
        ...syntheticRecord,
        query: "private synthetic query " + index,
        related_queries: ["valid member", index],
      })),
    ];
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () => jsonResponse(rows)),
      onDevelopmentDiagnostic,
    });

    try {
      const batch = await provider.collectCandidateBatch();
      expect(batch).toMatchObject({
        status: "PARTIAL",
        totalRecords: 25,
        acceptedRecords: 1,
        rejectedRecords: 24,
      });
      const diagnostic = onDevelopmentDiagnostic.mock.calls[0]?.[0];
      expect(diagnostic).toMatchObject({
        totalRecords: 25,
        acceptedRecords: 1,
        rejectedRecords: 24,
        invalidRelatedQueryArrayItems: 24,
        totalSchemaIssueCount: 24,
        rejectionReasons: { RELATED_QUERIES_ARRAY_ITEM_TYPE: 24 },
      });
      expect(diagnostic?.validationIssues).toHaveLength(20);
      const serialized = JSON.stringify(diagnostic);
      expect(serialized).not.toContain("private synthetic query");
      expect(serialized).not.toContain(TEST_API_KEY);
    } finally {
      vi.unstubAllEnvs();
    }
  }, 25_000);

  it("reports related-query field types and invalid item counts without payload values", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const onDevelopmentDiagnostic = vi.fn<
      (diagnostic: BrightDataResponseDiagnostic) => void
    >();
    const rows: unknown[] = [
      syntheticRecord,
      { ...syntheticRecord, query: "missing", related_queries: undefined },
      { ...syntheticRecord, query: "null", related_queries: null },
      { ...syntheticRecord, query: "string", related_queries: "private query text" },
      { ...syntheticRecord, query: "number", related_queries: 17 },
      { ...syntheticRecord, query: "boolean", related_queries: true },
      { ...syntheticRecord, query: "object", related_queries: { private: "value" } },
      { ...syntheticRecord, query: "array with bad item", related_queries: ["ok", 8] },
    ];
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () => jsonResponse(rows)),
      onDevelopmentDiagnostic,
    });

    try {
      const batch = await provider.collectCandidateBatch();
      const diagnostic = onDevelopmentDiagnostic.mock.calls[0]?.[0];

      expect(batch.status).toBe("PARTIAL");
      expect(diagnostic).toMatchObject({
        totalRecords: 8,
        acceptedRecords: 2,
        rejectedRecords: 6,
        relatedQueriesTypes: {
          missing: 1,
          null: 1,
          string: 1,
          number: 1,
          boolean: 1,
          object: 1,
          array: 2,
        },
        fieldAvailability: {
          available: 1,
          unavailable: 1,
          invalid: 6,
          uninspectable: 0,
        },
        invalidRelatedQueryArrayItems: 1,
        totalSchemaIssueCount: 6,
      });
      expect(JSON.stringify(diagnostic)).not.toContain("private query text");
      expect(JSON.stringify(diagnostic)).not.toContain("private");
      expect(JSON.stringify(diagnostic)).not.toContain(TEST_API_KEY);
    } finally {
      vi.unstubAllEnvs();
    }
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

  it("allows a response taking longer than Vitest's default timeout", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        await new Promise<Response>((resolve) => {
          setTimeout(() => resolve(jsonResponse([syntheticRecord])), 5_100);
        }),
    );
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
      now: () => FIXED_DATE,
    });

    await expect(provider.collectCandidates()).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenCalledOnce();
  }, 25_000);

  it("aborts at the adapter timeout and does not retry", async () => {
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("Expected adapter timeout signal"));
            return;
          }

          const rejectOnAbort = () =>
            reject(new DOMException("synthetic adapter timeout", "AbortError"));
          if (signal.aborted) {
            rejectOnAbort();
            return;
          }
          signal.addEventListener("abort", rejectOnAbort, { once: true });
        }),
    );
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
    });

    await expect(provider.collectCandidates()).rejects.toMatchObject({
      code: "TIMEOUT",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  }, 25_000);

  it("maps a timeout while reading the response stream and does not retry", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull() {
        throw new DOMException("synthetic body timeout", "AbortError");
      },
    });
    const fetcher = vi.fn<typeof fetch>(async () => new Response(body, { status: 200 }));
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

  it("reports only bounded shape metadata for an invalid response in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const privateResponseValue = "synthetic-private-response-value";
    const onDevelopmentDiagnostic = vi.fn<
      (diagnostic: BrightDataResponseDiagnostic) => void
    >();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            ...syntheticRecord,
            query: privateResponseValue,
            geo: "US",
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({ message: privateResponseValue }),
      );
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher,
      onDevelopmentDiagnostic,
    });

    try {
      await expect(provider.collectCandidates()).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });

      expect(onDevelopmentDiagnostic).toHaveBeenCalledOnce();
      const diagnostic = onDevelopmentDiagnostic.mock.calls[0]?.[0];
      expect(diagnostic).toMatchObject({
        httpStatus: 200,
        contentType: "application/json",
        rootType: "array",
        arrayLength: 1,
      });
      expect(diagnostic?.firstRecordFields).toEqual(
        expect.arrayContaining([
          { name: "query", type: "string" },
          { name: "geo", type: "string" },
          { name: "started_at", type: "number" },
        ]),
      );
      expect(diagnostic?.validationIssues).toEqual(
        expect.arrayContaining([
          { path: [0, "geo"], code: expect.any(String) },
        ]),
      );

      const serializedDiagnostic = JSON.stringify(diagnostic);
      expect(serializedDiagnostic).not.toContain(privateResponseValue);
      expect(serializedDiagnostic).not.toContain(TEST_API_KEY);

      await expect(provider.collectCandidates()).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
      const objectDiagnostic = onDevelopmentDiagnostic.mock.calls[1]?.[0];
      expect(objectDiagnostic).toMatchObject({
        httpStatus: 200,
        rootType: "object",
      });
      expect(objectDiagnostic?.topLevelFields).toEqual([
        { name: "message", type: "string" },
      ]);
      expect(JSON.stringify(objectDiagnostic)).not.toContain(
        privateResponseValue,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reports only bounded shape metadata for a valid response in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const onDevelopmentDiagnostic = vi.fn<
      (diagnostic: BrightDataResponseDiagnostic) => void
    >();
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () => jsonResponse([syntheticRecord])),
      onDevelopmentDiagnostic,
    });

    try {
      await expect(provider.collectCandidates()).resolves.toHaveLength(1);
      expect(onDevelopmentDiagnostic).toHaveBeenCalledOnce();
      const diagnostic = onDevelopmentDiagnostic.mock.calls[0]?.[0];
      expect(diagnostic).toMatchObject({
        httpStatus: 200,
        contentType: "application/json",
        rootType: "array",
        arrayLength: 1,
      });
      expect(diagnostic?.firstRecordFields).toEqual(
        expect.arrayContaining([
          { name: "query", type: "string" },
          { name: "geo", type: "string" },
          { name: "started_at", type: "number" },
        ]),
      );
      expect(JSON.stringify(diagnostic)).not.toContain(syntheticRecord.query);
      expect(JSON.stringify(diagnostic)).not.toContain(TEST_API_KEY);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not invoke the diagnostic hook outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const onDevelopmentDiagnostic = vi.fn<
      (diagnostic: BrightDataResponseDiagnostic) => void
    >();
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () => jsonResponse({ error: "invalid" })),
      onDevelopmentDiagnostic,
    });

    try {
      await expect(provider.collectCandidates()).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
      expect(onDevelopmentDiagnostic).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
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

  it("rejects and cancels a streamed response as soon as the byte cap is exceeded", async () => {
    let pulls = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(new TextEncoder().encode("x".repeat(1_000_000)));
        } else if (pulls === 2) {
          controller.enqueue(new TextEncoder().encode("x"));
        } else {
          controller.close();
        }
      },
      cancel,
    }, { highWaterMark: 0 });
    const provider = new BrightDataGoogleTrendsProvider({
      environment: enabledEnvironment(),
      fetcher: vi.fn<typeof fetch>(async () => new Response(body, { status: 200 })),
    });

    await expect(provider.collectCandidates()).rejects.toMatchObject({
      code: "RESPONSE_TOO_LARGE",
    });
    expect(pulls).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });
});

const LIVE_DIAGNOSTIC_CONFIRMATION = "ONE_REQUEST_AUTHORIZED";
const liveDiagnosticRequested =
  process.env.BRIGHTDATA_LIVE_DIAGNOSTIC_CONFIRM ===
  LIVE_DIAGNOSTIC_CONFIRMATION;

it.skipIf(!liveDiagnosticRequested)(
  "runs one explicitly authorized, bounded Bright Data diagnostic",
  async () => {
    const apiKey = process.env.BRIGHTDATA_TRENDS_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error("Bright Data key is unavailable to the diagnostic process");
    }

    vi.stubEnv("NODE_ENV", "development");
    let fetchCount = 0;
    let diagnostic: BrightDataResponseDiagnostic | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      fetchCount += 1;
      if (fetchCount > 1) {
        throw new Error("One-request diagnostic limit exceeded");
      }

      const headers = new Headers(init?.headers);
      const requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (
        String(input) !== BRIGHTDATA_TRENDS_ENDPOINT ||
        init?.method !== "POST" ||
        !headers.get("authorization")?.startsWith("Bearer ") ||
        requestBody.zone !== "venturex_trends_serp" ||
        requestBody.url !== GOOGLE_TRENDS_INDONESIA_TARGET ||
        requestBody.format !== "raw" ||
        init?.cache !== "no-store" ||
        !(init?.signal instanceof AbortSignal)
      ) {
        throw new Error("Configured Bright Data request did not match the approved contract");
      }

      return globalThis.fetch(input, init);
    };

    const provider = new BrightDataGoogleTrendsProvider({
      environment: {
        ...process.env,
        BRIGHTDATA_TRENDS_ENABLED: "true",
        BRIGHTDATA_TRENDS_API_KEY: apiKey,
        BRIGHTDATA_TRENDS_TIMEOUT_MS: "10000",
      },
      fetcher,
      onDevelopmentDiagnostic: (safeDiagnostic) => {
        diagnostic = safeDiagnostic;
      },
    });

    let outcome: string;
    let latencyMs: number | null = null;
    let batchSummary:
      | Pick<
          BrightDataScreenedCandidateBatch,
          | "status"
          | "totalRecords"
          | "acceptedRecords"
          | "rejectedRecords"
          | "fieldAvailability"
          | "rejectionReasons"
          | "screeningSummary"
        >
      | null = null;
    const startedAt = performance.now();
    try {
      const batch = await provider.collectAndScreenCandidateBatch();
      batchSummary = {
        status: batch.status,
        totalRecords: batch.totalRecords,
        acceptedRecords: batch.acceptedRecords,
        rejectedRecords: batch.rejectedRecords,
        fieldAvailability: batch.fieldAvailability,
        rejectionReasons: batch.rejectionReasons,
        screeningSummary: batch.screeningSummary,
      };
      outcome = batch.status;
    } catch (error) {
      outcome = error instanceof BrightDataProviderError ? error.code : "HARNESS_ERROR";
    } finally {
      latencyMs = Math.round(performance.now() - startedAt);
      vi.unstubAllEnvs();
    }

    process.stdout.write(
      "BRIGHTDATA_SAFE_DIAGNOSTIC " +
        JSON.stringify({
          outcome,
          requestCount: fetchCount,
          latencyMs,
          batch: batchSummary,
          diagnostic,
        }) +
        "\n",
    );
    expect(fetchCount).toBe(1);
  },
  25_000,
);
