import { z } from "zod";

import type { UserType } from "../auth/user-types";
import { opportunityIdSchema } from "./domain";

export const opportunityComparisonRequestSchema = z.object({
  opportunityIds: z.array(opportunityIdSchema.transform((id) => id.toLowerCase() as typeof id)).min(2).max(3),
}).strict().superRefine(({ opportunityIds }, context) => {
  if (new Set(opportunityIds).size !== opportunityIds.length) {
    context.addIssue({ code: "custom", path: ["opportunityIds"], message: "Opportunity IDs must be distinct." });
  }
});

export type OpportunityComparisonSource = {
  readonly id: string;
  readonly name: string;
  readonly categoryName: string;
  readonly competitionLevel: string | null;
  readonly competitionSummary: string | null;
  readonly executionFeasibility: string | null;
  readonly relatedTrend: {
    readonly id: string;
    readonly title: string;
    readonly direction: string | null;
    readonly lifecycleState: string;
    readonly affectedUserTypes: readonly string[];
  };
};

export interface OpportunityComparisonRepositoryPort {
  findEligibleForUser(userType: UserType, opportunityIds: readonly string[]): Promise<readonly OpportunityComparisonSource[]>;
}

export type OpportunityComparisonMetricStatus = "AVAILABLE" | "INSUFFICIENT_DATA" | "UNAVAILABLE";

export type OpportunityComparisonMetric<T> = {
  readonly status: OpportunityComparisonMetricStatus;
  readonly value: T | null;
  readonly explanation: string;
};

export type OpportunityComparisonItem = {
  readonly opportunityId: string;
  readonly name: string;
  readonly categoryName: string;
  readonly opportunityScore: OpportunityComparisonMetric<number>;
  readonly fitScore: OpportunityComparisonMetric<number>;
  readonly relatedTrend: OpportunityComparisonMetric<{ readonly title: string; readonly direction: string | null }>;
  readonly competition: OpportunityComparisonMetric<{ readonly level: string | null; readonly summary: string | null }>;
  readonly risk: OpportunityComparisonMetric<{ readonly level: "LOW" | "MEDIUM" | "HIGH"; readonly reasons: readonly string[] }>;
  readonly executionFeasibility: OpportunityComparisonMetric<number>;
};

export type OpportunityComparisonResult = {
  readonly items: readonly OpportunityComparisonItem[];
};

const metricStatusSchema = z.enum(["AVAILABLE", "INSUFFICIENT_DATA", "UNAVAILABLE"]);
const numericMetricSchema = z.object({ status: metricStatusSchema, value: z.number().finite().min(0).max(100).nullable(), explanation: z.string().min(1).max(400) }).strict();

export const opportunityComparisonResultSchema = z.object({
  items: z.array(z.object({
    opportunityId: z.string().uuid(),
    name: z.string().min(1).max(180),
    categoryName: z.string().min(1).max(160),
    opportunityScore: numericMetricSchema,
    fitScore: numericMetricSchema,
    relatedTrend: z.object({
      status: metricStatusSchema,
      value: z.object({ title: z.string().min(1), direction: z.string().nullable() }).strict().nullable(),
      explanation: z.string().min(1).max(400),
    }).strict(),
    competition: z.object({
      status: metricStatusSchema,
      value: z.object({ level: z.string().nullable(), summary: z.string().nullable() }).strict().nullable(),
      explanation: z.string().min(1).max(400),
    }).strict(),
    risk: z.object({
      status: metricStatusSchema,
      value: z.object({ level: z.enum(["LOW", "MEDIUM", "HIGH"]), reasons: z.array(z.string()).max(10) }).strict().nullable(),
      explanation: z.string().min(1).max(400),
    }).strict(),
    executionFeasibility: numericMetricSchema,
}).strict()).min(2).max(3),
}).strict().superRefine(({ items }, context) => {
  if (new Set(items.map(({ opportunityId }) => opportunityId)).size !== items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Comparison results must contain unique Opportunities." });
  }
  items.forEach((item, itemIndex) => {
    const metrics = [
      item.opportunityScore,
      item.fitScore,
      item.relatedTrend,
      item.competition,
      item.risk,
      item.executionFeasibility,
    ];
    metrics.forEach((metric, metricIndex) => {
      if ((metric.status === "AVAILABLE") !== (metric.value !== null)) {
        context.addIssue({
          code: "custom",
          path: ["items", itemIndex, "metrics", metricIndex],
          message: "Available comparison metrics must have a value and other states must not.",
        });
      }
    });
  });
});
