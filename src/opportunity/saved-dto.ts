import { z } from "zod";

import type { OpportunityListItemDto } from "./dto";

export const SAVED_OPPORTUNITY_DEFAULT_PAGE_SIZE = 20;
export const SAVED_OPPORTUNITY_MAX_PAGE_SIZE = 100;

export const savedOpportunityPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  pageSize: z.coerce.number().int().min(1).max(SAVED_OPPORTUNITY_MAX_PAGE_SIZE).default(SAVED_OPPORTUNITY_DEFAULT_PAGE_SIZE),
  sort: z.literal("createdAt").default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export type SavedOpportunityPageQuery = z.infer<typeof savedOpportunityPageQuerySchema>;

export type SavedOpportunityPageResult = {
  readonly status: "AVAILABLE" | "EMPTY";
  readonly items: readonly OpportunityListItemDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly sort: "createdAt";
  readonly order: "asc" | "desc";
};

export type SavedOpportunityWriteResult = {
  readonly saved: true;
  readonly created: boolean;
};

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
