import { ONBOARDING_STATUSES, USER_TYPES } from "../auth/user-types";

export const DASHBOARD_MODULE_STATUSES = {
  AVAILABLE: "AVAILABLE",
  EMPTY: "EMPTY",
  UNAVAILABLE: "UNAVAILABLE",
  ERROR: "ERROR",
} as const;

export type DashboardModuleStatus =
  (typeof DASHBOARD_MODULE_STATUSES)[keyof typeof DASHBOARD_MODULE_STATUSES];

export type DashboardModuleState = {
  readonly status: DashboardModuleStatus;
};

export type DashboardTrendPreview = {
  readonly href?: string;
  readonly id: string;
  readonly title: string;
  readonly categoryName: string;
  readonly summary: string;
};

export type DashboardTrendModuleState = DashboardModuleState & {
  readonly context?: string;
  readonly observedAt?: string;
  readonly preview: readonly DashboardTrendPreview[];
};

export type DashboardSavedOpportunityPreview = {
  readonly href?: string;
  readonly generatedAt?: string;
  readonly id: string;
  readonly name: string;
  readonly categoryName: string;
  readonly summary: string;
};

export type DashboardSavedOpportunityModuleState = DashboardModuleState & {
  readonly preview: readonly DashboardSavedOpportunityPreview[];
};

export type DashboardOpportunityPreview = {
  readonly href?: string;
  readonly generatedAt?: string;
  readonly id: string;
  readonly name: string;
  readonly categoryName: string;
  readonly summary: string;
  readonly relatedTrendTitle: string;
};

export type DashboardOpportunityModuleState = DashboardModuleState & {
  readonly preview: readonly DashboardOpportunityPreview[];
};

export type DashboardModules = {
  readonly trends: DashboardTrendModuleState;
  readonly opportunities: DashboardOpportunityModuleState;
  readonly savedOpportunities: DashboardSavedOpportunityModuleState;
  readonly roadmap: DashboardModuleState;
};

export type DashboardReference = {
  readonly code: string;
  readonly name: string;
};

export type DashboardLocation = {
  readonly text: string;
  readonly city: string | null;
  readonly province: string | null;
  readonly countryCode: "ID";
};

export type DashboardMoneyRange = {
  readonly min: number;
  readonly max: number;
};

type DashboardDtoBase = {
  readonly onboardingStatus: typeof ONBOARDING_STATUSES.COMPLETED;
  readonly modules: DashboardModules;
};

export type EntrepreneurDashboardDto = DashboardDtoBase & {
  readonly userType: typeof USER_TYPES.ENTREPRENEUR;
  readonly profile: {
    readonly location: DashboardLocation;
    readonly budget: DashboardMoneyRange;
    readonly experienceLevel: string;
    readonly timeCommitment: string;
    readonly preferredProductType: string | null;
    readonly interests: readonly DashboardReference[];
    readonly customerSegments: readonly DashboardReference[];
    readonly salesChannels: readonly DashboardReference[];
  };
};

export type UmkmDashboardDto = DashboardDtoBase & {
  readonly userType: typeof USER_TYPES.UMKM_EXISTING;
  readonly profile: {
    readonly businessName: string;
    readonly businessCategory: DashboardReference;
    readonly location: DashboardLocation;
    readonly averagePrice: DashboardMoneyRange;
    readonly productCount: number;
    readonly customerSegments: readonly DashboardReference[];
    readonly salesChannels: readonly DashboardReference[];
  };
};

export type DashboardDto = EntrepreneurDashboardDto | UmkmDashboardDto;

export function createUnavailableDashboardModules(): DashboardModules {
  const status: DashboardModuleState = {
    status: DASHBOARD_MODULE_STATUSES.UNAVAILABLE,
  };

  return {
    trends: { ...status, preview: [] },
    opportunities: { ...status, preview: [] },
    savedOpportunities: { ...status, preview: [] },
    roadmap: status,
  };
}
