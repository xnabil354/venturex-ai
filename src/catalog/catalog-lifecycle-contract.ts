import { z } from "zod";

import type { TrendLifecycleState } from "../trend/domain";

const sha256Schema = z.string().regex(/^[A-F0-9]{64}$/);
const actorSchema = z.object({
  osAccount: z.string().trim().min(1).max(180),
  role: z.enum(["FACTUAL_REVIEWER", "PRODUCT_DATA_OWNER", "OPERATOR"]),
  identityAssurance: z.literal("LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE"),
}).strict();
const transitionSchema = z.object({
  id: z.string().uuid(),
  from: z.enum(["DRAFT", "VALIDATED", "PUBLISHED", "ARCHIVED"]),
  to: z.enum(["DRAFT", "VALIDATED", "PUBLISHED", "ARCHIVED"]),
}).strict();

export const catalogLifecycleAuditEventSchema = z.object({
  schemaVersion: z.literal(1),
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
  manifestId: z.string().min(1).max(100),
  manifestSha256: sha256Schema,
  trendId: z.string().uuid(),
  contentSha256: sha256Schema,
  actor: actorSchema,
  decision: z.enum(["APPROVED", "REJECTED", "NOT_APPLICABLE"]),
  rationale: z.string().trim().min(10).max(2000),
  evidenceLimitations: z.array(z.string().trim().min(1).max(2000)).max(12),
  transition: transitionSchema.nullable(),
  previousHash: sha256Schema.nullable(),
  hash: sha256Schema,
}).strict();

export type CatalogLifecycleAuditEvent = z.infer<typeof catalogLifecycleAuditEventSchema>;
export type CatalogDecision = "APPROVED" | "REJECTED";

export type CatalogLifecycleSnapshot = {
  readonly trend: {
    readonly id: string;
    readonly title: string;
    readonly categoryCode: string;
    readonly subjectAreaCode: string | null;
    readonly signalSummary: string;
    readonly signalDescription: string;
    readonly direction: string | null;
    readonly periodStart: string | null;
    readonly periodEnd: string | null;
    readonly businessRelevanceExplanation: string | null;
    readonly affectedUserTypes: readonly string[];
    readonly lifecycleState: TrendLifecycleState;
    readonly evidence: readonly {
      readonly id: string;
      readonly sourceName: string;
      readonly sourceReference: string;
      readonly supportingDetail: string;
      readonly sourceDate: string | null;
      readonly limitations: string | null;
    }[];
  };
  readonly opportunities: readonly {
    readonly id: string;
    readonly relatedTrendId: string;
    readonly fnbCategoryCode: string | null;
    readonly name: string;
    readonly description: string;
    readonly opportunityType: string;
    readonly targetConsumerSummary: string | null;
    readonly competitionLevel: string | null;
    readonly competitionSummary: string | null;
    readonly executionFeasibility: string | number | null;
    readonly marketSustainability: string | number | null;
    readonly additionalAttributes: Record<string, unknown>;
  }[];
};

export class CatalogLifecycleError extends Error {
  override readonly name = "CatalogLifecycleError";
}

