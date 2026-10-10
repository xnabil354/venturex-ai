import type { OpportunityFitInputOpportunityRecord } from "./domain";

export type OpportunityFitRequirementInput = {
  readonly capitalMin: string | null;
  readonly capitalMax: string | null;
  readonly expectedPriceMin: string | null;
  readonly expectedPriceMax: string | null;
  readonly requiredExperienceLevel: string | null;
  readonly requiredTimeCommitment: string | null;
  readonly operationalComplexity: string | null;
  readonly locationScope: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly updatedAt: Date;
};

export type EntrepreneurFitProfileInput = {
  readonly profileVersion: number;
  readonly locationText: string;
  readonly city: string | null;
  readonly province: string | null;
  readonly budgetMin: number;
  readonly budgetMax: number;
  readonly preferredProductType: string | null;
  readonly experienceLevel: string;
  readonly timeCommitment: string;
  readonly interestCategoryIds: readonly string[];
  readonly customerSegmentIds: readonly string[];
  readonly salesChannelIds: readonly string[];
};

export type BusinessProductFitInput = {
  readonly fnbCategoryId: string | null;
  readonly price: number | null;
};

export type BusinessFitProfileInput = {
  readonly profileVersion: number;
  readonly businessCategoryId: string;
  readonly locationText: string;
  readonly city: string | null;
  readonly province: string | null;
  readonly averagePriceMin: number;
  readonly averagePriceMax: number;
  readonly businessDescription: string | null;
  readonly operationModel: string | null;
  readonly products: readonly BusinessProductFitInput[];
  readonly customerSegmentIds: readonly string[];
  readonly salesChannelIds: readonly string[];
};

export type OpportunityFitInputOpportunity = OpportunityFitInputOpportunityRecord & {
  readonly requirements: OpportunityFitRequirementInput | null;
  readonly customerSegmentIds: readonly string[];
  readonly salesChannelIds: readonly string[];
};

export type OpportunityFitInputContext =
  | {
      readonly userType: "ENTREPRENEUR";
      readonly opportunity: OpportunityFitInputOpportunity;
      readonly profile: EntrepreneurFitProfileInput | null;
    }
  | {
      readonly userType: "UMKM_EXISTING";
      readonly opportunity: OpportunityFitInputOpportunity;
      readonly profile: BusinessFitProfileInput | null;
    };
