import type { SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";
import type { OpportunityEvidenceAvailability } from "./opportunity-evidence-availability";

export const OPPORTUNITY_ANALYSIS_CONTEXT_VERSION = "opportunity-analysis-v5" as const;
export const OPPORTUNITY_ANALYSIS_PROMPT_VERSION = "opportunity-profile-searchapi-hybrid-v20" as const;
export const OPPORTUNITY_ANALYSIS_CONTEXT_MAX_BYTES = 10_000;

export type OpportunityQueryIntent =
  | "BRAND_OR_NAVIGATIONAL"
  | "PRODUCT"
  | "PRICE_RELATED"
  | "LOCATION_OR_LOCAL_INTENT"
  | "RECIPE_OR_INFORMATIONAL"
  | "PURCHASE_OR_TRANSACTIONAL_CANDIDATE"
  | "UNKNOWN_OR_AMBIGUOUS";

export type OpportunityLocationContext = Readonly<{ text: string; city: string | null; province: string | null }>;

export type EntrepreneurOpportunityProfileContext = Readonly<{
  persona: "ENTREPRENEUR";
  preferredProductType: string | null;
  categories: readonly string[];
  customerSegments: readonly string[];
  salesChannels: readonly string[];
  budget: Readonly<{ min: number; max: number; currency: "IDR" }>;
  location: OpportunityLocationContext | null;
  experienceLevel: "BEGINNER" | "SOME_EXPERIENCE" | "EXPERIENCED" | null;
  timeCommitment: "LIMITED" | "PART_TIME" | "FULL_TIME" | null;
  businessObjective: string | null;
  notes: string | null;
}>;

export type ExistingBusinessOpportunityProfileContext = Readonly<{
  persona: "UMKM_EXISTING";
  businessName: string;
  businessCategory: string;
  businessDescription: string | null;
  location: OpportunityLocationContext | null;
  averagePrice: Readonly<{ min: number; max: number; currency: "IDR" }>;
  products: readonly Readonly<{ name: string; category: string | null; price: number | null }>[];
  customerSegments: readonly string[];
  salesChannels: readonly string[];
  notes: string | null;
}>;

export type OpportunityProfileContext = EntrepreneurOpportunityProfileContext | ExistingBusinessOpportunityProfileContext;

export type OpportunityProfileField =
  | "profile.preferredProductType" | "profile.categories" | "profile.customerSegments"
  | "profile.salesChannels" | "profile.budget" | "profile.location" | "profile.experienceLevel"
  | "profile.timeCommitment" | "profile.businessObjective" | "profile.notes" | "profile.businessName"
  | "profile.businessCategory" | "profile.businessDescription" | "profile.averagePrice" | "profile.products"
  | "profile.products[].category" | "profile.products[].price";

export type OpportunityProfileAvailability = Readonly<{
  profileFieldsPresent: readonly OpportunityProfileField[];
  profileFieldsMissing: readonly OpportunityProfileField[];
}>;

export type OpportunityProfileReference = Readonly<{
  id: string;
  profileField: OpportunityProfileField;
  metric: "BUDGET" | "AVERAGE_BUSINESS_PRICE" | "PRODUCT_PRICE" | null;
  subjectCategory: "BUSINESS" | "PRODUCT_SET" | "EXISTING_PRODUCT" | "PROFILE_FIELD";
  subjectId: string;
}>;

export type BuiltOpportunityProfileContext = Readonly<{
  profile: OpportunityProfileContext;
  dataAvailability: OpportunityProfileAvailability;
}>;

export type OpportunityAnalysisContext = Readonly<{
  contextVersion: typeof OPPORTUNITY_ANALYSIS_CONTEXT_VERSION;
  profile: OpportunityProfileContext;
  profileReferenceCatalog: readonly OpportunityProfileReference[];
  evidence: Readonly<{
    sourceId: string;
    sourceType: SearchApiOpportunityEvidence["sourceType"];
    provider: "SearchApi.io";
    publisher: "Google Trends";
    parentKeyword: string;
    selectedQuery: string;
    queryIntentCandidate: OpportunityQueryIntent;
    position: number;
    interestIndex: number | null;
    growthLabel: string | null;
    growthPercent: number | null;
    isBreakout: boolean;
    geographicCode: SearchApiOpportunityEvidence["geo"];
    geographicScope: string;
    timeFilter: string;
    searchProperty: SearchApiOpportunityEvidence["searchProperty"];
    retrievedAt: string;
    expiresAt: string;
    sourceUrl: string;
    providerSourceUrl: string | null;
    freshness: "CURRENT";
    ownershipVerified: true;
  }>;
  dataAvailability: OpportunityProfileAvailability & Readonly<{ evidenceLimitations: readonly string[] }>;
  financialEvidenceAvailability: OpportunityEvidenceAvailability;
}>;

export type OpportunityProfileContextErrorCode = "PROFILE_INCOMPLETE" | "PROFILE_CONTEXT_TOO_LARGE" | "CONFIGURATION_UNAVAILABLE";

export class OpportunityProfileContextError extends Error {
  override readonly name = "OpportunityProfileContextError";
  constructor(readonly code: OpportunityProfileContextErrorCode) {
    super("The persisted profile cannot be used as a bounded opportunity context.");
  }
}
