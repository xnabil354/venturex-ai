import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseCuratedCatalogManifest } from "./catalog-manifest";
import {
  prepareGenericTrendManifest,
  type GenericTrendManifestPreparationInput,
} from "./generic-trend-manifest";

const trendId = "10000000-0000-4000-8000-000000000001";
const evidenceIdA = "10000000-0000-4000-8000-000000000002";
const evidenceIdB = "10000000-0000-4000-8000-000000000003";

// These are synthetic schema fixtures. They do not represent real sources,
// market observations, or captured provider responses.
function fixture(
  evidenceMode: "EXTERNAL_SOURCE_CLAIM" | "SYNTHETIC_FIXTURE" = "SYNTHETIC_FIXTURE",
): GenericTrendManifestPreparationInput {
  return {
    manifestType: "VENTUREX_GENERIC_TREND_PREPARATION",
    manifestVersion: 1,
    manifestId: "test-only-generalized-trend-manifest",
    evidenceMode,
    trends: [
      {
        id: trendId,
        title: "Synthetic test trend",
        categoryCode: "CONSUMER_BEHAVIOR",
        subjectAreaCode: null,
        signal: {
          summary: "Synthetic summary for schema testing.",
          summaryEvidenceIds: [evidenceIdA],
          description: "Synthetic description for schema testing.",
          descriptionEvidenceIds: [evidenceIdA, evidenceIdB],
          direction: "RISING",
          directionEvidenceIds: [evidenceIdA],
          observationPeriod: {
            requiredForCuration: true,
            start: "2025-01-01",
            end: "2025-01-31",
            evidenceIds: [evidenceIdB],
          },
          metrics: [
            {
              name: "Synthetic metric",
              rawValue: "0017.250",
              unit: "source-reported test units",
              evidenceId: evidenceIdB,
              limitation: "Synthetic schema fixture only.",
            },
          ],
          unavailableFields: ["commercial demand"],
        },
        evidence: [
          {
            id: evidenceIdA,
            sourceName: "Synthetic source A",
            sourceReference: "https://source-a.example/test-claim",
            providerName: "Synthetic provider fixture",
            sourceDate: null,
            retrievalTimestamp: "2026-10-13T00:00:00.000Z",
            supportingDetail: "Synthetic fixture text; no real source was checked.",
            limitations: ["Synthetic fixture only; no factual verification."],
          },
          {
            id: evidenceIdB,
            sourceName: "Synthetic source B",
            sourceReference: "https://source-b.example/test-methodology",
            providerName: null,
            sourceDate: "2025-01-15",
            retrievalTimestamp: null,
            supportingDetail: "Synthetic fixture text; no real source was checked.",
            limitations: ["Synthetic fixture only; no factual verification."],
          },
        ],
        businessRelevanceExplanation: null,
        affectedUserTypes: ["ENTREPRENEUR", "UMKM_EXISTING"],
        factualReview: {
          decision: "PENDING",
          reviewerIdentity: null,
          reviewedAt: null,
          evidenceLimitations: ["Synthetic fixture only; no reviewer action occurred."],
        },
      },
    ],
  };
}

function supportedExternalShapeFixture() {
  const input = fixture("EXTERNAL_SOURCE_CLAIM");
  input.trends[0]!.factualReview = {
    decision: "SUPPORTED",
    reviewerIdentity: "Fixture identity; not authenticated",
    reviewedAt: "2026-10-13T00:00:00.000Z",
    evidenceLimitations: ["Synthetic test fixture; no actual source was reviewed."],
  };
  return input;
}

const historicalManifestPath = path.join(
  process.cwd(),
  "data/catalog/curated-fnb-2025-candidates.v1.json",
);

describe("generic curated Trend manifest preparation", () => {
  it("keeps a candidate without evidence incomplete and not importable", () => {
    const input = fixture();
    input.trends[0]!.evidence = [];

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("INCOMPLETE");
    expect(result.importReadiness.status).toBe("NOT_READY_FOR_IMPORT");
    expect(result.issues.some(({ path: issuePath }) => issuePath === "trends.0.evidence")).toBe(true);
  });

  it("keeps a required but unavailable observation period incomplete", () => {
    const input = fixture();
    input.trends[0]!.signal.observationPeriod.start = null;
    input.trends[0]!.signal.observationPeriod.end = null;
    input.trends[0]!.signal.observationPeriod.evidenceIds = [];

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("INCOMPLETE");
    expect(result.issues.some(({ code }) => code === "REQUIRED_OBSERVATION_PERIOD_UNAVAILABLE")).toBe(true);
  });

  it("accepts explicit evidence shape while keeping source, factual, and publication decisions unverified", () => {
    const result = prepareGenericTrendManifest(supportedExternalShapeFixture());

    expect(result.structuralStatus).toBe("READY_FOR_HUMAN_REVIEW");
    expect(result.sourceAuthority).toBe("NOT_VERIFIED_BY_PREPARATION_TOOL");
    expect(result.factualVerification).toBe("NOT_VERIFIED_BY_PREPARATION_TOOL");
    expect(result.factualReviewIdentityAssurance).toBe("SELF_ATTESTED_NOT_AUTHENTICATED");
    expect(result.publicationApproval).toBe("NOT_REQUESTED");
    expect(result.importReadiness.status).toBe("NOT_READY_FOR_IMPORT");
    expect(result.importReadiness.reasons).not.toContain("FACTUAL_REVIEW_READINESS_NOT_ESTABLISHED");
    expect(result.importReadiness.reasons).not.toContain("GENERIC_MANIFEST_STRUCTURE_INCOMPLETE");
    expect(result.importReadiness.reasons).toContain(
      "Source authority and factual claims remain unverified by this preparation tool, even when a review decision is self-attested as SUPPORTED.",
    );
    expect(result.importReadiness.reasons).toContain(
      "The lifecycle CLI and audit binding are restricted to the existing approved manifest. Generic import and lifecycle support need separate review.",
    );
  });

  it("allows an explicitly unknown period only when it is not required", () => {
    const input = fixture("EXTERNAL_SOURCE_CLAIM");
    const period = input.trends[0]!.signal.observationPeriod;
    period.requiredForCuration = false;
    period.start = null;
    period.end = null;
    period.evidenceIds = [];

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("READY_FOR_HUMAN_REVIEW");
    expect(result.manifest?.trends[0]?.signal.observationPeriod).toEqual({
      requiredForCuration: false,
      start: null,
      end: null,
      evidenceIds: [],
    });
    expect(result.importReadiness.status).toBe("NOT_READY_FOR_IMPORT");
  });

  it("rejects a known period without evidence and all signal claims without linked evidence", () => {
    const input = fixture();
    input.trends[0]!.signal.observationPeriod.evidenceIds = [];
    input.trends[0]!.signal.summaryEvidenceIds = ["10000000-0000-4000-8000-000000000099"];

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("INCOMPLETE");
    expect(result.issues.map(({ code }) => code)).toContain("KNOWN_OBSERVATION_PERIOD_REQUIRES_SUPPORTING_EVIDENCE");
    expect(result.issues.map(({ code }) => code)).toContain("SUMMARY_EVIDENCE_REFERENCE_NOT_FOUND");
  });

  it("rejects direction claims without valid supporting evidence", () => {
    const input = fixture();
    input.trends[0]!.signal.directionEvidenceIds = ["10000000-0000-4000-8000-000000000099"];

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("INCOMPLETE");
    expect(result.issues.map(({ code }) => code)).toContain("DIRECTION_EVIDENCE_REFERENCE_NOT_FOUND");
  });

  it("preserves supplied metric text, units, and explicit unknown-unit limitations", () => {
    const input = fixture();
    input.trends[0]!.signal.metrics[0]!.unit = null;
    input.trends[0]!.signal.metrics[0]!.limitation = "The source unit is unavailable in this synthetic fixture.";

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("READY_FOR_HUMAN_REVIEW");
    expect(result.manifest?.trends[0]?.signal.metrics[0]).toEqual({
      name: "Synthetic metric",
      rawValue: "0017.250",
      unit: null,
      evidenceId: evidenceIdB,
      limitation: "The source unit is unavailable in this synthetic fixture.",
    });
    expect(result.manifest?.trends[0]?.evidence[0]?.providerName).toBe("Synthetic provider fixture");
  });

  it("rejects missing limitations for unknown units and unsafe numeric integers", () => {
    const missingLimitation = fixture();
    missingLimitation.trends[0]!.signal.metrics[0]!.unit = null;
    missingLimitation.trends[0]!.signal.metrics[0]!.limitation = null;
    const missingLimitationResult = prepareGenericTrendManifest(missingLimitation);

    const unsafeNumber = fixture();
    unsafeNumber.trends[0]!.signal.metrics[0]!.rawValue = 9007199254740992;
    const unsafeNumberResult = prepareGenericTrendManifest(unsafeNumber);

    expect(missingLimitationResult.structuralStatus).toBe("INCOMPLETE");
    expect(missingLimitationResult.issues.map(({ code }) => code)).toContain("UNKNOWN_METRIC_UNIT_REQUIRES_LIMITATION");
    expect(unsafeNumberResult.structuralStatus).toBe("INCOMPLETE");
    expect(unsafeNumberResult.issues.map(({ code }) => code)).toContain("NUMERIC_METRIC_INTEGER_MUST_BE_SAFE");
  });

  it("rejects non-HTTPS references and references with embedded credentials", () => {
    const insecureReference = fixture();
    insecureReference.trends[0]!.evidence[0]!.sourceReference = "http://source.example/claim";
    const credentialReference = fixture();
    credentialReference.trends[0]!.evidence[0]!.sourceReference = "https://user:password@source.example/claim";

    expect(prepareGenericTrendManifest(insecureReference).structuralStatus).toBe("INCOMPLETE");
    expect(prepareGenericTrendManifest(credentialReference).structuralStatus).toBe("INCOMPLETE");
  });

  it("does not allow synthetic fixtures to claim a factual review", () => {
    const input = fixture("SYNTHETIC_FIXTURE");
    input.trends[0]!.factualReview = {
      decision: "SUPPORTED",
      reviewerIdentity: "Synthetic reviewer",
      reviewedAt: "2026-10-13T00:00:00.000Z",
      evidenceLimitations: ["Synthetic input cannot establish facts."],
    };

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("INCOMPLETE");
    expect(result.importReadiness.reasons).toContain(
      "SYNTHETIC_FIXTURE_CANNOT_BE_IMPORTED_AS_PRODUCTION_EVIDENCE",
    );
    expect(result.issues.map(({ code }) => code)).toContain(
      "SYNTHETIC_FIXTURE_CANNOT_HAVE_SUPPORTED_FACTUAL_REVIEW",
    );
  });

  it("reports a prior factual rejection without presenting it as review-ready", () => {
    const input = fixture("EXTERNAL_SOURCE_CLAIM");
    input.trends[0]!.factualReview = {
      decision: "REJECTED",
      reviewerIdentity: "Fixture identity; not authenticated",
      reviewedAt: "2026-10-13T00:00:00.000Z",
      evidenceLimitations: ["Synthetic test fixture; no actual source was reviewed."],
    };

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("FACTUAL_REVIEW_REJECTED");
    expect(result.importReadiness.reasons).toContain("FACTUAL_REVIEW_REJECTED");
    expect(result.importReadiness.status).toBe("NOT_READY_FOR_IMPORT");
  });

  it("does not expose submitted field values in sanitized validation issues", () => {
    const input = fixture();
    input.trends[0]!.title = "private-invalid-title";
    input.trends[0]!.evidence[0]!.sourceReference = "http://private-invalid-source.example";

    const result = prepareGenericTrendManifest(input);

    expect(result.structuralStatus).toBe("INCOMPLETE");
    expect(JSON.stringify(result.issues)).not.toContain("private-invalid");
  });

  it("preserves historical manifest bytes and the existing v1 validation contract", () => {
    const manifestBytes = readFileSync(historicalManifestPath);
    const digest = createHash("sha256").update(manifestBytes).digest("hex").toUpperCase();
    const historicalManifest = JSON.parse(manifestBytes.toString("utf8")) as unknown;

    expect([
      "EBFADE3A6371DD95D5A78C10327EE8C9EFE1A86093650924EE9ADE135E077A85",
      "719E3193C5313A8F090409E096BE9A5F69C3D059F60DD4E51DF0FD7AA6C9E185",
    ]).toContain(digest);
    expect(parseCuratedCatalogManifest(historicalManifest).trends).toHaveLength(2);
    expect(parseCuratedCatalogManifest(historicalManifest).opportunities).toHaveLength(4);
  });
});
