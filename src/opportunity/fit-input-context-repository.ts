import "server-only";

import type { Transaction } from "sequelize";

import { getOpportunityCustomerSegmentModel } from "../db/models/opportunity-customer-segment.model";
import {
  getOpportunityFitRequirementModel,
  type OpportunityFitRequirement,
} from "../db/models/opportunity-fit-requirement.model";
import { getOpportunitySalesChannelModel } from "../db/models/opportunity-sales-channel.model";
import { getSequelize } from "../db/sequelize";
import {
  BusinessProfileRepository,
  type BusinessProfileRepositoryPort,
} from "../profile/business-repository";
import {
  EntrepreneurProfileRepository,
  type EntrepreneurProfileRepositoryPort,
} from "../profile/repository";
import { initializeOpportunityFitAssociations } from "./fit-associations";
import { OpportunityRepository } from "./repository";
import type {
  OpportunityFitInputContext,
  OpportunityFitInputOpportunity,
  OpportunityFitRequirementInput,
} from "./fit-input-context";
import type { OpportunityFitInputOpportunityRecord } from "./domain";
import type { UserId, UserType } from "../auth/user-types";

export interface OpportunityFitInputContextRepositoryPort {
  findForUser(
    userId: UserId,
    userType: UserType,
    opportunityId: string,
  ): Promise<OpportunityFitInputContext | null>;
}

type OpportunityFitInputOpportunityRepositoryPort = Pick<
  OpportunityRepository,
  "findVisibleForFitInput"
>;

type OpportunityFitInputContextRepositoryDependencies = {
  readonly opportunityRepository?: OpportunityFitInputOpportunityRepositoryPort;
  readonly requirementModel?: typeof OpportunityFitRequirement;
  readonly opportunityCustomerSegmentModel?: ReturnType<typeof getOpportunityCustomerSegmentModel>;
  readonly opportunitySalesChannelModel?: ReturnType<typeof getOpportunitySalesChannelModel>;
  readonly entrepreneurProfileRepository?: Pick<
    EntrepreneurProfileRepositoryPort,
    "findByUserId" | "loadSelectionIds"
  >;
  readonly businessProfileRepository?: Pick<
    BusinessProfileRepositoryPort,
    "findByUserId" | "loadState"
  >;
  readonly transactionRunner?: <T>(work: (transaction: Transaction) => Promise<T>) => Promise<T>;
};

function toRequirementInput(
  requirement: OpportunityFitRequirement | null,
): OpportunityFitRequirementInput | null {
  if (!requirement) return null;

  return {
    capitalMin: requirement.capitalMin,
    capitalMax: requirement.capitalMax,
    expectedPriceMin: requirement.expectedPriceMin,
    expectedPriceMax: requirement.expectedPriceMax,
    requiredExperienceLevel: requirement.requiredExperienceLevel,
    requiredTimeCommitment: requirement.requiredTimeCommitment,
    operationalComplexity: requirement.operationalComplexity,
    locationScope: requirement.locationScope,
    metadata: requirement.metadata,
    updatedAt: requirement.updatedAt,
  };
}

function runReadTransaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
  return getSequelize().transaction(work);
}

export class OpportunityFitInputContextRepository implements OpportunityFitInputContextRepositoryPort {
  private readonly opportunityRepository: OpportunityFitInputOpportunityRepositoryPort;
  private readonly requirementModel: typeof OpportunityFitRequirement;
  private readonly opportunityCustomerSegmentModel: ReturnType<typeof getOpportunityCustomerSegmentModel>;
  private readonly opportunitySalesChannelModel: ReturnType<typeof getOpportunitySalesChannelModel>;
  private readonly entrepreneurProfileRepository: Pick<
    EntrepreneurProfileRepositoryPort,
    "findByUserId" | "loadSelectionIds"
  >;
  private readonly businessProfileRepository: Pick<
    BusinessProfileRepositoryPort,
    "findByUserId" | "loadState"
  >;
  private readonly transactionRunner: <T>(work: (transaction: Transaction) => Promise<T>) => Promise<T>;

  constructor(dependencies: OpportunityFitInputContextRepositoryDependencies = {}) {
    this.opportunityRepository = dependencies.opportunityRepository ?? new OpportunityRepository();
    this.requirementModel = dependencies.requirementModel ?? getOpportunityFitRequirementModel();
    this.opportunityCustomerSegmentModel =
      dependencies.opportunityCustomerSegmentModel ?? getOpportunityCustomerSegmentModel();
    this.opportunitySalesChannelModel =
      dependencies.opportunitySalesChannelModel ?? getOpportunitySalesChannelModel();
    this.entrepreneurProfileRepository =
      dependencies.entrepreneurProfileRepository ?? new EntrepreneurProfileRepository();
    this.businessProfileRepository =
      dependencies.businessProfileRepository ?? new BusinessProfileRepository();
    this.transactionRunner = dependencies.transactionRunner ?? runReadTransaction;

    initializeOpportunityFitAssociations();
  }

  async findForUser(
    userId: UserId,
    userType: UserType,
    opportunityId: string,
  ): Promise<OpportunityFitInputContext | null> {
    return this.transactionRunner(async (transaction) => {
      const opportunity = await this.opportunityRepository.findVisibleForFitInput(
        userType,
        opportunityId,
        transaction,
      );
      if (!opportunity) return null;

      const [requirement, segmentRows, channelRows] = await Promise.all([
        this.requirementModel.findByPk(opportunity.id, { transaction }),
        this.opportunityCustomerSegmentModel.findAll({
          attributes: ["customerSegmentId"],
          where: { opportunityId: opportunity.id },
          order: [["customerSegmentId", "ASC"]],
          transaction,
        }),
        this.opportunitySalesChannelModel.findAll({
          attributes: ["salesChannelId"],
          where: { opportunityId: opportunity.id },
          order: [["salesChannelId", "ASC"]],
          transaction,
        }),
      ]);

      const opportunityInput: OpportunityFitInputOpportunity = {
        ...opportunity,
        requirements: toRequirementInput(requirement),
        customerSegmentIds: segmentRows.map(({ customerSegmentId }) => customerSegmentId),
        salesChannelIds: channelRows.map(({ salesChannelId }) => salesChannelId),
      };

      if (userType === "ENTREPRENEUR") {
        return {
          userType,
          opportunity: opportunityInput,
          profile: await this.loadEntrepreneurProfile(userId, transaction),
        };
      }

      return {
        userType,
        opportunity: opportunityInput,
        profile: await this.loadBusinessProfile(userId, transaction),
      };
    });
  }

  private async loadEntrepreneurProfile(userId: UserId, transaction: Transaction) {
    const profile = await this.entrepreneurProfileRepository.findByUserId(userId, transaction);
    if (!profile) return null;

    const selections = await this.entrepreneurProfileRepository.loadSelectionIds(profile.id, transaction);
    return {
      profileVersion: profile.profileVersion,
      locationText: profile.locationText,
      city: profile.city,
      province: profile.province,
      budgetMin: profile.budgetMin,
      budgetMax: profile.budgetMax,
      preferredProductType: profile.preferredProductType,
      experienceLevel: profile.experienceLevel,
      timeCommitment: profile.timeCommitment,
      interestCategoryIds: selections.interestCategoryIds,
      customerSegmentIds: selections.customerSegmentIds,
      salesChannelIds: selections.salesChannelIds,
    };
  }

  private async loadBusinessProfile(userId: UserId, transaction: Transaction) {
    const profile = await this.businessProfileRepository.findByUserId(userId, transaction);
    if (!profile) return null;

    const state = await this.businessProfileRepository.loadState(profile.id, transaction);
    return {
      profileVersion: profile.profileVersion,
      businessCategoryId: profile.businessCategoryId,
      locationText: profile.locationText,
      city: profile.city,
      province: profile.province,
      averagePriceMin: profile.averagePriceMin,
      averagePriceMax: profile.averagePriceMax,
      businessDescription: profile.businessDescription,
      operationModel: profile.operationModel,
      products: state.products
        .filter(({ isActive }) => isActive)
        .map(({ fnbCategoryId, price }) => ({ fnbCategoryId, price })),
      customerSegmentIds: state.customerSegmentIds,
      salesChannelIds: state.salesChannelIds,
    };
  }
}
