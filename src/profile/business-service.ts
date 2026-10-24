import "server-only";

import type { Sequelize } from "sequelize";

import { CurrentUserNotFoundError } from "../auth/errors";
import { ONBOARDING_STATUSES, USER_TYPES, type UserId } from "../auth/user-types";
import { UserRepository, type UserProfileRepositoryPort } from "../db/repositories/user-repository";
import { getSequelize } from "../db/sequelize";
import { ReferenceRepository, type ReferenceRepositoryPort } from "../reference/repository";
import {
  BusinessProfileForbiddenError,
  BusinessProfileNotFoundError,
  BusinessProfileStateError,
  InvalidBusinessReferenceDataError,
} from "./business-errors";
import {
  BusinessProfileRepository,
  type BusinessProfileRecord,
  type BusinessProfileRepositoryPort,
  type BusinessProductValues,
  type BusinessProfileState,
} from "./business-repository";
import {
  businessProfileSchema,
  type BusinessProfileInput,
  productComparisonKey,
} from "./business-validation";

export type BusinessProfileSaveResult = {
  readonly profileVersion: number;
  readonly profileComplete: true;
};

export type BusinessProfileEditValues = BusinessProfileInput;

type BusinessProfileServiceDependencies = {
  readonly sequelize?: Sequelize;
  readonly userRepository?: UserProfileRepositoryPort;
  readonly profileRepository?: BusinessProfileRepositoryPort;
  readonly referenceRepository?: ReferenceRepositoryPort;
};

type ActiveReferences = {
  readonly categories: Awaited<ReturnType<ReferenceRepositoryPort["listActiveFnbCategories"]>>;
  readonly segments: Awaited<ReturnType<ReferenceRepositoryPort["listActiveCustomerSegments"]>>;
  readonly channels: Awaited<ReturnType<ReferenceRepositoryPort["listActiveSalesChannels"]>>;
};

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((id, index) => id === rightSorted[index]);
}

function productSemanticKey(product: BusinessProductValues): string {
  return [
    productComparisonKey(product.name),
    product.fnbCategoryId ?? "",
    product.price === null ? "" : String(product.price),
  ].join("\u0000");
}

function sameProducts(
  left: readonly BusinessProductValues[],
  right: readonly BusinessProductValues[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftKeys = left.map(productSemanticKey).sort();
  const rightKeys = right.map(productSemanticKey).sort();
  return leftKeys.every((key, index) => key === rightKeys[index]);
}

function toProductValues(input: BusinessProfileInput): readonly BusinessProductValues[] {
  return input.products.map((product) => ({
    name: product.name,
    fnbCategoryId: product.categoryId,
    price: product.price,
  }));
}

function hasSemanticChange(
  existing: BusinessProfileRecord,
  existingState: BusinessProfileState,
  input: BusinessProfileInput,
): boolean {
  return (
    existing.businessName !== input.businessName ||
    existing.businessCategoryId !== input.businessCategoryId ||
    existing.locationText !== input.location.text ||
    existing.city !== input.location.city ||
    existing.province !== input.location.province ||
    existing.district !== (input.location.district?.trim() || null) ||
    existing.subdistrict !== (input.location.subdistrict?.trim() || null) ||
    existing.averagePriceMin !== input.averagePrice.min ||
    existing.averagePriceMax !== input.averagePrice.max ||
    existing.businessDescription !== input.businessDescription ||
    !sameProducts(existingState.products, toProductValues(input)) ||
    !sameIds(existingState.customerSegmentIds, input.customerSegmentIds) ||
    !sameIds(existingState.salesChannelIds, input.salesChannelIds)
  );
}

function toProfileValues(input: BusinessProfileInput, profileVersion: number) {
  return {
    businessName: input.businessName,
    businessCategoryId: input.businessCategoryId,
    locationText: input.location.text,
    city: input.location.city,
    province: input.location.province,
    district: input.location.district?.trim() || null,
    subdistrict: input.location.subdistrict?.trim() || null,
    countryCode: "ID" as const,
    averagePriceMin: input.averagePrice.min,
    averagePriceMax: input.averagePrice.max,
    businessDescription: input.businessDescription,
    operationModel: null,
    notes: input.notes,
    profileVersion,
  };
}

function assertActiveReferences(
  input: BusinessProfileInput,
  references: ActiveReferences,
): void {
  const activeCategoryIds = new Set(references.categories.map(({ id }) => id));
  const activeSegmentIds = new Set(references.segments.map(({ id }) => id));
  const activeChannelIds = new Set(references.channels.map(({ id }) => id));
  const validCategories =
    activeCategoryIds.has(input.businessCategoryId) &&
    input.products.every(
      ({ categoryId }) => categoryId === null || activeCategoryIds.has(categoryId),
    );
  const validSegments = input.customerSegmentIds.every((id) => activeSegmentIds.has(id));
  const validChannels = input.salesChannelIds.every((id) => activeChannelIds.has(id));

  if (!validCategories || !validSegments || !validChannels) {
    throw new InvalidBusinessReferenceDataError();
  }
}

export class BusinessProfileService {
  private readonly sequelize: Sequelize;
  private readonly userRepository: UserProfileRepositoryPort;
  private readonly profileRepository: BusinessProfileRepositoryPort;
  private readonly referenceRepository: ReferenceRepositoryPort;

  constructor(dependencies: BusinessProfileServiceDependencies = {}) {
    this.sequelize = dependencies.sequelize ?? getSequelize();
    this.userRepository = dependencies.userRepository ?? new UserRepository();
    this.profileRepository = dependencies.profileRepository ?? new BusinessProfileRepository();
    this.referenceRepository = dependencies.referenceRepository ?? new ReferenceRepository();
  }

  async getForEdit(userId: UserId): Promise<BusinessProfileEditValues> {
    return this.sequelize.transaction(async (transaction) => {
      const currentUser = await this.userRepository.findById(userId, transaction);
      if (!currentUser) {
        throw new CurrentUserNotFoundError();
      }
      if (currentUser.userType === USER_TYPES.ENTREPRENEUR) {
        throw new BusinessProfileForbiddenError();
      }
      if (
        currentUser.userType !== USER_TYPES.UMKM_EXISTING ||
        currentUser.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED
      ) {
        throw new BusinessProfileStateError();
      }

      const profile = await this.profileRepository.findByUserId(userId, transaction);
      if (!profile) {
        throw new BusinessProfileNotFoundError();
      }

      const state = await this.profileRepository.loadState(profile.id, transaction);
      return businessProfileSchema.parse({
        businessName: profile.businessName,
        businessCategoryId: profile.businessCategoryId,
        location: {
          text: profile.locationText,
          city: profile.city,
          province: profile.province,
          district: profile.district,
          subdistrict: profile.subdistrict,
        },
        averagePrice: {
          min: profile.averagePriceMin,
          max: profile.averagePriceMax,
        },
        products: state.products.map(({ name, fnbCategoryId, price }) => ({
          name,
          categoryId: fnbCategoryId,
          price,
        })),
        customerSegmentIds: state.customerSegmentIds,
        salesChannelIds: state.salesChannelIds,
        businessDescription: profile.businessDescription,
        notes: profile.notes,
      });
    });
  }

  async getForOnboarding(userId: UserId): Promise<BusinessProfileEditValues | null> {
    return this.sequelize.transaction(async (transaction) => {
      const currentUser = await this.userRepository.findById(userId, transaction);
      if (!currentUser) throw new CurrentUserNotFoundError();
      if (currentUser.userType === USER_TYPES.ENTREPRENEUR) {
        throw new BusinessProfileForbiddenError();
      }
      if (currentUser.userType !== USER_TYPES.UMKM_EXISTING
        || (currentUser.onboardingStatus !== ONBOARDING_STATUSES.USER_TYPE_SELECTED
          && currentUser.onboardingStatus !== ONBOARDING_STATUSES.PROFILE_IN_PROGRESS
          && currentUser.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED)) {
        throw new BusinessProfileStateError();
      }

      const profile = await this.profileRepository.findByUserId(userId, transaction);
      if (!profile) return null;
      const state = await this.profileRepository.loadState(profile.id, transaction);
      return businessProfileSchema.parse({
        businessName: profile.businessName,
        businessCategoryId: profile.businessCategoryId,
        location: {
          text: profile.locationText,
          city: profile.city,
          province: profile.province,
          district: profile.district,
          subdistrict: profile.subdistrict,
        },
        averagePrice: { min: profile.averagePriceMin, max: profile.averagePriceMax },
        products: state.products.map(({ name, fnbCategoryId, price }) => ({ name, categoryId: fnbCategoryId, price })),
        customerSegmentIds: state.customerSegmentIds,
        salesChannelIds: state.salesChannelIds,
        businessDescription: profile.businessDescription,
        notes: profile.notes,
      });
    });
  }

  async save(input: unknown, userId: UserId): Promise<BusinessProfileSaveResult> {
    const data = businessProfileSchema.parse(input);
    const [categories, segments, channels] = await Promise.all([
      this.referenceRepository.listActiveFnbCategories(),
      this.referenceRepository.listActiveCustomerSegments(),
      this.referenceRepository.listActiveSalesChannels(),
    ]);
    assertActiveReferences(data, { categories, segments, channels });
    const products = toProductValues(data);

    return this.sequelize.transaction(async (transaction) => {
      const currentUser = await this.userRepository.findById(userId, transaction);
      if (!currentUser) {
        throw new CurrentUserNotFoundError();
      }
      if (currentUser.userType === USER_TYPES.ENTREPRENEUR) {
        throw new BusinessProfileForbiddenError();
      }
      if (currentUser.userType !== USER_TYPES.UMKM_EXISTING) {
        throw new BusinessProfileStateError();
      }

      const existingProfile = await this.profileRepository.findByUserId(userId, transaction);
      const existingState = existingProfile
        ? await this.profileRepository.loadState(existingProfile.id, transaction)
        : null;
      const profileVersion = existingProfile
        ? existingProfile.profileVersion +
          (existingState && hasSemanticChange(existingProfile, existingState, data) ? 1 : 0)
        : 1;
      const values = toProfileValues(data, profileVersion);
      const profile = existingProfile
        ? await this.profileRepository.updateProfile(existingProfile.id, values, transaction)
        : await this.profileRepository.createProfile(userId, values, transaction);

      if (!profile) {
        throw new BusinessProfileNotFoundError();
      }

      await this.profileRepository.replaceProducts(profile.id, products, transaction);
      await this.profileRepository.replaceSelectionIds(
        profile.id,
        {
          customerSegmentIds: data.customerSegmentIds,
          salesChannelIds: data.salesChannelIds,
        },
        transaction,
      );
      const updatedUser = await this.userRepository.updateOnboardingStatus(
        userId,
        ONBOARDING_STATUSES.COMPLETED,
        transaction,
      );
      if (!updatedUser) {
        throw new CurrentUserNotFoundError();
      }

      return { profileVersion: profile.profileVersion, profileComplete: true };
    });
  }
}
