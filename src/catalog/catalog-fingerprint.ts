import { createHash } from "node:crypto";

import { z } from "zod";

import {
  fingerprintCatalogContent,
  type CatalogLifecycleSnapshot,
} from "./catalog-lifecycle";
import { trendEvidenceProvenanceInputSchema } from "../trend/trend-evidence-provenance.schema";
import {
  TREND_LIFECYCLE_STATES,
  TREND_CATEGORY_CODES,
  TREND_DIRECTIONS,
  TREND_USER_TYPES,
} from "../trend/domain";

export const CATALOG_FINGERPRINT_VERSIONS = [1, 2] as const;
export type CatalogFingerprintVersion = (typeof CATALOG_FINGERPRINT_VERSIONS)[number];

const fingerprintVersionSchema = z.union([z.literal(1), z.literal(2)]);
const sha256Schema = z.string().regex(/^[A-F0-9]{64}$/);

const secureSourceReferenceSchema = z.string().url().max(2000).refine((value) => {
  try {
    const url = new URL(value);
    const containsCredentialParameter = [...url.searchParams.keys()].some((name) =>
      /(?:api[-_]?key|access[-_]?token|auth(?:orization)?|bearer|client[-_]?secret|password|passwd|secret|signature|token)/i.test(name),
    );
    return url.protocol === "https:" && !url.username && !url.password && !containsCredentialParameter;
  } catch {
    return false;
  }
}, "SOURCE_REFERENCE_MUST_BE_HTTPS_WITHOUT_EMBEDDED_CREDENTIALS");

const evidenceV2Schema = z.object({
  id: z.string().uuid(),
  sourceName: z.string().trim().min(1).max(180),
  sourceReference: secureSourceReferenceSchema,
  supportingDetail: z.string().trim().min(1).max(4000),
  sourceDate: z.union([z.iso.date(), z.iso.datetime()]).nullable(),
  limitations: z.string().trim().max(2000).nullable(),
  provenance: trendEvidenceProvenanceInputSchema.nullable(),
}).strict();

const trendV2Schema = z.object({
  id: z.string().uuid(),
  lifecycleState: z.enum(TREND_LIFECYCLE_STATES).optional(),
  createdAt: z.union([z.date(), z.iso.datetime({ offset: true })]).optional(),
  updatedAt: z.union([z.date(), z.iso.datetime({ offset: true })]).optional(),
  title: z.string().trim().min(1).max(180),
  categoryCode: z.enum(TREND_CATEGORY_CODES),
  subjectAreaCode: z.string().trim().min(1).max(80).nullable(),
  signalSummary: z.string().trim().min(1).max(500),
  signalDescription: z.string().trim().min(1).max(4000),
  direction: z.enum(TREND_DIRECTIONS).nullable(),
  periodStart: z.iso.date().nullable(),
  periodEnd: z.iso.date().nullable(),
  businessRelevanceExplanation: z.string().trim().max(5000).nullable(),
  affectedUserTypes: z.array(z.enum(TREND_USER_TYPES)).max(2),
  evidence: z.array(evidenceV2Schema).max(50),
}).strict().superRefine((trend, context) => {
  if (trend.periodStart && trend.periodEnd && trend.periodEnd < trend.periodStart) {
    context.addIssue({ code: "custom", path: ["periodEnd"], message: "TREND_PERIOD_END_PRECEDES_START" });
  }
  if (new Set(trend.affectedUserTypes).size !== trend.affectedUserTypes.length) {
    context.addIssue({ code: "custom", path: ["affectedUserTypes"], message: "DUPLICATE_AFFECTED_USER_TYPE" });
  }

  const evidenceIds = new Set<string>();
  for (const [index, evidence] of trend.evidence.entries()) {
    if (evidenceIds.has(evidence.id)) {
      context.addIssue({ code: "custom", path: ["evidence", index, "id"], message: "DUPLICATE_EVIDENCE_ID" });
    }
    evidenceIds.add(evidence.id);
    if (evidence.provenance && evidence.provenance.trendEvidenceId !== evidence.id) {
      context.addIssue({ code: "custom", path: ["evidence", index, "provenance", "trendEvidenceId"], message: "PROVENANCE_EVIDENCE_ID_MISMATCH" });
    }
  }
});

const dispatchInputSchema = z.object({
  fingerprintVersion: fingerprintVersionSchema.optional(),
  snapshot: z.unknown(),
}).strict();

const fingerprintApprovalSchema = z.object({
  fingerprintVersion: fingerprintVersionSchema.optional(),
  contentSha256: sha256Schema,
}).strict();

export type CatalogFingerprintV2Snapshot = z.infer<typeof trendV2Schema>;
export type VersionedCatalogFingerprint = {
  readonly fingerprintVersion: CatalogFingerprintVersion;
  readonly contentSha256: string;
};

export class CatalogFingerprintError extends Error {
  override readonly name = "CatalogFingerprintError";
}

function isLegacyCatalogLifecycleSnapshot(snapshot: unknown): snapshot is CatalogLifecycleSnapshot {
  return snapshot !== null && typeof snapshot === "object" &&
    "trend" in snapshot && "opportunities" in snapshot && !("id" in snapshot);
}

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort(stableCompare).map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new CatalogFingerprintError("Fingerprint input is not JSON serializable.");
  return serialized;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}

function canonicalTrendV2(snapshot: CatalogFingerprintV2Snapshot) {
  return {
    fingerprintVersion: 2 as const,
    trend: {
      id: snapshot.id,
      title: snapshot.title,
      categoryCode: snapshot.categoryCode,
      subjectAreaCode: snapshot.subjectAreaCode,
      signalSummary: snapshot.signalSummary,
      signalDescription: snapshot.signalDescription,
      direction: snapshot.direction,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      businessRelevanceExplanation: snapshot.businessRelevanceExplanation,
      affectedUserTypes: [...snapshot.affectedUserTypes].sort(stableCompare),
      evidence: [...snapshot.evidence]
        .sort((left, right) => stableCompare(left.id, right.id))
        .map((evidence) => ({
          id: evidence.id,
          sourceName: evidence.sourceName,
          sourceReference: evidence.sourceReference,
          supportingDetail: evidence.supportingDetail,
          sourceDate: evidence.sourceDate,
          limitations: evidence.limitations,
          provenance: evidence.provenance === null ? null : {
            schemaVersion: evidence.provenance.schemaVersion,
            sourceId: evidence.provenance.sourceId,
            originalPublisher: evidence.provenance.originalPublisher,
            transportProvider: evidence.provenance.transportProvider,
            sourceProduct: evidence.provenance.sourceProduct,
            collectionTargetUrl: evidence.provenance.collectionTargetUrl,
            retrievedAt: evidence.provenance.retrievedAt?.toISOString() ?? null,
            observationPeriodStatus: evidence.provenance.observationPeriodStatus,
            observationPeriodStart: evidence.provenance.observationPeriodStart,
            observationPeriodEnd: evidence.provenance.observationPeriodEnd,
            geographyCode: evidence.provenance.geographyCode,
            metricsAvailability: evidence.provenance.metricsAvailability,
            metrics: [...evidence.provenance.metrics]
              .sort((left, right) => stableCompare(left.name, right.name))
              .map((metric) => ({
                name: metric.name,
                availability: metric.availability,
                value: metric.value,
                semanticAvailability: metric.semanticAvailability,
                semantic: metric.semantic,
                unitAvailability: metric.unitAvailability,
                unit: metric.unit,
              })),
            completeness: evidence.provenance.completeness,
          },
        })),
    },
  };
}

export function resolveCatalogFingerprintVersion(version: unknown): CatalogFingerprintVersion {
  if (version === undefined) return 1;
  const parsed = fingerprintVersionSchema.safeParse(version);
  if (!parsed.success) throw new CatalogFingerprintError("Unsupported catalog fingerprint version.");
  return parsed.data;
}

export function validateCatalogFingerprintV2Snapshot(snapshot: unknown): {
  readonly success: boolean;
  readonly issues: readonly { readonly path: string; readonly code: string }[];
} {
  const parsed = trendV2Schema.safeParse(snapshot);
  if (parsed.success) return { success: true, issues: [] };
  return {
    success: false,
    issues: parsed.error.issues.slice(0, 50).map((issue) => ({
      path: issue.path.map(String).join("."),
      code: issue.code,
    })),
  };
}

export function isCatalogFingerprintV2Snapshot(snapshot: unknown): snapshot is CatalogFingerprintV2Snapshot {
  return trendV2Schema.safeParse(snapshot).success;
}

export function fingerprintCatalogContentV2(snapshot: unknown): string {
  const parsed = trendV2Schema.safeParse(snapshot);
  if (!parsed.success) throw new CatalogFingerprintError("Fingerprint v2 input is invalid.");
  return sha256(canonicalJson(canonicalTrendV2(snapshot as CatalogFingerprintV2Snapshot)));
}

export function fingerprintCatalogContentVersioned(input: unknown): VersionedCatalogFingerprint {
  const parsed = dispatchInputSchema.safeParse(input);
  if (!parsed.success) throw new CatalogFingerprintError("Versioned fingerprint input is invalid.");

  const fingerprintVersion = resolveCatalogFingerprintVersion(parsed.data.fingerprintVersion);
  let contentSha256: string;
  if (fingerprintVersion === 1) {
    const snapshot = parsed.data.snapshot;
    if (!isLegacyCatalogLifecycleSnapshot(snapshot)) {
      throw new CatalogFingerprintError("Version 1 requires the historical lifecycle snapshot shape.");
    }
    contentSha256 = fingerprintCatalogContent(snapshot);
  } else {
    contentSha256 = fingerprintCatalogContentV2(parsed.data.snapshot);
  }
  return { fingerprintVersion, contentSha256 };
}

export function matchesCatalogFingerprint(
  input: unknown,
  approval: unknown,
): boolean {
  const parsedApproval = fingerprintApprovalSchema.safeParse(approval);
  if (!parsedApproval.success) throw new CatalogFingerprintError("Fingerprint approval metadata is invalid.");

  const expectedVersion = resolveCatalogFingerprintVersion(parsedApproval.data.fingerprintVersion);
  const actual = fingerprintCatalogContentVersioned(input);
  return actual.fingerprintVersion === expectedVersion && actual.contentSha256 === parsedApproval.data.contentSha256;
}
