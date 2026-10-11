import "server-only";

import type { Transaction } from "sequelize";

import { getCurrentUser as defaultCurrentUserResolver } from "../auth/current-user";
import { ONBOARDING_STATUSES, USER_TYPES, type SafeUser, type UserType } from "../auth/user-types";
import { getSequelize } from "../db/sequelize";
import type {
  BusinessProfileDashboardRecord,
  BusinessProfileDashboardRepositoryPort,
  BusinessProfileDashboardState,
} from "../profile/business-repository";
import { BusinessProfileRepository } from "../profile/business-repository";
import type {
  EntrepreneurProfileDashboardRecord,
  EntrepreneurProfileDashboardRepositoryPort,
  EntrepreneurProfileSelectionIds,
} from "../profile/repository";
import { EntrepreneurProfileRepository } from "../profile/repository";
import { ReferenceRepository, type ReferenceRepositoryPort } from "../reference/repository";
import type {
  CustomerSegmentReference,
  FnbCategoryReference,
  SalesChannelReference,
} from "../reference/types";
import type { OpportunityListItemDto } from "../opportunity/dto";
import { OpportunityService, type OpportunityFinderResult } from "../opportunity/service";
import { TrendService } from "../trend/service";
import type { TrendDto } from "../trend/dto";
import { SavedOpportunityService } from "../opportunity/saved-service";
import {
  DASHBOARD_MODULE_STATUSES,
  createUnavailableDashboardModules,
  type DashboardTrendModuleState,
  type DashboardTrendPreview,
  type DashboardSavedOpportunityModuleState,
  type DashboardSavedOpportunityPreview,
  type DashboardOpportunityModuleState,
  type DashboardOpportunityPreview,
  type DashboardDto,
  type DashboardLocation,
  type DashboardReference,
} from "./dto";

export class DashboardUnauthenticatedError extends Error {
  override readonly name = "DashboardUnauthenticatedError";

  constructor() {
    super("Authentication required.");
  }
}

export class DashboardIncompleteUserError extends Error {
  override readonly name = "DashboardIncompleteUserError";

  constructor() {
    super("Dashboard hanya tersedia setelah onboarding selesai.");
  }
}

export class DashboardProfileNotFoundError extends Error {
  override readonly name = "DashboardProfileNotFoundError";

  constructor(readonly userType: UserType) {
    super("Data profile Dashboard tidak dapat dimuat.");
  }
}

export class DashboardReferenceDataError extends Error {
  override readonly name = "DashboardReferenceDataError";

  constructor() {
    super("Reference data Dashboard tidak dapat dimuat.");
  }
}

type TransactionRunner = <T>(
  callback: (transaction: Transaction) => Promise<T>,
) => Promise<T>;

type DashboardTrendService = Pick<TrendService, "getPublishedTrends">;
type DashboardTrendServiceFactory = (user: SafeUser) => DashboardTrendService;
type DashboardSavedOpportunityService = Pick<SavedOpportunityService, "listForCurrentUser">;
type DashboardSavedOpportunityServiceFactory = (user: SafeUser) => DashboardSavedOpportunityService;
type DashboardOpportunityService = Pick<OpportunityService, "list">;
type DashboardOpportunityServiceFactory = (user: SafeUser) => DashboardOpportunityService;

const DASHBOARD_TREND_PREVIEW_LIMIT = 3;
const DASHBOARD_SAVED_OPPORTUNITY_PREVIEW_LIMIT = 3;
const DASHBOARD_OPPORTUNITY_PREVIEW_LIMIT = 3;

export type DashboardQueryServiceDependencies = {
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
  readonly entrepreneurRepository?: EntrepreneurProfileDashboardRepositoryPort;
  readonly businessRepository?: BusinessProfileDashboardRepositoryPort;
  readonly referenceRepository?: ReferenceRepositoryPort;
  readonly transactionRunner?: TransactionRunner;
  readonly trendServiceFactory?: DashboardTrendServiceFactory;
  readonly savedOpportunityServiceFactory?: DashboardSavedOpportunityServiceFactory;
  readonly opportunityServiceFactory?: DashboardOpportunityServiceFactory;
};

type DashboardReferenceRecord = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
};

function mapReferenceLabels<T extends DashboardReferenceRecord>(
  selectedIds: readonly string[],
  references: readonly T[],
): readonly DashboardReference[] {
  const referencesById = new Map(references.map((reference) => [reference.id, reference]));
  const labels: DashboardReference[] = [];

  for (const selectedId of selectedIds) {
    const reference = referencesById.get(selectedId);
    if (reference) {
      labels.push({ code: reference.code, name: reference.name });
    }
  }

  return labels.sort((left, right) => left.code.localeCompare(right.code));
}

function mapReferenceLabel(
  id: string,
  references: readonly DashboardReferenceRecord[],
): DashboardReference {
  const reference = references.find((candidate) => candidate.id === id);
  if (!reference) {
    throw new DashboardReferenceDataError();
  }

  return { code: reference.code, name: reference.name };
}

function mapLocation(profile: {
  readonly locationText: string;
  readonly city: string | null;
  readonly province: string | null;
  readonly countryCode: "ID";
}): DashboardLocation {
  return {
    text: profile.locationText,
    city: profile.city,
    province: profile.province,
    countryCode: profile.countryCode,
  };
}

function mapDashboardTrendPreview(trend: TrendDto): DashboardTrendPreview {
  return {
    id: trend.id,
    title: trend.title,
    categoryName: trend.category.name,
    summary: trend.signal.summary,
  };
}

function buildDashboardTrendState(
  trends: readonly TrendDto[],
  userType: UserType,
): DashboardTrendModuleState {
  const eligibleTrends = trends
    .filter(
      (trend) =>
        trend.lifecycleState === "PUBLISHED" && trend.affectedUserTypes.includes(userType),
    )
    .sort((left, right) => {
      const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
      return createdAtOrder || left.id.localeCompare(right.id);
    })
    .slice(0, DASHBOARD_TREND_PREVIEW_LIMIT);
  const preview = eligibleTrends.map(mapDashboardTrendPreview);

  return {
    status: preview.length > 0 ? DASHBOARD_MODULE_STATUSES.AVAILABLE : DASHBOARD_MODULE_STATUSES.EMPTY,
    preview,
  };
}

function buildTrendErrorState(): DashboardTrendModuleState {
  return { status: DASHBOARD_MODULE_STATUSES.ERROR, preview: [] };
}

function mapDashboardSavedOpportunityPreview(
  opportunity: OpportunityListItemDto,
): DashboardSavedOpportunityPreview {
  return {
    id: opportunity.id,
    name: opportunity.name,
    categoryName: opportunity.categoryName,
    summary: opportunity.summary,
  };
}

function buildDashboardSavedOpportunityState(
  opportunities: readonly OpportunityListItemDto[],
): DashboardSavedOpportunityModuleState {
  const preview = opportunities
    .slice(0, DASHBOARD_SAVED_OPPORTUNITY_PREVIEW_LIMIT)
    .map(mapDashboardSavedOpportunityPreview);

  return {
    status: preview.length > 0 ? DASHBOARD_MODULE_STATUSES.AVAILABLE : DASHBOARD_MODULE_STATUSES.EMPTY,
    preview,
  };
}

function buildSavedOpportunityErrorState(): DashboardSavedOpportunityModuleState {
  return { status: DASHBOARD_MODULE_STATUSES.ERROR, preview: [] };
}

function mapDashboardOpportunityPreview(
  opportunity: OpportunityListItemDto,
): DashboardOpportunityPreview {
  return {
    id: opportunity.id,
    name: opportunity.name,
    categoryName: opportunity.categoryName,
    summary: opportunity.summary,
    relatedTrendTitle: opportunity.relatedTrend.title,
  };
}

function buildDashboardOpportunityState(
  result: OpportunityFinderResult,
): DashboardOpportunityModuleState {
  if (!("items" in result)) {
    return { status: result.status, preview: [] };
  }

  const preview = result.items
    .slice(0, DASHBOARD_OPPORTUNITY_PREVIEW_LIMIT)
    .map(mapDashboardOpportunityPreview);

  return {
    status: preview.length > 0 ? DASHBOARD_MODULE_STATUSES.AVAILABLE : DASHBOARD_MODULE_STATUSES.EMPTY,
    preview,
  };
}

function buildOpportunityErrorState(): DashboardOpportunityModuleState {
  return { status: DASHBOARD_MODULE_STATUSES.ERROR, preview: [] };
}

function buildEntrepreneurDto(
  profile: EntrepreneurProfileDashboardRecord,
  selections: EntrepreneurProfileSelectionIds,
  references: {
    readonly categories: readonly FnbCategoryReference[];
    readonly segments: readonly CustomerSegmentReference[];
    readonly channels: readonly SalesChannelReference[];
  },
): DashboardDto {
  return {
    userType: USER_TYPES.ENTREPRENEUR,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
    profile: {
      location: mapLocation(profile),
      budget: { min: profile.budgetMin, max: profile.budgetMax },
      experienceLevel: profile.experienceLevel,
      timeCommitment: profile.timeCommitment,
      preferredProductType: profile.preferredProductType,
      interests: mapReferenceLabels(selections.interestCategoryIds, references.categories),
      customerSegments: mapReferenceLabels(selections.customerSegmentIds, references.segments),
      salesChannels: mapReferenceLabels(selections.salesChannelIds, references.channels),
    },
    modules: createUnavailableDashboardModules(),
  };
}

function buildBusinessDto(
  profile: BusinessProfileDashboardRecord,
  state: BusinessProfileDashboardState,
  references: {
    readonly categories: readonly FnbCategoryReference[];
    readonly segments: readonly CustomerSegmentReference[];
    readonly channels: readonly SalesChannelReference[];
  },
): DashboardDto {
  return {
    userType: USER_TYPES.UMKM_EXISTING,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
    profile: {
      businessName: profile.businessName,
      businessCategory: mapReferenceLabel(profile.businessCategoryId, references.categories),
      location: mapLocation(profile),
      averagePrice: { min: profile.averagePriceMin, max: profile.averagePriceMax },
      productCount: state.productCount,
      customerSegments: mapReferenceLabels(state.customerSegmentIds, references.segments),
      salesChannels: mapReferenceLabels(state.salesChannelIds, references.channels),
    },
    modules: createUnavailableDashboardModules(),
  };
}

export class DashboardQueryService {
  private readonly currentUserResolver: () => Promise<SafeUser | null>;
  private readonly entrepreneurRepository: EntrepreneurProfileDashboardRepositoryPort;
  private readonly businessRepository: BusinessProfileDashboardRepositoryPort;
  private readonly referenceRepository: ReferenceRepositoryPort;
  private readonly transactionRunner: TransactionRunner;
  private readonly trendServiceFactory: DashboardTrendServiceFactory;
  private readonly savedOpportunityServiceFactory: DashboardSavedOpportunityServiceFactory;
  private readonly opportunityServiceFactory: DashboardOpportunityServiceFactory;

  constructor(dependencies: DashboardQueryServiceDependencies = {}) {
    this.currentUserResolver = dependencies.currentUserResolver ?? defaultCurrentUserResolver;
    this.entrepreneurRepository =
      dependencies.entrepreneurRepository ?? new EntrepreneurProfileRepository();
    this.businessRepository = dependencies.businessRepository ?? new BusinessProfileRepository();
    this.referenceRepository = dependencies.referenceRepository ?? new ReferenceRepository();
    this.transactionRunner =
      dependencies.transactionRunner ?? ((callback) => getSequelize().transaction(callback));
    this.trendServiceFactory =
      dependencies.trendServiceFactory ?? ((user) => new TrendService(undefined, async () => user));
    this.savedOpportunityServiceFactory =
      dependencies.savedOpportunityServiceFactory ??
      ((user) => new SavedOpportunityService({ currentUserResolver: async () => user }));
    this.opportunityServiceFactory =
      dependencies.opportunityServiceFactory ??
      ((user) => new OpportunityService({ currentUserResolver: async () => user }));
  }

  async get(): Promise<DashboardDto> {
    const currentUser = await this.currentUserResolver();
    if (!currentUser) {
      throw new DashboardUnauthenticatedError();
    }

    const { userType, onboardingStatus } = currentUser;
    if (onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || userType === null) {
      throw new DashboardIncompleteUserError();
    }

    const dashboard = await this.transactionRunner(async (transaction) => {
      if (userType === USER_TYPES.ENTREPRENEUR) {
        const profile = await this.entrepreneurRepository.findDashboardByUserId(
          currentUser.id,
          transaction,
        );
        if (!profile) {
          throw new DashboardProfileNotFoundError(userType);
        }

        const referencesPromise = Promise.all([
          this.referenceRepository.listActiveFnbCategories(),
          this.referenceRepository.listActiveCustomerSegments(),
          this.referenceRepository.listActiveSalesChannels(),
        ]);
        const [selections, [categories, segments, channels]] = await Promise.all([
          this.entrepreneurRepository.loadSelectionIds(profile.id, transaction),
          referencesPromise,
        ]);

        return buildEntrepreneurDto(profile, selections, { categories, segments, channels });
      }

      const profile = await this.businessRepository.findDashboardByUserId(
        currentUser.id,
        transaction,
      );
      if (!profile) {
        throw new DashboardProfileNotFoundError(userType);
      }

      const referencesPromise = Promise.all([
        this.referenceRepository.listActiveFnbCategories(),
        this.referenceRepository.listActiveCustomerSegments(),
        this.referenceRepository.listActiveSalesChannels(),
      ]);
      const [state, [categories, segments, channels]] = await Promise.all([
        this.businessRepository.loadDashboardState(profile.id, transaction),
        referencesPromise,
      ]);

      return buildBusinessDto(profile, state, { categories, segments, channels });
    });

    const [trendState, savedOpportunityState, opportunityState] = await Promise.all([
      this.loadTrendState(currentUser, userType),
      this.loadSavedOpportunityState(currentUser),
      this.loadOpportunityState(currentUser),
    ]);

    return {
      ...dashboard,
      modules: {
        ...dashboard.modules,
        trends: trendState,
        savedOpportunities: savedOpportunityState,
        opportunities: opportunityState,
      },
    };
  }

  private async loadTrendState(
    currentUser: SafeUser,
    userType: UserType,
  ): Promise<DashboardTrendModuleState> {
    try {
      const trends = await this.trendServiceFactory(currentUser).getPublishedTrends();
      return buildDashboardTrendState(trends, userType);
    } catch {
      return buildTrendErrorState();
    }
  }

  private async loadSavedOpportunityState(
    currentUser: SafeUser,
  ): Promise<DashboardSavedOpportunityModuleState> {
    try {
      const result = await this.savedOpportunityServiceFactory(currentUser).listForCurrentUser(
        DASHBOARD_SAVED_OPPORTUNITY_PREVIEW_LIMIT,
      );
      if (result.status === "ERROR") return buildSavedOpportunityErrorState();
      return buildDashboardSavedOpportunityState(result.items);
    } catch {
      return buildSavedOpportunityErrorState();
    }
  }

  private async loadOpportunityState(
    currentUser: SafeUser,
  ): Promise<DashboardOpportunityModuleState> {
    try {
      const result = await this.opportunityServiceFactory(currentUser).list(1);
      return buildDashboardOpportunityState(result);
    } catch {
      return buildOpportunityErrorState();
    }
  }
}

export async function getDashboardContext(): Promise<DashboardDto> {
  return new DashboardQueryService().get();
}
