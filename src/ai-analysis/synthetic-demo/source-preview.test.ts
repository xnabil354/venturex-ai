import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BrightDataProviderError,
  type BrightDataResponseDiagnostic,
  type BrightDataScreenedCandidateBatch,
} from "@/trend/brightdata-google-trends";

import { BRIGHTDATA_DEMO_LIVE_AUTHORIZED_FLAG, BRIGHTDATA_DEMO_PRECHECK_CONFIRMED_FLAG, buildBrightDataDemoPreviewSummary, createBrightDataDemoSourcePreview } from "./source-preview";
import { brightDataDemoSourcePreviewSchema } from "./source-preview-contract";
import { SYNTHETIC_DEMO_ENABLE_FLAG, SYNTHETIC_DEMO_LAUNCHER_FLAG, SYNTHETIC_DEMO_PORT_FLAG } from "./access";

const enabledEnvironment = {
  NODE_ENV: "development",
  [SYNTHETIC_DEMO_ENABLE_FLAG]: "true",
  [SYNTHETIC_DEMO_LAUNCHER_FLAG]: "127.0.0.1",
  [SYNTHETIC_DEMO_PORT_FLAG]: "3016",
  [BRIGHTDATA_DEMO_LIVE_AUTHORIZED_FLAG]: "true",
  [BRIGHTDATA_DEMO_PRECHECK_CONFIRMED_FLAG]: "true",
  BRIGHTDATA_TRENDS_ENABLED: "true",
  BRIGHTDATA_TRENDS_API_KEY: "synthetic-test-key",
} as const;

const diagnostic: BrightDataResponseDiagnostic = {
  httpStatus: 200,
  contentType: "application/json",
  responseBytes: 240,
  rootType: "array",
  arrayLength: 2,
  topLevelFields: [{ name: "root", type: "array" }],
  firstRecordFields: [{ name: "query", type: "string" }, { name: "volume", type: "number" }],
  validationIssues: [{ path: [1, "related_queries"], code: "invalid_type" }],
};

const screenedBatch = {
  status: "PARTIAL",
  candidates: [{
    query: "teh tarik\u202E <b>uji</b>",
    classification: "LIKELY_FNB",
    observations: [{
      query: "teh tarik\u202E <b>uji</b>",
      geo: "ID",
      volume: 7654321,
      volumeChange: "+55%",
      categories: ["synthetic-category"],
      active: true,
      startedAtUnixSeconds: 1_760_435_400,
      relatedQueries: { availability: "UNAVAILABLE", reason: "MISSING_FROM_PROVIDER_RESPONSE" },
      provenance: {
        provider: "BRIGHTDATA",
        zone: "venturex_trends_serp",
        sourceName: "Google Trends Trending Now",
        sourceUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
        retrievedAt: "2026-10-14T10:30:00.000Z",
      },
    }],
  }],
  totalRecords: 2,
  acceptedRecords: 1,
  rejectedRecords: 1,
  fieldAvailability: {
    relatedQueries: { available: 1, unavailable: 0, invalid: 1, uninspectable: 0 },
  },
  rejectionReasons: { RELATED_QUERIES_NULL: 1 },
  screenedRecords: 1,
  screeningSummary: {
    inputRecords: 2,
    acceptedParsedRecords: 1,
    rejectedParsedRecords: 1,
    uniqueScreenedGroups: 1,
    classifications: { LIKELY_FNB: 1, REVIEW_REQUIRED: 0, OUT_OF_SCOPE: 0 },
  },
} as unknown as BrightDataScreenedCandidateBatch;

function oneAttemptBudget() {
  let consumed = false;
  return {
    consume: vi.fn(() => {
      if (consumed) return false;
      consumed = true;
      return true;
    }),
  };
}

describe("local Bright Data source preview", () => {
  it("summarizes a synthetic provider fixture without classifying it as live output", () => {
    const summary = buildBrightDataDemoPreviewSummary(
      screenedBatch,
      diagnostic,
      "2026-10-14T10:30:00.000Z",
    );

    expect(summary).toMatchObject({
      completeness: "PARTIAL",
      retrievedAt: "2026-10-14T10:30:00.000Z",
      response: {
        httpStatus: 200,
        contentType: "application/json",
        responseBytes: 240,
        rootType: "array",
        validationIssues: [{ path: [1, "related_queries"], code: "invalid_type" }],
      },
      records: {
        total: 2,
        accepted: 1,
        rejected: 1,
        classifications: { LIKELY_FNB: 1, REVIEW_REQUIRED: 0, OUT_OF_SCOPE: 0 },
        candidates: [{
          title: "teh tarik <b>uji</b>",
          classification: "LIKELY_FNB",
          observationCount: 1,
          active: true,
          startedAtUnixSeconds: 1_760_435_400,
          volume: 7654321,
          volumeChange: "+55%",
          categoriesCount: 1,
          relatedQueries: { availability: "UNAVAILABLE", count: null },
          displayTruncated: false,
        }],
        omittedCandidates: 0,
      },
      displayLimit: { content: "PRIVATE_LOOPBACK_PREVIEW" },
      observationPeriod: { status: "UNAVAILABLE" },
    });
    expect(summary).not.toHaveProperty("mode");
    expect(JSON.stringify(summary)).not.toContain("\u202E");
    expect(summary.records.candidates[0]?.title).toBe("teh tarik <b>uji</b>");
    expect(brightDataDemoSourcePreviewSchema.safeParse({
      ...summary,
      mode: "MOCK_VERIFIED",
      attempted: false,
      notice: "TEST DATA sintetis; bukan respons Bright Data.",
    }).success).toBe(true);
  });

  it("does not construct a provider or consume the one-request budget when disabled", async () => {
    const createProvider = vi.fn();
    const budget = oneAttemptBudget();
    const result = await createBrightDataDemoSourcePreview({
      env: { ...enabledEnvironment, BRIGHTDATA_TRENDS_ENABLED: "false" },
      budget,
      createProvider,
    });

    expect(result).toMatchObject({ mode: "NOT_EXECUTED", attempted: false, reason: "CONFIGURATION_NOT_READY" });
    expect(createProvider).not.toHaveBeenCalled();
    expect(budget.consume).not.toHaveBeenCalled();
  });

  it("requires the explicit operational precheck before constructing the provider", async () => {
    const createProvider = vi.fn();
    const result = await createBrightDataDemoSourcePreview({
      env: { ...enabledEnvironment, [BRIGHTDATA_DEMO_PRECHECK_CONFIRMED_FLAG]: "false" },
      createProvider,
    });

    expect(result).toMatchObject({ mode: "NOT_EXECUTED", attempted: false, reason: "PRECHECK_NOT_CONFIRMED" });
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("consumes the attempt on failure and refuses subsequent provider calls", async () => {
    const budget = oneAttemptBudget();
    const providerCall = vi.fn().mockRejectedValue(new BrightDataProviderError("TIMEOUT"));
    const options = {
      env: enabledEnvironment,
      budget,
      createProvider: () => ({ collectAndScreenCandidateBatch: providerCall }),
    };

    await expect(createBrightDataDemoSourcePreview(options)).resolves.toMatchObject({
      mode: "BLOCKED",
      attempted: true,
      reason: "PROVIDER_TIMEOUT",
    });
    await expect(createBrightDataDemoSourcePreview(options)).resolves.toMatchObject({
      mode: "BLOCKED",
      attempted: false,
      reason: "REQUEST_BUDGET_EXHAUSTED",
    });
    expect(providerCall).toHaveBeenCalledTimes(1);
    expect(budget.consume).toHaveBeenCalledTimes(2);
  });
});
