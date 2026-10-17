import type { Transaction } from "sequelize";

import { parseUserId, type UserId } from "../auth/user-types";
import {
  getEntrepreneurProfileModel,
  type EntrepreneurProfile,
} from "./entrepreneur-profile.model";
import {
  getEntrepreneurProfileCustomerSegmentModel,
  getEntrepreneurProfileInterestModel,
  getEntrepreneurProfileSalesChannelModel,
  type EntrepreneurProfileCustomerSegment,
  type EntrepreneurProfileInterest,
  type EntrepreneurProfileSalesChannel,
} from "./entrepreneur-profile-junction.model";
import { initializeProfileAssociations } from "./associations";

export type EntrepreneurProfileValues = {
  readonly locationText: string;
  readonly city: string | null;
  readonly province: string | null;
  readonly district: string | null;
  readonly subdistrict: string | null;
  readonly countryCode: "ID";
  readonly budgetMin: number;
  readonly budgetMax: number;
  readonly experienceLevel: string;
  readonly timeCommitment: string;
  readonly preferredProductType: string | null;
  readonly businessObjective: string | null;
  readonly notes: string | null;
  readonly profileVersion: number;
};

export type EntrepreneurProfileRecord = EntrepreneurProfileValues & {
  readonly id: string;
  readonly userId: UserId;
};

export type EntrepreneurProfileDashboardRecord = {
  readonly id: string;
  readonly userId: UserId;
  readonly locationText: string;
  readonly city: string | null;
  readonly province: string | null;
  readonly countryCode: "ID";
  readonly budgetMin: number;
  readonly budgetMax: number;
  readonly experienceLevel: string;
  readonly timeCommitment: string;
  readonly preferredProductType: string | null;
};

export type EntrepreneurProfileSelectionIds = {
  readonly interestCategoryIds: readonly string[];
  readonly customerSegmentIds: readonly string[];
  readonly salesChannelIds: readonly string[];
};

export interface EntrepreneurProfileRepositoryPort {
  findByUserId(
    userId: UserId,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileRecord | null>;
  loadSelectionIds(
    profileId: string,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileSelectionIds>;
  createProfile(
    userId: UserId,
    values: EntrepreneurProfileValues,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileRecord>;
  updateProfile(
    profileId: string,
    values: EntrepreneurProfileValues,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileRecord | null>;
  replaceSelectionIds(
    profileId: string,
    selectionIds: EntrepreneurProfileSelectionIds,
    transaction: Transaction,
  ): Promise<void>;
}

export interface EntrepreneurProfileDashboardRepositoryPort {
  findDashboardByUserId(
    userId: UserId,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileDashboardRecord | null>;
  loadSelectionIds(
    profileId: string,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileSelectionIds>;
}

function toProfileRecord(profile: EntrepreneurProfile): EntrepreneurProfileRecord {
  return {
    id: profile.id,
    userId: parseUserId(profile.userId),
    locationText: profile.locationText,
    city: profile.city,
    province: profile.province,
    district: profile.district,
    subdistrict: profile.subdistrict,
    countryCode: "ID",
    budgetMin: Number(profile.budgetMin),
    budgetMax: Number(profile.budgetMax),
    experienceLevel: profile.experienceLevel,
    timeCommitment: profile.timeCommitment,
    preferredProductType: profile.preferredProductType,
    businessObjective: profile.businessObjective,
    notes: profile.notes,
    profileVersion: profile.profileVersion,
  };
}

export class EntrepreneurProfileRepository
  implements EntrepreneurProfileRepositoryPort, EntrepreneurProfileDashboardRepositoryPort
{
  private readonly profileModel: typeof EntrepreneurProfile;
  private readonly interestModel: typeof EntrepreneurProfileInterest;
  private readonly customerSegmentModel: typeof EntrepreneurProfileCustomerSegment;
  private readonly salesChannelModel: typeof EntrepreneurProfileSalesChannel;

  constructor() {
    this.profileModel = getEntrepreneurProfileModel();
    this.interestModel = getEntrepreneurProfileInterestModel();
    this.customerSegmentModel = getEntrepreneurProfileCustomerSegmentModel();
    this.salesChannelModel = getEntrepreneurProfileSalesChannelModel();
    initializeProfileAssociations();
  }

  async findByUserId(
    userId: UserId,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileRecord | null> {
    const profile = await this.profileModel.findOne({
      where: { userId },
      transaction,
    });
    return profile ? toProfileRecord(profile) : null;
  }

  async findDashboardByUserId(
    userId: UserId,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileDashboardRecord | null> {
    const profile = await this.profileModel.findOne({
      attributes: [
        "id",
        "userId",
        "locationText",
        "city",
        "province",
        "countryCode",
        "budgetMin",
        "budgetMax",
        "experienceLevel",
        "timeCommitment",
        "preferredProductType",
      ],
      where: { userId },
      transaction,
    });

    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      userId: parseUserId(profile.userId),
      locationText: profile.locationText,
      city: profile.city,
      province: profile.province,
      countryCode: "ID",
      budgetMin: Number(profile.budgetMin),
      budgetMax: Number(profile.budgetMax),
      experienceLevel: profile.experienceLevel,
      timeCommitment: profile.timeCommitment,
      preferredProductType: profile.preferredProductType,
    };
  }

  async loadSelectionIds(
    profileId: string,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileSelectionIds> {
    const interests = await this.interestModel.findAll({
      attributes: ["fnbCategoryId"],
      where: { entrepreneurProfileId: profileId },
      transaction,
    });
    const customerSegments = await this.customerSegmentModel.findAll({
      attributes: ["customerSegmentId"],
      where: { entrepreneurProfileId: profileId },
      transaction,
    });
    const salesChannels = await this.salesChannelModel.findAll({
      attributes: ["salesChannelId"],
      where: { entrepreneurProfileId: profileId },
      transaction,
    });

    return {
      interestCategoryIds: interests.map(({ fnbCategoryId }) => fnbCategoryId),
      customerSegmentIds: customerSegments.map(
        ({ customerSegmentId }) => customerSegmentId,
      ),
      salesChannelIds: salesChannels.map(({ salesChannelId }) => salesChannelId),
    };
  }

  async createProfile(
    userId: UserId,
    values: EntrepreneurProfileValues,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileRecord> {
    const profile = await this.profileModel.create({ userId, ...values }, { transaction });
    return toProfileRecord(profile);
  }

  async updateProfile(
    profileId: string,
    values: EntrepreneurProfileValues,
    transaction: Transaction,
  ): Promise<EntrepreneurProfileRecord | null> {
    const [, profiles] = await this.profileModel.update(values, {
      returning: true,
      where: { id: profileId },
      transaction,
    });
    const profile = profiles[0];
    return profile ? toProfileRecord(profile) : null;
  }

  async replaceSelectionIds(
    profileId: string,
    selectionIds: EntrepreneurProfileSelectionIds,
    transaction: Transaction,
  ): Promise<void> {
    await this.interestModel.destroy({ where: { entrepreneurProfileId: profileId }, transaction });
    await this.customerSegmentModel.destroy({ where: { entrepreneurProfileId: profileId }, transaction });
    await this.salesChannelModel.destroy({ where: { entrepreneurProfileId: profileId }, transaction });

    await this.interestModel.bulkCreate(
      selectionIds.interestCategoryIds.map((fnbCategoryId) => ({
        entrepreneurProfileId: profileId,
        fnbCategoryId,
      })),
      { transaction },
    );
    await this.customerSegmentModel.bulkCreate(
      selectionIds.customerSegmentIds.map((customerSegmentId) => ({
        entrepreneurProfileId: profileId,
        customerSegmentId,
      })),
      { transaction },
    );
    await this.salesChannelModel.bulkCreate(
      selectionIds.salesChannelIds.map((salesChannelId) => ({
        entrepreneurProfileId: profileId,
        salesChannelId,
      })),
      { transaction },
    );
  }
}
