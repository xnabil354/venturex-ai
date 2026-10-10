import type { UserType } from "../auth/user-types";
import {
  getTrendCategory,
  type TrendDirection,
  type TrendLifecycleState,
  type TrendRecord,
} from "./domain";

export type TrendDto = {
  readonly id: string;
  readonly title: string;
  readonly category: { readonly code: string; readonly name: string; readonly description: string };
  readonly subjectArea: { readonly code: string; readonly name: string } | null;
  readonly signal: {
    readonly summary: string;
    readonly description: string;
    readonly direction: TrendDirection | null;
    readonly observationPeriod: { readonly start: string | null; readonly end: string | null };
  };
  readonly evidence: readonly {
    readonly sourceName: string;
    readonly sourceReference: string;
    readonly supportingDetail: string;
    readonly sourceDate: string | null;
    readonly limitations: string | null;
  }[];
  readonly businessRelevanceExplanation: string | null;
  readonly affectedUserTypes: readonly UserType[];
  readonly lifecycleState: TrendLifecycleState;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function toTrendDto(trend: TrendRecord): TrendDto {
  const category = getTrendCategory(trend.categoryCode);
  return {
    id: trend.id,
    title: trend.title,
    category: { code: category.code, name: category.name, description: category.description },
    subjectArea: trend.subjectArea ? { code: trend.subjectArea.code, name: trend.subjectArea.name } : null,
    signal: {
      summary: trend.signal.summary,
      description: trend.signal.description,
      direction: trend.signal.direction,
      observationPeriod: { start: trend.signal.periodStart, end: trend.signal.periodEnd },
    },
    evidence: trend.evidence.map((item) => ({
      sourceName: item.sourceName,
      sourceReference: item.sourceReference,
      supportingDetail: item.supportingDetail,
      sourceDate: item.sourceDate?.toISOString() ?? null,
      limitations: item.limitations,
    })),
    businessRelevanceExplanation: trend.businessRelevanceExplanation,
    affectedUserTypes: [...trend.affectedUserTypes],
    lifecycleState: trend.lifecycleState,
    createdAt: trend.createdAt.toISOString(),
    updatedAt: trend.updatedAt.toISOString(),
  };
}
