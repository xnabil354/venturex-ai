import type { Transaction } from "sequelize";

import { parseUserId, type UserId } from "../auth/user-types";
import { initializeProfileAssociations } from "./associations";
import {
  getBusinessProductModel,
  type BusinessProduct,
} from "./business-product.model";
import {
  getBusinessProfileModel,
  type BusinessProfile,
} from "./business-profile.model";
import {
  getBusinessProfileCustomerSegmentModel,
  getBusinessProfileSalesChannelModel,
  type BusinessProfileCustomerSegment,
  type BusinessProfileSalesChannel,
} from "./business-profile-junction.model";

export type BusinessProductValues = {
  readonly name: string;
  readonly fnbCategoryId: string | null;
  readonly price: number | null;
};

export type BusinessProfileValues = {
  readonly businessName: string;
  readonly businessCategoryId: string;
  readonly locationText: string;
  readonly city: string | null;
  readonly province: string | null;
  readonly district: string | null;
  readonly subdistrict: string | null;
  readonly countryCode: "ID";
  readonly averagePriceMin: number;
  readonly averagePriceMax: number;
  readonly businessDescription: string | null;
  readonly operationModel: null;
  readonly notes: string | null;
  readonly profileVersion: number;
};

export type BusinessProductRecord = BusinessProductValues & {
  readonly id: string;
  readonly isActive: boolean;
};

export type BusinessProfileRecord = BusinessProfileValues & {
  readonly id: string;
  readonly userId: UserId;
};

export type BusinessProfileDashboardRecord = {
  readonly id: string;
  readonly userId: UserId;
  readonly businessName: string;
  readonly businessCategoryId: string;
  readonly locationText: string;
  readonly city: string | null;
  readonly province: string | null;
  readonly countryCode: "ID";
  readonly averagePriceMin: number;
  readonly averagePriceMax: number;
};

export type BusinessProfileSelectionIds = {
  readonly customerSegmentIds: readonly string[];
  readonly salesChannelIds: readonly string[];
};

export type BusinessProfileState = {
  readonly products: readonly BusinessProductRecord[];
  readonly customerSegmentIds: readonly string[];
  readonly salesChannelIds: readonly string[];
};

export type BusinessProfileDashboardState = {
  readonly productCount: number;
  readonly customerSegmentIds: readonly string[];
  readonly salesChannelIds: readonly string[];
};

export interface BusinessProfileRepositoryPort {
  findByUserId(
    userId: UserId,
    transaction: Transaction,
  ): Promise<BusinessProfileRecord | null>;
  loadState(
    profileId: string,
    transaction: Transaction,
  ): Promise<BusinessProfileState>;
  createProfile(
    userId: UserId,
    values: BusinessProfileValues,
    transaction: Transaction,
  ): Promise<BusinessProfileRecord>;
  updateProfile(
    profileId: string,
    values: BusinessProfileValues,
    transaction: Transaction,
  ): Promise<BusinessProfileRecord | null>;
  replaceProducts(
    profileId: string,
    products: readonly BusinessProductValues[],
    transaction: Transaction,
  ): Promise<void>;
  replaceSelectionIds(
    profileId: string,
    selectionIds: BusinessProfileSelectionIds,
    transaction: Transaction,
  ): Promise<void>;
}

export interface BusinessProfileDashboardRepositoryPort {
  findDashboardByUserId(
    userId: UserId,
    transaction: Transaction,
  ): Promise<BusinessProfileDashboardRecord | null>;
  loadDashboardState(
    profileId: string,
    transaction: Transaction,
  ): Promise<BusinessProfileDashboardState>;
}

function toProfileRecord(profile: BusinessProfile): BusinessProfileRecord {
  return {
    id: profile.id,
    userId: parseUserId(profile.userId),
    businessName: profile.businessName,
    businessCategoryId: profile.businessCategoryId,
    locationText: profile.locationText,
    city: profile.city,
    province: profile.province,
    district: profile.district,
    subdistrict: profile.subdistrict,
    countryCode: "ID",
    averagePriceMin: Number(profile.averagePriceMin),
    averagePriceMax: Number(profile.averagePriceMax),
    businessDescription: profile.businessDescription,
    operationModel: null,
    notes: profile.notes,
    profileVersion: profile.profileVersion,
  };
}

function toProductRecord(product: BusinessProduct): BusinessProductRecord {
  return {
    id: product.id,
    name: product.name,
    fnbCategoryId: product.fnbCategoryId,
    price: product.price === null ? null : Number(product.price),
    isActive: product.isActive,
  };
}

export class BusinessProfileRepository
  implements BusinessProfileRepositoryPort, BusinessProfileDashboardRepositoryPort {
  private readonly profileModel: typeof BusinessProfile;
  private readonly productModel: typeof BusinessProduct;
  private readonly customerSegmentModel: typeof BusinessProfileCustomerSegment;
  private readonly salesChannelModel: typeof BusinessProfileSalesChannel;

  constructor() {
    this.profileModel = getBusinessProfileModel();
    this.productModel = getBusinessProductModel();
    this.customerSegmentModel = getBusinessProfileCustomerSegmentModel();
    this.salesChannelModel = getBusinessProfileSalesChannelModel();
    initializeProfileAssociations();
  }

  async findByUserId(
    userId: UserId,
    transaction: Transaction,
  ): Promise<BusinessProfileRecord | null> {
    const profile = await this.profileModel.findOne({
      where: { userId },
      transaction,
    });
    return profile ? toProfileRecord(profile) : null;
  }

  async findDashboardByUserId(
    userId: UserId,
    transaction: Transaction,
  ): Promise<BusinessProfileDashboardRecord | null> {
    const profile = await this.profileModel.findOne({
      attributes: [
        "id",
        "userId",
        "businessName",
        "businessCategoryId",
        "locationText",
        "city",
        "province",
        "countryCode",
        "averagePriceMin",
        "averagePriceMax",
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
      businessName: profile.businessName,
      businessCategoryId: profile.businessCategoryId,
      locationText: profile.locationText,
      city: profile.city,
      province: profile.province,
      countryCode: "ID",
      averagePriceMin: Number(profile.averagePriceMin),
      averagePriceMax: Number(profile.averagePriceMax),
    };
  }

  async loadState(
    profileId: string,
    transaction: Transaction,
  ): Promise<BusinessProfileState> {
    const [products, customerSegments, salesChannels] = await Promise.all([
      this.productModel.findAll({
        where: { businessProfileId: profileId },
        order: [["name", "ASC"], ["id", "ASC"]],
        transaction,
      }),
      this.customerSegmentModel.findAll({
        attributes: ["customerSegmentId"],
        where: { businessProfileId: profileId },
        order: [["customerSegmentId", "ASC"]],
        transaction,
      }),
      this.salesChannelModel.findAll({
        attributes: ["salesChannelId"],
        where: { businessProfileId: profileId },
        order: [["salesChannelId", "ASC"]],
        transaction,
      }),
    ]);

    return {
      products: products.map(toProductRecord),
      customerSegmentIds: customerSegments.map(({ customerSegmentId }) => customerSegmentId),
      salesChannelIds: salesChannels.map(({ salesChannelId }) => salesChannelId),
    };
  }

  async loadDashboardState(
    profileId: string,
    transaction: Transaction,
  ): Promise<BusinessProfileDashboardState> {
    const [productCount, customerSegments, salesChannels] = await Promise.all([
      this.productModel.count({
        where: { businessProfileId: profileId, isActive: true },
        transaction,
      }),
      this.customerSegmentModel.findAll({
        attributes: ["customerSegmentId"],
        where: { businessProfileId: profileId },
        order: [["customerSegmentId", "ASC"]],
        transaction,
      }),
      this.salesChannelModel.findAll({
        attributes: ["salesChannelId"],
        where: { businessProfileId: profileId },
        order: [["salesChannelId", "ASC"]],
        transaction,
      }),
    ]);

    return {
      productCount,
      customerSegmentIds: customerSegments.map(({ customerSegmentId }) => customerSegmentId),
      salesChannelIds: salesChannels.map(({ salesChannelId }) => salesChannelId),
    };
  }

  async createProfile(
    userId: UserId,
    values: BusinessProfileValues,
    transaction: Transaction,
  ): Promise<BusinessProfileRecord> {
    const profile = await this.profileModel.create(
      { userId, ...values },
      { transaction },
    );
    return toProfileRecord(profile);
  }

  async updateProfile(
    profileId: string,
    values: BusinessProfileValues,
    transaction: Transaction,
  ): Promise<BusinessProfileRecord | null> {
    const [, profiles] = await this.profileModel.update(values, {
      returning: true,
      where: { id: profileId },
      transaction,
    });
    const profile = profiles[0];
    return profile ? toProfileRecord(profile) : null;
  }

  async replaceProducts(
    profileId: string,
    products: readonly BusinessProductValues[],
    transaction: Transaction,
  ): Promise<void> {
    await this.productModel.destroy({
      where: { businessProfileId: profileId },
      transaction,
    });
    await this.productModel.bulkCreate(
      products.map((product) => ({
        businessProfileId: profileId,
        ...product,
        isActive: true,
      })),
      { transaction },
    );
  }

  async replaceSelectionIds(
    profileId: string,
    selectionIds: BusinessProfileSelectionIds,
    transaction: Transaction,
  ): Promise<void> {
    await this.customerSegmentModel.destroy({
      where: { businessProfileId: profileId },
      transaction,
    });
    await this.salesChannelModel.destroy({
      where: { businessProfileId: profileId },
      transaction,
    });

    await this.customerSegmentModel.bulkCreate(
      selectionIds.customerSegmentIds.map((customerSegmentId) => ({
        businessProfileId: profileId,
        customerSegmentId,
      })),
      { transaction },
    );
    await this.salesChannelModel.bulkCreate(
      selectionIds.salesChannelIds.map((salesChannelId) => ({
        businessProfileId: profileId,
        salesChannelId,
      })),
      { transaction },
    );
  }
}
