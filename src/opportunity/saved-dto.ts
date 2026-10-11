import type { OpportunityListItemDto } from "./dto";

export type SavedOpportunityListResult =
  | { readonly status: "AVAILABLE"; readonly items: readonly OpportunityListItemDto[] }
  | { readonly status: "EMPTY"; readonly items: readonly [] }
  | { readonly status: "ERROR" };

export type OpportunitySaveState =
  | { readonly status: "AVAILABLE"; readonly saved: boolean }
  | { readonly status: "ERROR" };

export type SavedOpportunityActionState = {
  readonly status: "IDLE" | "SUCCESS" | "ERROR";
  readonly saved: boolean;
  readonly message: string | null;
};
