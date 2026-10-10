import { z } from "zod";

import type { OpportunityDetailRecord, OpportunityRecord } from "./domain";

export type OpportunityListItemDto = {
  readonly id: string;
  readonly name: string;
  readonly categoryName: string;
  readonly summary: string;
  readonly relatedTrend: {
    readonly id: string;
    readonly title: string;
  };
};

export type OpportunityDetailDto = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categoryName: string;
  readonly opportunityType: string;
  readonly targetConsumerSummary: string | null;
  readonly competitionLevel: string | null;
  readonly competitionSummary: string | null;
  readonly relatedTrend: {
    readonly id: string;
    readonly title: string;
  };
};

const displayRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  categoryName: z.string().trim().min(1),
  relatedTrend: z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(1),
  }),
});

const detailRecordSchema = displayRecordSchema.extend({
  opportunityType: z.string().trim().min(1),
  targetConsumerSummary: z.string().trim().nullable(),
  competitionLevel: z.string().trim().nullable(),
  competitionSummary: z.string().trim().nullable(),
});

const SUMMARY_LIMIT = 240;

export class OpportunityDisplayContractError extends Error {
  override readonly name = "OpportunityDisplayContractError";

  constructor() {
    super("An Opportunity does not satisfy the catalog display contract.");
  }
}

function toSummary(description: string): string {
  const normalized = description.trim().replace(/\s+/gu, " ");
  if (normalized.length <= SUMMARY_LIMIT) return normalized;
  return `${normalized.slice(0, SUMMARY_LIMIT - 1).trimEnd()}…`;
}

export function toOpportunityListItem(record: OpportunityRecord): OpportunityListItemDto {
  const result = displayRecordSchema.safeParse(record);
  if (!result.success) throw new OpportunityDisplayContractError();

  return {
    id: result.data.id,
    name: result.data.name,
    categoryName: result.data.categoryName,
    summary: toSummary(result.data.description),
    relatedTrend: {
      id: result.data.relatedTrend.id,
      title: result.data.relatedTrend.title,
    },
  };
}

export function toOpportunityDetail(record: OpportunityDetailRecord): OpportunityDetailDto {
  const result = detailRecordSchema.safeParse(record);
  if (!result.success) throw new OpportunityDisplayContractError();

  return {
    id: result.data.id,
    name: result.data.name,
    description: result.data.description,
    categoryName: result.data.categoryName,
    opportunityType: result.data.opportunityType,
    targetConsumerSummary: result.data.targetConsumerSummary,
    competitionLevel: result.data.competitionLevel,
    competitionSummary: result.data.competitionSummary,
    relatedTrend: {
      id: result.data.relatedTrend.id,
      title: result.data.relatedTrend.title,
    },
  };
}
