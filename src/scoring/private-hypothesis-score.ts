import { z } from "zod";

import type { PrivateOpportunitySource } from "../opportunity/private-hypothesis";
import { calculateOpportunityScore, type OpportunityScorePolicy } from "./opportunity-score";
import { calculateFitScore } from "./fit-score";
import { FIT_SCORE_MVP_HEURISTIC_V1 } from "./fit-score-mvp";

export const PRIVATE_OPPORTUNITY_SCORE_POLICY = {
  modelType: "OPPORTUNITY_SCORE",
  version: "PRIVATE_SEARCH_EVIDENCE_V1",
  weights: {
    trendMomentum: 0.25,
    demandSignal: 0.2,
    competition: 0.15,
    consumerRelevance: 0.15,
    executionFeasibility: 0.15,
    marketSustainability: 0.1,
  },
  normalization: "PRE_NORMALIZED_0_TO_100",
  rounding: { mode: "HALF_UP", decimalPlaces: 2 },
} as const satisfies OpportunityScorePolicy;

export const PRIVATE_SCORE_FACTOR_LABELS = {
  trendMomentum: "Arah pertumbuhan pencarian",
  demandSignal: "Minat pencarian relatif",
  competition: "Kondisi persaingan",
  consumerRelevance: "Respons calon pembeli",
  executionFeasibility: "Kelayakan pelaksanaan",
  marketSustainability: "Ketahanan minat pasar",
  budgetFit: "Modal",
  interestFit: "Kategori minat",
  channelFit: "Kanal penjualan",
} as const;

export type PrivateFitProfile = Readonly<{
  budget: Readonly<{ min: number; max: number }>;
  interestCategoryIds: readonly string[];
  salesChannelIds: readonly string[];
}>;

export type PrivateFitOptions = Readonly<{
  categories: readonly Readonly<{ id: string; name: string }>[];
  channels: readonly Readonly<{ id: string; name: string }>[];
}>;

export const privateFitScenarioSchema = z.object({
  capitalMin: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  categoryId: z.string().uuid(),
  channelId: z.string().uuid(),
}).strict();
export type PrivateFitScenario = z.infer<typeof privateFitScenarioSchema>;

export function calculatePrivateOpportunityScore(source: PrivateOpportunitySource) {
  // A selected search query is a proxy for search interest only. Other market
  // factors remain unknown; neither narrative length nor LLM confidence is scored.
  const components: { demandSignal?: number; trendMomentum?: number } = {};
  if (source.transport === "SearchApi.io") {
    if (source.sourceType === "RELATED_QUERY_TOP" && source.interestIndex !== null && source.interestIndex <= 100) {
      components.demandSignal = source.interestIndex;
    }
    if (source.sourceType === "RELATED_QUERY_RISING" && !source.isBreakout && source.growthPercent !== null) {
      const growth = source.growthPercent;
      components.trendMomentum = growth === 0 ? 0 : 100 / (1 + 100 / growth);
    }
  }
  return calculateOpportunityScore({ policy: PRIVATE_OPPORTUNITY_SCORE_POLICY, normalizedComponents: components });
}

export function calculatePrivateFitScore(profile: PrivateFitProfile, scenario: PrivateFitScenario | null, options: PrivateFitOptions) {
  const parsed = privateFitScenarioSchema.safeParse(scenario);
  const valid = parsed.success
    && options.categories.some(({ id }) => id === parsed.data.categoryId)
    && options.channels.some(({ id }) => id === parsed.data.channelId);
  return calculateFitScore({
    userType: "ENTREPRENEUR",
    configuration: FIT_SCORE_MVP_HEURISTIC_V1.models.ENTREPRENEUR_FIT.configuration,
    normalizedComponents: valid ? {
      budgetFit: profile.budget.max >= parsed.data.capitalMin ? 100 : 0,
      interestFit: profile.interestCategoryIds.length ? (profile.interestCategoryIds.includes(parsed.data.categoryId) ? 100 : 0) : null,
      channelFit: profile.salesChannelIds.length ? (profile.salesChannelIds.includes(parsed.data.channelId) ? 100 : 0) : null,
    } : null,
  });
}
