import { createHash } from "node:crypto";

import { z } from "zod";

import { CATALOG_FINGERPRINT_VERSIONS, type CatalogFingerprintVersion } from "./catalog-fingerprint";
import {
  catalogLifecycleAuditEventSchema,
  type CatalogLifecycleAuditEvent,
} from "./catalog-lifecycle";
import { ALLOWED_TREND_TRANSITIONS, TREND_LIFECYCLE_STATES } from "../trend/domain";

const sha256Schema = z.string().regex(/^[A-F0-9]{64}$/);
const fingerprintVersionSchema = z.union([
  z.literal(CATALOG_FINGERPRINT_VERSIONS[0]),
  z.literal(CATALOG_FINGERPRINT_VERSIONS[1]),
]);

const actorSchema = z.object({
  osAccount: z.string().min(1).max(180).refine((value) => value.trim().length > 0),
  role: z.enum(["FACTUAL_REVIEWER", "PRODUCT_DATA_OWNER", "OPERATOR"]),
  identityAssurance: z.literal("LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE"),
}).strict();

const transitionSchema = z.object({
  id: z.string().uuid(),
  from: z.enum(TREND_LIFECYCLE_STATES),
  to: z.enum(TREND_LIFECYCLE_STATES),
}).strict().superRefine((transition, context) => {
  if (!ALLOWED_TREND_TRANSITIONS[transition.from].some((state) => state === transition.to)) {
    context.addIssue({ code: "custom", path: ["to"], message: "INVALID_TREND_TRANSITION" });
  }
});

const factualReviewReferenceSchema = z.object({
  eventId: z.string().uuid(),
  eventHash: sha256Schema,
}).strict();

const catalogAuditV2BaseSchema = z.object({
  schemaVersion: z.literal(2),
  sequence: z.number().int().positive(),
  id: z.string().uuid(),
  recordedAt: z.string().datetime(),
  action: z.enum([
    "FACTUAL_REVIEW",
    "PUBLICATION_APPROVAL",
    "TRANSITION_STARTED",
    "TRANSITION_SUCCEEDED",
    "TRANSITION_FAILED",
  ]),
  manifestId: z.string().min(1).max(100).refine((value) => value.trim().length > 0),
  manifestSha256: sha256Schema,
  trendId: z.string().uuid(),
  fingerprintVersion: fingerprintVersionSchema,
  contentSha256: sha256Schema,
  actor: actorSchema,
  decision: z.enum(["APPROVED", "REJECTED", "NOT_APPLICABLE"]),
  rationale: z.string().min(10).max(2000).refine((value) => value.trim().length >= 10),
  evidenceLimitations: z.array(
    z.string().min(1).max(2000).refine((value) => value.trim().length > 0),
  ).min(1).max(12),
  transition: transitionSchema.nullable(),
  factualReviewReference: factualReviewReferenceSchema.nullable(),
  previousHash: sha256Schema.nullable(),
  hash: sha256Schema,
}).strict();

function validateV2ActionConsistency(
  event: Omit<z.infer<typeof catalogAuditV2BaseSchema>, "hash">,
  context: z.RefinementCtx,
): void {
  const isTransition = event.action.startsWith("TRANSITION_");
  if (isTransition !== (event.transition !== null)) {
    context.addIssue({ code: "custom", path: ["transition"], message: "EVENT_TRANSITION_SHAPE_MISMATCH" });
  }

  if (event.action === "FACTUAL_REVIEW") {
    if (event.actor.role !== "FACTUAL_REVIEWER") {
      context.addIssue({ code: "custom", path: ["actor", "role"], message: "FACTUAL_REVIEW_ROLE_MISMATCH" });
    }
    if (event.decision === "NOT_APPLICABLE" || event.factualReviewReference !== null) {
      context.addIssue({ code: "custom", path: ["factualReviewReference"], message: "FACTUAL_REVIEW_EVENT_SHAPE_MISMATCH" });
    }
  } else if (event.action === "PUBLICATION_APPROVAL") {
    if (event.actor.role !== "PRODUCT_DATA_OWNER") {
      context.addIssue({ code: "custom", path: ["actor", "role"], message: "PUBLICATION_APPROVAL_ROLE_MISMATCH" });
    }
    if (event.decision === "NOT_APPLICABLE" || event.transition !== null || event.factualReviewReference === null) {
      context.addIssue({ code: "custom", path: ["factualReviewReference"], message: "PUBLICATION_APPROVAL_EVENT_SHAPE_MISMATCH" });
    }
  } else {
    if (event.actor.role !== "OPERATOR") {
      context.addIssue({ code: "custom", path: ["actor", "role"], message: "TRANSITION_ROLE_MISMATCH" });
    }
    if (event.decision !== "NOT_APPLICABLE" || event.factualReviewReference !== null) {
      context.addIssue({ code: "custom", path: ["decision"], message: "TRANSITION_EVENT_SHAPE_MISMATCH" });
    }
  }
}

export const catalogAuditEventV2Schema = catalogAuditV2BaseSchema.superRefine(validateV2ActionConsistency);

const catalogAuditEventV1PayloadSchema = catalogLifecycleAuditEventSchema.omit({ hash: true });
const catalogAuditEventV2PayloadSchema = catalogAuditV2BaseSchema
  .omit({ hash: true })
  .superRefine(validateV2ActionConsistency);

export type CatalogAuditEventV2 = z.infer<typeof catalogAuditEventV2Schema>;
export type VersionedCatalogAuditEvent = CatalogLifecycleAuditEvent | CatalogAuditEventV2;

export class CatalogAuditContractError extends Error {
  override readonly name = "CatalogAuditContractError";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map((key) =>
      JSON.stringify(key) + ":" + canonicalJson(record[key]),
    ).join(",") + "}";
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new CatalogAuditContractError("Audit event is not JSON serializable.");
  return serialized;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function getSchemaVersion(value: unknown): 1 | 2 {
  const record = getRecord(value);
  if (record?.schemaVersion === 1 || record?.schemaVersion === 2) return record.schemaVersion;
  throw new CatalogAuditContractError("Audit event has an unsupported schema version.");
}

/**
 * Hashes a validated event payload without its hash member. The payload is
 * hashed as supplied; this function does not normalize event fields.
 */
export function hashVersionedCatalogAuditEventPayload(payload: unknown): string {
  const schemaVersion = getSchemaVersion(payload);
  const schema = schemaVersion === 1 ? catalogAuditEventV1PayloadSchema : catalogAuditEventV2PayloadSchema;
  if (!schema.safeParse(payload).success) {
    throw new CatalogAuditContractError("Audit event payload is invalid for its schema version.");
  }
  return sha256(canonicalJson(payload));
}

function effectiveFingerprintVersion(event: VersionedCatalogAuditEvent): CatalogFingerprintVersion {
  return event.schemaVersion === 1 ? 1 : event.fingerprintVersion;
}

function validatePublicationReviewReference(
  event: CatalogAuditEventV2,
  priorEvents: readonly VersionedCatalogAuditEvent[],
): void {
  if (event.action !== "PUBLICATION_APPROVAL") return;
  const reference = event.factualReviewReference;
  if (!reference) throw new CatalogAuditContractError("Publication approval is missing its factual review reference.");

  const referenced = priorEvents.find((candidate) => candidate.id === reference.eventId);
  if (!referenced || referenced.hash !== reference.eventHash) {
    throw new CatalogAuditContractError("Publication approval references an unknown or mismatched audit event.");
  }
  if (
    referenced.action !== "FACTUAL_REVIEW" ||
    referenced.decision !== "APPROVED" ||
    referenced.manifestId !== event.manifestId ||
    referenced.manifestSha256 !== event.manifestSha256 ||
    referenced.trendId !== event.trendId ||
    effectiveFingerprintVersion(referenced) !== event.fingerprintVersion ||
    referenced.contentSha256 !== event.contentSha256 ||
    referenced.evidenceLimitations.length !== event.evidenceLimitations.length ||
    referenced.evidenceLimitations.some((limitation, index) => limitation !== event.evidenceLimitations[index])
  ) {
    throw new CatalogAuditContractError("Publication approval reference does not match the approved review context.");
  }

  const latestReview = [...priorEvents].reverse().find((candidate) =>
    candidate.action === "FACTUAL_REVIEW" &&
    candidate.manifestId === event.manifestId &&
    candidate.manifestSha256 === event.manifestSha256 &&
    candidate.trendId === event.trendId,
  );
  if (latestReview?.id !== referenced.id) {
    throw new CatalogAuditContractError("Publication approval does not reference the latest factual review.");
  }
}

/**
 * Verifies an in-memory mixed-version ledger. Historical v1 events are
 * validated against their original strict schema and hash representation;
 * this function never rewrites or upgrades them.
 */
export function verifyVersionedCatalogAuditLedger(input: unknown): readonly VersionedCatalogAuditEvent[] {
  if (!Array.isArray(input)) throw new CatalogAuditContractError("Audit ledger must be an event array.");

  const events: VersionedCatalogAuditEvent[] = [];
  const eventIds = new Set<string>();
  let previousHash: string | null = null;
  let v2HasStarted = false;

  for (const [index, rawEvent] of input.entries()) {
    const schemaVersion = getSchemaVersion(rawEvent);
    const record = getRecord(rawEvent);
    if (!record) throw new CatalogAuditContractError("Audit event " + (index + 1) + " is invalid.");

    if (schemaVersion === 1 && v2HasStarted) {
      throw new CatalogAuditContractError("Audit schema versions cannot move backward after schemaVersion 2 begins.");
    }
    if (schemaVersion === 2) v2HasStarted = true;

    const result = schemaVersion === 1
      ? catalogLifecycleAuditEventSchema.safeParse(rawEvent)
      : catalogAuditEventV2Schema.safeParse(rawEvent);
    if (!result.success) {
      throw new CatalogAuditContractError("Audit event " + (index + 1) + " does not match schemaVersion " + schemaVersion + ".");
    }
    const event = result.data as VersionedCatalogAuditEvent;

    if (event.sequence !== index + 1) {
      throw new CatalogAuditContractError("Audit event " + (index + 1) + " has a discontinuous sequence.");
    }
    if (event.previousHash !== previousHash) {
      throw new CatalogAuditContractError("Audit event " + (index + 1) + " has an invalid previousHash.");
    }
    if (eventIds.has(event.id)) {
      throw new CatalogAuditContractError("Audit event " + (index + 1) + " duplicates an event ID.");
    }

    const { hash, ...rawPayload } = record;
    const calculatedHash = hashVersionedCatalogAuditEventPayload(rawPayload);
    if (calculatedHash !== event.hash) {
      throw new CatalogAuditContractError("Audit event " + (index + 1) + " hash verification failed.");
    }

    if (event.schemaVersion === 2) validatePublicationReviewReference(event, events);

    events.push(event);
    eventIds.add(event.id);
    previousHash = event.hash;
  }

  return events;
}
