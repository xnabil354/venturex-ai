import { z } from "zod";

const userTypes = ["ENTREPRENEUR", "UMKM_EXISTING"] as const;
const subjectAreaCodes = ["BEVERAGES", "SNACKS"] as const;
const requiredSourceReferences = [
  "https://trends.withgoogle.com/year-in-search/2025/id/",
  "https://trends.withgoogle.com/year-in-search/data-methodology/",
] as const;

const sourceSchema = z.object({
  id: z.string().uuid(),
  sourceName: z.string().trim().min(1).max(180),
  sourceReference: z.url().refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "trends.withgoogle.com";
  }, "Source references must use the official Google Trends domain over HTTPS"),
  supportingDetail: z.string().trim().min(1).max(4000),
  sourceDate: z.null(),
  limitations: z.string().trim().min(1).max(2000),
}).strict();

const trendSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(180),
  categoryCode: z.literal("PRODUCT_MENU"),
  subjectAreaCode: z.enum(subjectAreaCodes),
  signal: z.object({
    summary: z.string().trim().min(1).max(500),
    description: z.string().trim().min(1).max(4000),
    direction: z.literal("RISING"),
    periodStart: z.literal("2025-01-01"),
    periodEnd: z.literal("2025-11-25"),
  }).strict().refine(({ periodStart, periodEnd }) => periodStart <= periodEnd, {
    path: ["periodEnd"],
    message: "Period end must not precede period start",
  }),
  evidence: z.array(sourceSchema).min(2).max(4),
  businessRelevanceExplanation: z.string().trim().min(1).max(5000),
  affectedUserTypes: z.array(z.enum(userTypes)).min(1).max(2)
    .refine((values) => new Set(values).size === values.length),
}).strict();

const opportunitySchema = z.object({
  id: z.string().uuid(),
  relatedTrendId: z.string().uuid(),
  fnbCategoryCode: z.enum(subjectAreaCodes),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(12000),
  opportunityType: z.literal("NEW_PRODUCT"),
  targetConsumerSummary: z.null(),
  competitionLevel: z.null(),
  competitionSummary: z.null(),
  hypothesisLabel: z.literal("BUSINESS_HYPOTHESIS"),
  productOwnerReview: z.literal("PENDING"),
}).strict();

export const curatedCatalogManifestSchema = z.object({
  manifestId: z.string().trim().min(1).max(100),
  manifestVersion: z.literal(1),
  status: z.literal("PENDING_PRODUCT_OWNER_REVIEW"),
  reviewNotes: z.array(z.string().trim().min(1).max(2000)).min(1),
  reviewChecklist: z.array(z.string().trim().min(1).max(1000)).min(5),
  trends: z.array(trendSchema).min(2).max(2),
  opportunities: z.array(opportunitySchema).min(4).max(6),
}).strict().superRefine((manifest, context) => {
  const recordIds = [
    ...manifest.trends.map(({ id }) => id),
    ...manifest.trends.flatMap(({ evidence }) => evidence.map(({ id }) => id)),
    ...manifest.opportunities.map(({ id }) => id),
  ];
  if (new Set(recordIds).size !== recordIds.length) {
    context.addIssue({ code: "custom", message: "Manifest record identifiers must be unique" });
  }

  const trendIds = new Set(manifest.trends.map(({ id }) => id));
  for (const trend of manifest.trends) {
    const evidenceReferences = new Set(trend.evidence.map(({ sourceReference }) => sourceReference));
    for (const sourceReference of requiredSourceReferences) {
      if (!evidenceReferences.has(sourceReference)) {
        context.addIssue({
          code: "custom",
          path: ["trends"],
          message: `Trend ${trend.id} must cite the official Indonesia list and methodology sources`,
        });
      }
    }
    for (const userType of userTypes) {
      if (!trend.affectedUserTypes.includes(userType)) {
        context.addIssue({
          code: "custom",
          path: ["trends"],
          message: `Each proposed Trend must include the pending ${userType} audience`,
        });
      }
    }
  }
  for (const opportunity of manifest.opportunities) {
    if (!trendIds.has(opportunity.relatedTrendId)) {
      context.addIssue({
        code: "custom",
        path: ["opportunities"],
        message: `Opportunity ${opportunity.id} references a Trend outside this manifest`,
      });
    }
    const trend = manifest.trends.find(({ id }) => id === opportunity.relatedTrendId);
    if (trend && trend.subjectAreaCode !== opportunity.fnbCategoryCode) {
      context.addIssue({
        code: "custom",
        path: ["opportunities"],
        message: `Opportunity ${opportunity.id} category must match its proposed Trend subject area`,
      });
    }
  }

  const beverageOpportunities = manifest.opportunities
    .filter(({ fnbCategoryCode }) => fnbCategoryCode === "BEVERAGES");
  if (beverageOpportunities.length < 2) {
    context.addIssue({
      code: "custom",
      path: ["opportunities"],
      message: "At least two beverage Opportunities are required for category-filter testing",
    });
  }

  for (const userType of userTypes) {
    const eligibleCount = manifest.opportunities.filter((opportunity) => {
      const trend = manifest.trends.find(({ id }) => id === opportunity.relatedTrendId);
      return trend?.affectedUserTypes.includes(userType) ?? false;
    }).length;
    if (eligibleCount < 2) {
      context.addIssue({
        code: "custom",
        path: ["opportunities"],
        message: `At least two proposed Opportunities must be eligible for ${userType}`,
      });
    }
  }
});

export type CuratedCatalogManifest = z.infer<typeof curatedCatalogManifestSchema>;

export function parseCuratedCatalogManifest(input: unknown): CuratedCatalogManifest {
  return curatedCatalogManifestSchema.parse(input);
}
