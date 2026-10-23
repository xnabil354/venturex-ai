import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { fingerprintCatalogContent, JsonlCatalogAuditLedger } from "./catalog-lifecycle";
import {
  CatalogFingerprintError,
  fingerprintCatalogContentV2,
  fingerprintCatalogContentVersioned,
  matchesCatalogFingerprint,
  resolveCatalogFingerprintVersion,
  validateCatalogFingerprintV2Snapshot,
  type CatalogFingerprintV2Snapshot,
} from "./catalog-fingerprint";
import { parseCuratedCatalogManifest } from "./catalog-manifest";
import type { TrendEvidenceProvenanceInput } from "../trend/trend-evidence-provenance.schema";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const manifest = parseCuratedCatalogManifest(
  JSON.parse(await readFile(path.join(root, "data/catalog/curated-fnb-2025-candidates.v1.json"), "utf8")),
);
const temporaryDirectories: string[] = [];

function createV1Snapshot(trendIndex = 0) {
  const trend = manifest.trends[trendIndex]!;
  return {
    trend: {
      id: trend.id,
      title: trend.title,
      categoryCode: trend.categoryCode,
      subjectAreaCode: trend.subjectAreaCode,
      signalSummary: trend.signal.summary,
      signalDescription: trend.signal.description,
      direction: trend.signal.direction,
      periodStart: trend.signal.periodStart,
      periodEnd: trend.signal.periodEnd,
      businessRelevanceExplanation: trend.businessRelevanceExplanation,
      affectedUserTypes: [...trend.affectedUserTypes],
      lifecycleState: "PUBLISHED" as const,
      evidence: trend.evidence.map((item) => ({ ...item })),
    },
    opportunities: manifest.opportunities.filter((item) => item.relatedTrendId === trend.id).map((item) => ({
      id: item.id,
      relatedTrendId: item.relatedTrendId,
      fnbCategoryCode: item.fnbCategoryCode,
      name: item.name,
      description: item.description,
      opportunityType: item.opportunityType,
      targetConsumerSummary: item.targetConsumerSummary,
      competitionLevel: item.competitionLevel,
      competitionSummary: item.competitionSummary,
      executionFeasibility: null,
      marketSustainability: null,
      additionalAttributes: {},
    })),
  };
}

function createV2Snapshot(trendIndex = 0): CatalogFingerprintV2Snapshot {
  const trend = manifest.trends[trendIndex]!;
  return {
    id: trend.id,
    title: trend.title,
    categoryCode: trend.categoryCode,
    subjectAreaCode: trend.subjectAreaCode,
    signalSummary: trend.signal.summary,
    signalDescription: trend.signal.description,
    direction: trend.signal.direction,
    periodStart: trend.signal.periodStart,
    periodEnd: trend.signal.periodEnd,
    businessRelevanceExplanation: trend.businessRelevanceExplanation,
    affectedUserTypes: [...trend.affectedUserTypes],
    evidence: trend.evidence.map((item) => ({ ...item, provenance: null })),
  };
}

function createYearInSearchProvenance(trendEvidenceId: string): TrendEvidenceProvenanceInput {
  return {
    trendEvidenceId,
    schemaVersion: 1,
    sourceId: "google_year_in_search_indonesia_2025",
    originalPublisher: "GOOGLE",
    transportProvider: "NOT_APPLICABLE",
    sourceProduct: "GOOGLE_YEAR_IN_SEARCH_2025",
    collectionTargetUrl: null,
    retrievedAt: null,
    observationPeriodStatus: "UNKNOWN",
    observationPeriodStart: null,
    observationPeriodEnd: null,
    geographyCode: "ID",
    metricsAvailability: "AVAILABLE",
    metrics: [{
      name: "rank",
      availability: "AVAILABLE",
      value: 4,
      semanticAvailability: "KNOWN",
      semantic: "Synthetic relative-growth rank",
      unitAvailability: "KNOWN",
      unit: "rank",
    }],
    completeness: "COMPLETE",
  };
}

function createGoogleTrendsProvenance(trendEvidenceId: string): TrendEvidenceProvenanceInput {
  return {
    trendEvidenceId,
    schemaVersion: 1,
    sourceId: "google_trends_trending_now_indonesia",
    originalPublisher: "GOOGLE",
    transportProvider: "BRIGHTDATA_SERP_API",
    sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
    collectionTargetUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
    retrievedAt: new Date("2025-06-15T09:30:00.000Z"),
    observationPeriodStatus: "NOT_PROVIDED",
    observationPeriodStart: null,
    observationPeriodEnd: null,
    geographyCode: "ID",
    metricsAvailability: "AVAILABLE",
    metrics: [
      {
        name: "volume",
        availability: "AVAILABLE",
        value: 1200,
        semanticAvailability: "KNOWN",
        semantic: "Synthetic provider-reported volume value",
        unitAvailability: "UNKNOWN",
        unit: null,
      },
      {
        name: "volume_change",
        availability: "AVAILABLE",
        value: "+100%",
        semanticAvailability: "KNOWN",
        semantic: "Synthetic provider-reported change label",
        unitAvailability: "KNOWN",
        unit: "%",
      },
    ],
    completeness: "COMPLETE",
  };
}

function withProvenance(
  snapshot: CatalogFingerprintV2Snapshot,
  evidenceIndex: number,
  provenance: TrendEvidenceProvenanceInput,
): CatalogFingerprintV2Snapshot {
  return {
    ...snapshot,
    evidence: snapshot.evidence.map((evidence, index) =>
      index === evidenceIndex ? { ...evidence, provenance } : evidence),
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("versioned Trend content fingerprints", () => {
  it("pins the unchanged legacy v1 fingerprint to its existing canonical result", () => {
    expect(fingerprintCatalogContent(createV1Snapshot())).toBe("F3837E90C264F1EA933BF0E27E97F85B1B1879F0D6FC9F0BD11B5C9F6DA6095A");
  });

  it("treats an unlabelled legacy fingerprint as v1 and requires v2 to be explicit", () => {
    const legacySnapshot = createV1Snapshot();
    const v1 = fingerprintCatalogContent(legacySnapshot);
    expect(resolveCatalogFingerprintVersion(undefined)).toBe(1);
    expect(fingerprintCatalogContentVersioned({ snapshot: legacySnapshot })).toEqual({
      fingerprintVersion: 1,
      contentSha256: v1,
    });

    const v2Snapshot = createV2Snapshot();
    expect(fingerprintCatalogContentVersioned({ fingerprintVersion: 2, snapshot: v2Snapshot })).toEqual({
      fingerprintVersion: 2,
      contentSha256: fingerprintCatalogContentV2(v2Snapshot),
    });
    expect(() => fingerprintCatalogContentVersioned({ snapshot: v2Snapshot }))
      .toThrow("Version 1 requires the historical lifecycle snapshot shape.");
    expect(() => fingerprintCatalogContentVersioned({ fingerprintVersion: 1, snapshot: v2Snapshot }))
      .toThrow("Version 1 requires the historical lifecycle snapshot shape.");
    expect(() => resolveCatalogFingerprintVersion(null)).toThrow(CatalogFingerprintError);
  });

  it("verifies a synthetic legacy audit event whose fingerprint version is absent", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "venturex-fingerprint-v1-audit-"));
    temporaryDirectories.push(directory);
    const ledger = new JsonlCatalogAuditLedger(
      path.join(directory, "audit.jsonl"),
      () => new Date("2025-06-15T10:00:00.000Z"),
      (() => {
        let sequence = 0;
        return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
      })(),
    );
    const legacySnapshot = createV1Snapshot();
    const event = await ledger.append({
      action: "FACTUAL_REVIEW",
      manifestId: "synthetic-v1-audit-fixture",
      manifestSha256: "A".repeat(64),
      trendId: legacySnapshot.trend.id,
      contentSha256: fingerprintCatalogContent(legacySnapshot),
      actor: {
        osAccount: "synthetic-test-operator",
        role: "FACTUAL_REVIEWER",
        identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE",
      },
      decision: "APPROVED",
      rationale: "Synthetic legacy audit fixture for compatibility testing.",
      evidenceLimitations: ["Synthetic fixture; no factual review occurred."],
      transition: null,
    });

    expect(event).not.toHaveProperty("fingerprintVersion");
    await expect(ledger.readVerified()).resolves.toEqual([event]);
    expect(resolveCatalogFingerprintVersion(undefined)).toBe(1);
  });

  it("is deterministic and independent of evidence and metric query order", () => {
    const snapshot = withProvenance(createV2Snapshot(), 0, createGoogleTrendsProvenance(createV2Snapshot().evidence[0]!.id));
    const reordered: CatalogFingerprintV2Snapshot = {
      ...snapshot,
      evidence: [...snapshot.evidence].reverse(),
    };
    const firstEvidence = snapshot.evidence[0]!;
    if (!firstEvidence.provenance) throw new Error("Test provenance fixture was not attached.");
    const reorderedMetrics = withProvenance(snapshot, 0, {
      ...firstEvidence.provenance,
      metrics: [...firstEvidence.provenance.metrics].reverse(),
    });
    const reorderedAudiences = { ...snapshot, affectedUserTypes: [...snapshot.affectedUserTypes].reverse() };

    expect(fingerprintCatalogContentV2(snapshot)).toBe(fingerprintCatalogContentV2(snapshot));
    expect(fingerprintCatalogContentV2(reordered)).toBe(fingerprintCatalogContentV2(snapshot));
    expect(fingerprintCatalogContentV2(reorderedMetrics)).toBe(fingerprintCatalogContentV2(snapshot));
    expect(fingerprintCatalogContentV2(reorderedAudiences)).toBe(fingerprintCatalogContentV2(snapshot));
  });

  it("changes when factual Trend, Evidence, or provenance content changes", () => {
    const snapshot = withProvenance(createV2Snapshot(), 0, createYearInSearchProvenance(createV2Snapshot().evidence[0]!.id));
    const evidence = snapshot.evidence[0]!;
    if (!evidence.provenance) throw new Error("Test provenance fixture was not attached.");
    const changedMetric = withProvenance(snapshot, 0, {
      ...evidence.provenance,
      metrics: evidence.provenance.metrics.map((metric) => ({ ...metric, unit: "synthetic rank unit" })),
    });
    const changedClaim = {
      ...snapshot,
      evidence: snapshot.evidence.map((item, index) => index === 0
        ? { ...item, supportingDetail: `${item.supportingDetail} Updated synthetic claim.` }
        : item),
    };
    const changedTrend = { ...snapshot, signalSummary: `${snapshot.signalSummary} Updated synthetic summary.` };

    expect(fingerprintCatalogContentV2(changedMetric)).not.toBe(fingerprintCatalogContentV2(snapshot));
    expect(fingerprintCatalogContentV2(changedClaim)).not.toBe(fingerprintCatalogContentV2(snapshot));
    expect(fingerprintCatalogContentV2(changedTrend)).not.toBe(fingerprintCatalogContentV2(snapshot));

    const v2Approval = {
      fingerprintVersion: 2,
      contentSha256: fingerprintCatalogContentV2(snapshot),
    };
    expect(matchesCatalogFingerprint({ fingerprintVersion: 2, snapshot }, v2Approval)).toBe(true);
    expect(matchesCatalogFingerprint({ fingerprintVersion: 2, snapshot: changedMetric }, v2Approval)).toBe(false);
  });

  it("includes retrieval timestamps while excluding database lifecycle and record timestamps", () => {
    const original = createGoogleTrendsProvenance(createV2Snapshot().evidence[0]!.id);
    const snapshot = withProvenance(createV2Snapshot(), 0, original);
    const changedRetrieval = withProvenance(snapshot, 0, {
      ...original,
      retrievedAt: new Date("2025-06-15T09:30:01.000Z"),
    });
    const withVolatileFields = {
      ...snapshot,
      lifecycleState: "PUBLISHED",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    const changedVolatileFields = {
      ...snapshot,
      lifecycleState: "DRAFT",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    };

    expect(fingerprintCatalogContentV2(changedRetrieval)).not.toBe(fingerprintCatalogContentV2(snapshot));
    expect(fingerprintCatalogContentV2(withVolatileFields)).toBe(fingerprintCatalogContentV2(snapshot));
    expect(fingerprintCatalogContentV2(changedVolatileFields)).toBe(fingerprintCatalogContentV2(snapshot));
  });

  it("preserves missing relation, null values, UNKNOWN, UNAVAILABLE, and known empty arrays distinctly", () => {
    const base = createV2Snapshot();
    const absentRelation = withProvenance(base, 0, createYearInSearchProvenance(base.evidence[0]!.id));
    const emptyUnknown: TrendEvidenceProvenanceInput = {
      ...createYearInSearchProvenance(base.evidence[0]!.id),
      metricsAvailability: "UNKNOWN",
      metrics: [],
    };
    const unavailable: TrendEvidenceProvenanceInput = {
      ...createYearInSearchProvenance(base.evidence[0]!.id),
      metricsAvailability: "UNAVAILABLE",
      metrics: [{
        name: "rank",
        availability: "UNAVAILABLE",
        value: null,
        semanticAvailability: "UNAVAILABLE",
        semantic: null,
        unitAvailability: "UNAVAILABLE",
        unit: null,
      }],
    };
    const emptyAudience = { ...base, affectedUserTypes: [] };
    const missingProvenanceProperty = structuredClone(base) as unknown as Record<string, unknown>;
    const evidence = missingProvenanceProperty.evidence as Array<Record<string, unknown>>;
    if (evidence[0]) delete evidence[0].provenance;

    expect(fingerprintCatalogContentV2(base)).not.toBe(fingerprintCatalogContentV2(absentRelation));
    expect(fingerprintCatalogContentV2(withProvenance(base, 0, emptyUnknown)))
      .not.toBe(fingerprintCatalogContentV2(withProvenance(base, 0, unavailable)));
    expect(fingerprintCatalogContentV2(emptyAudience)).not.toBe(fingerprintCatalogContentV2(base));
    expect(validateCatalogFingerprintV2Snapshot(missingProvenanceProperty).success).toBe(false);
    expect(validateCatalogFingerprintV2Snapshot({ ...base, evidence: undefined }).success).toBe(false);
  });

  it("rejects unsupported provenance and secret-bearing extra fields without echoing values", () => {
    const base = createV2Snapshot();
    const provenance = createGoogleTrendsProvenance(base.evidence[0]!.id);
    const unsupportedSource = withProvenance(base, 0, {
      ...provenance,
      sourceId: "unsupported-source" as unknown as TrendEvidenceProvenanceInput["sourceId"],
    });
    const credentialBearingReference = {
      ...base,
      evidence: base.evidence.map((item, index) => index === 0
        ? { ...item, sourceReference: "https://example.test/source?api_key=SYNTHETIC_SECRET_SENTINEL" }
        : item),
    };
    const rawPayload = structuredClone(base) as unknown as Record<string, unknown>;
    rawPayload.rawProviderPayload = { sentinel: "SYNTHETIC_SECRET_SENTINEL" };
    const apiKey = structuredClone(base) as unknown as Record<string, unknown>;
    apiKey.apiKey = "SYNTHETIC_SECRET_SENTINEL";
    const validation = validateCatalogFingerprintV2Snapshot(apiKey);

    expect(validateCatalogFingerprintV2Snapshot(unsupportedSource).success).toBe(false);
    expect(validateCatalogFingerprintV2Snapshot(credentialBearingReference).success).toBe(false);
    expect(JSON.stringify(validateCatalogFingerprintV2Snapshot(credentialBearingReference)))
      .not.toContain("SYNTHETIC_SECRET_SENTINEL");
    expect(validateCatalogFingerprintV2Snapshot(rawPayload).success).toBe(false);
    expect(validation.success).toBe(false);
    expect(JSON.stringify(validation)).not.toContain("SYNTHETIC_SECRET_SENTINEL");
    expect(() => fingerprintCatalogContentV2(apiKey)).toThrow(CatalogFingerprintError);
  });

  it("distinguishes fingerprints by version and validates explicit approval metadata", () => {
    const v1Snapshot = createV1Snapshot();
    const v2Snapshot = createV2Snapshot();
    const v1 = fingerprintCatalogContentVersioned({ snapshot: v1Snapshot });
    const v2 = fingerprintCatalogContentVersioned({ fingerprintVersion: 2, snapshot: v2Snapshot });

    expect(matchesCatalogFingerprint({ snapshot: v1Snapshot }, { contentSha256: v1.contentSha256 })).toBe(true);
    expect(matchesCatalogFingerprint(
      { fingerprintVersion: 2, snapshot: v2Snapshot },
      { fingerprintVersion: 2, contentSha256: v2.contentSha256 },
    )).toBe(true);
    expect(matchesCatalogFingerprint(
      { fingerprintVersion: 2, snapshot: v2Snapshot },
      { contentSha256: v2.contentSha256 },
    )).toBe(false);
    expect(matchesCatalogFingerprint(
      { fingerprintVersion: 2, snapshot: v2Snapshot },
      { fingerprintVersion: 1, contentSha256: v2.contentSha256 },
    )).toBe(false);
    expect(() => fingerprintCatalogContentVersioned({ fingerprintVersion: 3, snapshot: v2Snapshot }))
      .toThrow(CatalogFingerprintError);
    expect(() => matchesCatalogFingerprint(
      { fingerprintVersion: 2, snapshot: v2Snapshot },
      { fingerprintVersion: 3, contentSha256: v2.contentSha256 },
    )).toThrow(CatalogFingerprintError);
  });
});
