import { z } from "zod";

export const OPPORTUNITY_PAGE_SIZE = 10;

export const opportunityIdSchema = z.string().uuid().brand<"OpportunityId">();
export type OpportunityId = z.infer<typeof opportunityIdSchema>;

export const opportunityPageSchema = z.coerce.number().int().min(1).catch(1);
export const opportunityCategoryCodeSchema = z.string().trim().min(1).max(64);

export type OpportunityCategoryOption = {
  readonly code: string;
  readonly name: string;
};

export type OpportunityRecord = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categoryName: string;
  readonly relatedTrend: {
    readonly id: string;
    readonly title: string;
    readonly lifecycleState: string;
    readonly affectedUserTypes: readonly string[];
  };
};

export type OpportunityDetailRecord = OpportunityRecord & {
  readonly opportunityType: string;
  readonly targetConsumerSummary: string | null;
  readonly competitionLevel: string | null;
  readonly competitionSummary: string | null;
};

export type OpportunityFitInputOpportunityRecord = {
  readonly id: string;
  readonly fnbCategoryId: string;
  readonly relatedTrend: {
    readonly id: string;
    readonly lifecycleState: string;
    readonly affectedUserTypes: readonly string[];
  };
};

export type OpportunityPageRequest = {
  readonly limit: number;
  readonly offset: number;
};
