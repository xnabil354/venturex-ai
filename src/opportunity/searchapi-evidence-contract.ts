import { z } from "zod";

import { trendRadarQueryRowSchema } from "@/trend/trend-radar-contract";

export const OPPORTUNITY_SEARCHAPI_DISCLOSURE_VERSION = "opportunities-searchapi-ninerouter-profile-v2" as const;

export const searchApiOpportunitySourceTypeSchema = z.enum(["RELATED_QUERY_TOP", "RELATED_QUERY_RISING"]);
export type SearchApiOpportunitySourceType = z.infer<typeof searchApiOpportunitySourceTypeSchema>;

const searchApiOpportunityEvidenceBaseSchema = z.object({
  sourceType: searchApiOpportunitySourceTypeSchema,
  productQuery: z.string().trim().min(1).max(80),
  query: z.string().trim().min(1).max(250),
  position: z.number().int().positive(),
  interestIndex: z.number().finite().nonnegative().nullable(),
  growthLabel: z.string().trim().max(120).nullable(),
  growthPercent: z.number().finite().nonnegative().nullable(),
  isBreakout: z.boolean(),
  geo: z.string().max(9),
  period: z.string().trim().min(1).max(120),
  providerTime: z.string().trim().min(1).max(120),
  searchProperty: z.enum(["web", "images", "news", "shopping", "youtube"]),
  retrievedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  publisher: z.literal("Google Trends"),
  provider: z.literal("SearchApi.io"),
  url: z.string().url().refine(isGoogleTrendsExploreUrl, "URL must point to Google Trends Explore"),
  providerSourceUrl: z.string().url().refine(isGoogleTrendsExploreUrl, "URL must point to Google Trends Explore").nullable(),
}).strict();

function validateEvidenceSemantics(source: z.infer<typeof searchApiOpportunityEvidenceBaseSchema>, context: z.RefinementCtx): void {
  if (source.sourceType === "RELATED_QUERY_TOP" && (source.growthLabel !== null || source.growthPercent !== null || source.isBreakout)) {
    context.addIssue({ code: "custom", path: ["growthLabel"], message: "Top query evidence cannot carry rising metrics." });
  }
  if (source.sourceType === "RELATED_QUERY_RISING" && source.interestIndex !== null) {
    context.addIssue({ code: "custom", path: ["interestIndex"], message: "Rising query evidence cannot carry a Top interest index." });
  }
  if (source.isBreakout && (source.growthLabel?.toLocaleLowerCase("en-US") !== "breakout" || source.growthPercent !== null)) {
    context.addIssue({ code: "custom", path: ["isBreakout"], message: "Breakout must remain a label without a converted percentage." });
  }
  if (Date.parse(source.expiresAt) <= Date.parse(source.retrievedAt)) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Evidence expiry must follow retrieval." });
  }
}

export const searchApiOpportunityEvidenceSchema = searchApiOpportunityEvidenceBaseSchema.superRefine(validateEvidenceSemantics);

export type SearchApiOpportunityEvidence = z.infer<typeof searchApiOpportunityEvidenceSchema>;

export const searchApiOpportunitySignalOptionSchema = searchApiOpportunityEvidenceBaseSchema.extend({
  id: z.string().uuid(),
  sourceToken: z.string().min(80).max(8_192),
}).superRefine(validateEvidenceSemantics);

export type SearchApiOpportunitySignalOption = z.infer<typeof searchApiOpportunitySignalOptionSchema>;

export const searchApiOpportunitySignalsResponseSchema = z.object({
  provider: z.literal("SearchApi.io"),
  productQuery: z.string().trim().min(1).max(80),
  retrievedAt: z.string().datetime(),
  appliedFilters: z.object({
    period: z.string().trim().min(1).max(120),
    time: z.string().trim().min(1).max(120),
    property: z.enum(["web", "images", "news", "shopping", "youtube"]),
    geo: z.string().max(9),
  }).strict(),
  top: z.array(searchApiOpportunitySignalOptionSchema),
  rising: z.array(searchApiOpportunitySignalOptionSchema),
}).strict();

export type SearchApiOpportunitySignalsResponse = z.infer<typeof searchApiOpportunitySignalsResponseSchema>;

export const opportunitySearchApiSourceReferenceSchema = searchApiOpportunityEvidenceSchema.extend({
  transport: z.literal("SearchApi.io"),
  sourceId: z.string().trim().min(1).max(80).optional(),
  analysisContextVersion: z.string().trim().min(1).max(80).optional(),
  promptVersion: z.string().trim().min(1).max(80).optional(),
  contextFingerprint: z.string().regex(/^hmac-sha256-v1:[a-f0-9]{64}$/u).optional(),
}).strict();

function isGoogleTrendsExploreUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "trends.google.com"
      && url.pathname === "/trends/explore"
      && !url.username
      && !url.password
      && !url.hash;
  } catch {
    return false;
  }
}

export function evidenceFromTrendRow(
  row: z.infer<typeof trendRadarQueryRowSchema>,
  sourceType: SearchApiOpportunitySourceType,
  context: Readonly<{
    productQuery: string;
    period: string;
    providerTime: string;
    searchProperty: "web" | "images" | "news" | "shopping" | "youtube";
    geo: string;
    retrievedAt: string;
    expiresAt: string;
    url: string;
  }>,
): SearchApiOpportunityEvidence {
  return searchApiOpportunityEvidenceSchema.parse({
    sourceType,
    productQuery: context.productQuery,
    query: row.query,
    position: row.position,
    interestIndex: sourceType === "RELATED_QUERY_TOP" ? row.interestIndex ?? null : null,
    growthLabel: sourceType === "RELATED_QUERY_RISING" ? row.growthLabel ?? null : null,
    growthPercent: sourceType === "RELATED_QUERY_RISING" ? row.growthPercent ?? null : null,
    isBreakout: sourceType === "RELATED_QUERY_RISING" ? row.isBreakout === true : false,
    geo: context.geo,
    period: context.period,
    providerTime: context.providerTime,
    searchProperty: context.searchProperty,
    retrievedAt: context.retrievedAt,
    expiresAt: context.expiresAt,
    publisher: "Google Trends",
    provider: "SearchApi.io",
    url: context.url,
    providerSourceUrl: row.sourceUrl,
  });
}
