import { z } from "zod";

import type { UserType } from "../auth/user-types";

export const TREND_CATEGORY_CODES = ["CONSUMER_BEHAVIOR", "PRODUCT_MENU", "CHANNEL_DISTRIBUTION", "TECHNOLOGY_ADOPTION", "OPERATIONAL_PATTERN", "MARKET_MOVEMENT"] as const;
export type TrendCategoryCode = (typeof TREND_CATEGORY_CODES)[number];
export type TrendCategory = { readonly code: TrendCategoryCode; readonly name: string; readonly description: string };
export const TREND_CATEGORIES = [
  { code: "CONSUMER_BEHAVIOR", name: "Consumer Behavior", description: "Changes in consumer preferences, occasions, purchasing habits, or consumption patterns relevant to F&B." },
  { code: "PRODUCT_MENU", name: "Product & Menu", description: "Changes in food or beverage products, ingredients, flavors, formats, packaging, or menu patterns." },
  { code: "CHANNEL_DISTRIBUTION", name: "Channel & Distribution", description: "Changes in how F&B products are discovered, ordered, sold, delivered, or distributed." },
  { code: "TECHNOLOGY_ADOPTION", name: "Technology Adoption", description: "Adoption of technology in F&B customer or operator workflows when it changes how the business serves or reaches customers." },
  { code: "OPERATIONAL_PATTERN", name: "Operational Pattern", description: "Observable changes in sourcing, preparation, service, labor, waste, or operating practices in F&B." },
  { code: "MARKET_MOVEMENT", name: "Market Movement", description: "Evidence-backed changes in F&B supply, prices, competition, or market structure; not an unsupported market-size estimate." },
] as const satisfies readonly TrendCategory[];

export const TREND_LIFECYCLE_STATES = ["DRAFT", "VALIDATED", "PUBLISHED", "ARCHIVED"] as const;
export type TrendLifecycleState = (typeof TREND_LIFECYCLE_STATES)[number];
export const TREND_DIRECTIONS = ["RISING", "STABLE", "DECLINING"] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];
export const TREND_USER_TYPES = ["ENTREPRENEUR", "UMKM_EXISTING"] as const;

const signalInputSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1).max(4000),
  direction: z.enum(TREND_DIRECTIONS).nullable().default(null),
  periodStart: z.iso.date().nullable().default(null),
  periodEnd: z.iso.date().nullable().default(null),
}).strict().refine(
  ({ periodStart, periodEnd }) => periodStart === null || periodEnd === null || periodStart <= periodEnd,
  { path: ["periodEnd"], message: "Period end must not precede period start" },
);

const evidenceInputSchema = z.object({
  sourceName: z.string().trim().min(1).max(180),
  sourceReference: z.string().trim().min(1).max(2000),
  supportingDetail: z.string().trim().min(1).max(4000),
  sourceDate: z.iso.datetime().nullable().default(null),
  limitations: z.string().trim().max(2000).nullable().default(null),
}).strict();

export type TrendEvidenceInput = {
  readonly sourceName: string;
  readonly sourceReference: string;
  readonly supportingDetail: string;
  readonly sourceDate: string | null;
  readonly limitations: string | null;
};

export type CreateDraftTrendInput = {
  readonly title: string;
  readonly categoryCode: TrendCategoryCode;
  readonly subjectAreaId: string | null;
  readonly signal: {
    readonly summary: string;
    readonly description: string;
    readonly direction: TrendDirection | null;
    readonly periodStart: string | null;
    readonly periodEnd: string | null;
  };
  readonly evidence: readonly TrendEvidenceInput[];
  readonly businessRelevanceExplanation: string | null;
  readonly affectedUserTypes: readonly UserType[];
};

export const trendIdSchema = z.string().uuid().brand<"TrendId">();
export type TrendId = z.infer<typeof trendIdSchema>;

export type TrendEvidenceRecord = {
  readonly id: string;
  readonly sourceName: string;
  readonly sourceReference: string;
  readonly supportingDetail: string;
  readonly sourceDate: Date | null;
  readonly limitations: string | null;
};

export type TrendRecord = {
  readonly id: TrendId;
  readonly title: string;
  readonly categoryCode: TrendCategoryCode;
  readonly subjectArea: { readonly code: string; readonly name: string } | null;
  readonly signal: {
    readonly summary: string;
    readonly description: string;
    readonly direction: TrendDirection | null;
    readonly periodStart: string | null;
    readonly periodEnd: string | null;
  };
  readonly evidence: readonly TrendEvidenceRecord[];
  readonly businessRelevanceExplanation: string | null;
  readonly affectedUserTypes: readonly UserType[];
  readonly lifecycleState: TrendLifecycleState;
  readonly archivedReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export class TrendCategoryNotFoundError extends Error {
  override readonly name = "TrendCategoryNotFoundError";
  constructor(readonly categoryCode: string) {
    super("Trend category " + categoryCode + " is not configured");
  }
}

export class TrendSubjectAreaNotFoundError extends Error {
  override readonly name = "TrendSubjectAreaNotFoundError";
  constructor(readonly subjectAreaId: string) {
    super("Trend subject area " + subjectAreaId + " was not found");
  }
}

export class TrendNotFoundError extends Error {
  override readonly name = "TrendNotFoundError";
  constructor(readonly trendId: TrendId) {
    super("Trend " + trendId + " was not found");
  }
}

export class InvalidTrendTransitionError extends Error {
  override readonly name = "InvalidTrendTransitionError";
  constructor(
    readonly currentState: TrendLifecycleState,
    readonly requestedState: TrendLifecycleState,
  ) {
    super("Trend cannot transition from " + currentState + " to " + requestedState);
  }
}

export class TrendRequirementNotMetError extends Error {
  override readonly name = "TrendRequirementNotMetError";
  constructor(readonly requirement: "evidence" | "business relevance explanation" | "affected user type" | "archive reason") {
    super("Trend requires " + requirement);
  }
}

export const ALLOWED_TREND_TRANSITIONS = {
  DRAFT: ["VALIDATED"],
  VALIDATED: ["PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
} as const satisfies Record<TrendLifecycleState, readonly TrendLifecycleState[]>;

export function assertTrendTransition(
  currentState: TrendLifecycleState,
  requestedState: TrendLifecycleState,
): void {
  if (!ALLOWED_TREND_TRANSITIONS[currentState].some((state) => state === requestedState)) {
    throw new InvalidTrendTransitionError(currentState, requestedState);
  }
}

export function getTrendCategory(code: TrendCategoryCode): TrendCategory {
  const category = TREND_CATEGORIES.find((candidate) => candidate.code === code);
  if (!category) {
    throw new TrendCategoryNotFoundError(code);
  }
  return category;
}

export const createDraftTrendSchema = z.object({
  title: z.string().trim().min(1).max(180),
  categoryCode: z.enum(TREND_CATEGORY_CODES),
  subjectAreaId: z.string().uuid().nullable().default(null),
  signal: signalInputSchema,
  evidence: z.array(evidenceInputSchema).max(50).default([]),
  businessRelevanceExplanation: z.string().trim().min(1).max(5000).nullable().default(null),
  affectedUserTypes: z.array(z.enum(TREND_USER_TYPES)).max(2).default([])
    .refine((userTypes) => new Set(userTypes).size === userTypes.length),
}).strict();
