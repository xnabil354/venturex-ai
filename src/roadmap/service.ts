import "server-only";

import type { SafeUser, UserId } from "../auth/user-types";
import { ONBOARDING_STATUSES, USER_TYPES } from "../auth/user-types";
import { getCurrentUser } from "../auth/current-user";
import { getSequelize } from "../db/sequelize";
import { generateGrowthRoadmap } from "./growth-generator";
import { generateStartupRoadmap, RoadmapInsufficientDataError } from "./generator";
import type { GrowthRoadmapProfileContext, RoadmapDetail, RoadmapPage, RoadmapProfileContext } from "./domain";
import { RoadmapRepository, type RoadmapListFilter, type RoadmapRepositoryPort } from "./repository";
import type { Transaction } from "sequelize";

export class RoadmapUnauthenticatedError extends Error {}
export class RoadmapForbiddenError extends Error {}
export class RoadmapUserIncompleteError extends Error {}
export class RoadmapProfileIncompleteError extends Error {}
export class RoadmapOpportunityNotFoundError extends Error {}
export class RoadmapAnalysisNotFoundError extends Error {}
export class RoadmapInsufficientContextError extends Error {}

export type RoadmapTransactionRunner = <T>(callback: (transaction: Transaction) => Promise<T>) => Promise<T>;

export type StartupRoadmapServiceDependencies = {
  readonly currentUserResolver?: () => Promise<SafeUser | null>;
  readonly repository?: RoadmapRepositoryPort;
  readonly transactionRunner?: RoadmapTransactionRunner;
};

function validProfile(profile: RoadmapProfileContext | null): profile is RoadmapProfileContext {
  return Boolean(
    profile &&
    profile.countryCode === "ID" &&
    profile.locationText.trim() &&
    Number.isSafeInteger(profile.budgetMin) && profile.budgetMin >= 0 &&
    Number.isSafeInteger(profile.budgetMax) && profile.budgetMax >= profile.budgetMin &&
    ["BEGINNER", "SOME_EXPERIENCE", "EXPERIENCED"].includes(profile.experienceLevel) &&
    ["LIMITED", "PART_TIME", "FULL_TIME"].includes(profile.timeCommitment) &&
    profile.interests.length > 0 && profile.customerSegments.length > 0 && profile.salesChannels.length > 0
  );
}

function validGrowthProfile(profile: GrowthRoadmapProfileContext | null): profile is GrowthRoadmapProfileContext {
  return Boolean(
    profile && profile.countryCode === "ID" && profile.businessName.trim() &&
    profile.businessCategory.trim() && profile.locationText.trim() &&
    Number.isSafeInteger(profile.averagePriceMin) && profile.averagePriceMin >= 0 &&
    Number.isSafeInteger(profile.averagePriceMax) && profile.averagePriceMax >= profile.averagePriceMin &&
    profile.products.length >= 1 && profile.products.length <= 20 && profile.products.every((product) =>
      product.name.trim() && (product.price === null || (Number.isSafeInteger(product.price) && product.price >= 0))
    ) && profile.customerSegments.length > 0 && profile.salesChannels.length > 0
  );
}

function requireStartupProfile(profile: RoadmapProfileContext | null): RoadmapProfileContext {
  if (!validProfile(profile)) throw new RoadmapProfileIncompleteError();
  return profile;
}

function requireGrowthProfile(profile: GrowthRoadmapProfileContext | null): GrowthRoadmapProfileContext {
  if (!validGrowthProfile(profile)) throw new RoadmapProfileIncompleteError();
  return profile;
}

export class StartupRoadmapService {
  private readonly currentUserResolver: () => Promise<SafeUser | null>;
  private readonly repository: RoadmapRepositoryPort;
  private readonly transactionRunner: RoadmapTransactionRunner;

  constructor(dependencies: StartupRoadmapServiceDependencies = {}) {
    this.currentUserResolver = dependencies.currentUserResolver ?? getCurrentUser;
    this.repository = dependencies.repository ?? new RoadmapRepository();
    this.transactionRunner = dependencies.transactionRunner ?? ((callback) => getSequelize().transaction(callback));
  }

  async generate(input: { readonly opportunityId: string; readonly analysisId?: string }): Promise<RoadmapDetail> {
    const user = await this.requireUser();
    if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || user.userType === null) {
      throw new RoadmapUserIncompleteError();
    }
    if (user.userType !== USER_TYPES.ENTREPRENEUR && user.userType !== USER_TYPES.UMKM_EXISTING) {
      throw new RoadmapForbiddenError();
    }

    return this.transactionRunner(async (transaction) => {
      const [profile, growthProfile, opportunity] = await Promise.all([
        user.userType === USER_TYPES.ENTREPRENEUR
          ? this.repository.loadProfileContext(user.id as UserId, transaction)
          : Promise.resolve(null),
        user.userType === USER_TYPES.UMKM_EXISTING
          ? this.repository.loadGrowthProfileContext(user.id as UserId, transaction)
          : Promise.resolve(null),
        this.repository.loadOpportunityContext(input.opportunityId, user.userType!, transaction),
      ]);
      const generationProfile = user.userType === USER_TYPES.ENTREPRENEUR
        ? { userType: USER_TYPES.ENTREPRENEUR, profile: requireStartupProfile(profile) }
        : { userType: USER_TYPES.UMKM_EXISTING, profile: requireGrowthProfile(growthProfile) };
      if (!opportunity) throw new RoadmapOpportunityNotFoundError();

      const analysis = await this.repository.findAnalysis(user.id as UserId, opportunity.id, input.analysisId, transaction);
      if (input.analysisId && !analysis) throw new RoadmapAnalysisNotFoundError();
      let generated: ReturnType<typeof generateStartupRoadmap> | ReturnType<typeof generateGrowthRoadmap>;
      try {
        if (generationProfile.userType === USER_TYPES.ENTREPRENEUR) {
          generated = generateStartupRoadmap({ profile: generationProfile.profile, opportunity, analysis });
        } else {
          generated = generateGrowthRoadmap({ profile: generationProfile.profile, opportunity, analysis });
        }
      } catch (error) {
        if (error instanceof RoadmapInsufficientDataError) throw new RoadmapInsufficientContextError();
        throw error;
      }
      return this.repository.createWithSteps({
        userId: user.id as UserId,
        roadmapType: user.userType === USER_TYPES.ENTREPRENEUR ? "STARTUP" : "GROWTH",
        opportunityId: opportunity.id,
        analysisId: analysis?.id ?? null,
        generationContext: generated.generationContext,
        steps: generated.steps,
      }, transaction);
    });
  }

  async listForCurrentUser(filter: RoadmapListFilter): Promise<RoadmapPage> {
    const user = await this.requireUser();
    return this.repository.listForUser(user.id as UserId, filter);
  }

  async getForCurrentUser(roadmapId: string): Promise<RoadmapDetail | null> {
    const user = await this.requireUser();
    return this.repository.findForUser(user.id as UserId, roadmapId);
  }

  private async requireUser(): Promise<SafeUser> {
    const user = await this.currentUserResolver();
    if (!user) throw new RoadmapUnauthenticatedError();
    return user;
  }
}
