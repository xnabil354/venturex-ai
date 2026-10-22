import "server-only";

import type { Sequelize } from "sequelize";

import {
  CurrentUserNotFoundError,
} from "../auth/errors";
import { ONBOARDING_STATUSES, USER_TYPES, type UserId } from "../auth/user-types";
import {
  UserRepository,
  type UserProfileRepositoryPort,
} from "../db/repositories/user-repository";
import {
  ReferenceRepository,
  type ReferenceRepositoryPort,
} from "../reference/repository";
import {
  EntrepreneurProfileRepository,
  type EntrepreneurProfileRepositoryPort,
  type EntrepreneurProfileRecord,
  type EntrepreneurProfileSelectionIds,
  type EntrepreneurProfileValues,
} from "./repository";
import {
  EntrepreneurProfileForbiddenError,
  EntrepreneurProfileNotFoundError,
  EntrepreneurProfileStateError,
  InvalidReferenceDataError,
} from "./errors";
import {
  entrepreneurProfileEditSchema,
  entrepreneurProfileReadSchema,
  entrepreneurProfileSchema,
  type EntrepreneurProfileEditValues as ProfileEditValues,
  type EntrepreneurProfileInput,
} from "./validation";
import { getSequelize } from "../db/sequelize";

export type EntrepreneurProfileEditValues = ProfileEditValues;

export type EntrepreneurProfileSaveResult = {
  readonly profileVersion: number;
  readonly profileComplete: true;
};

type EntrepreneurProfileServiceDependencies = {
  readonly sequelize?: Sequelize;
  readonly userRepository?: UserProfileRepositoryPort;
  readonly profileRepository?: EntrepreneurProfileRepositoryPort;
  readonly referenceRepository?: ReferenceRepositoryPort;
};

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return [...left].sort().every((id, index) => id === [...right].sort()[index]);
}

function hasPersonalizationChanged(
  existing: EntrepreneurProfileRecord,
  selectionIds: EntrepreneurProfileSelectionIds,
  input: EntrepreneurProfileInput,
): boolean {
  return (
    existing.locationText !== input.location.text ||
    existing.city !== input.location.city ||
    existing.province !== input.location.province ||
    existing.district !== (input.location.district ?? null) ||
    existing.subdistrict !== (input.location.subdistrict ?? null) ||
    existing.countryCode !== input.location.countryCode ||
    existing.budgetMin !== input.budget.min ||
    existing.budgetMax !== input.budget.max ||
    existing.experienceLevel !== input.experienceLevel ||
    existing.timeCommitment !== input.timeCommitment ||
    existing.preferredProductType !== input.preferredProductType ||
    existing.businessObjective !== input.businessObjective ||
    !sameIds(selectionIds.interestCategoryIds, input.interestCategoryIds) ||
    !sameIds(selectionIds.customerSegmentIds, input.customerSegmentIds) ||
    !sameIds(selectionIds.salesChannelIds, input.salesChannelIds)
  );
}

function toProfileValues(
  input: EntrepreneurProfileInput,
  profileVersion: number,
): EntrepreneurProfileValues {
  return {
    locationText: input.location.text,
    city: input.location.city,
    province: input.location.province,
    district: input.location.district ?? null,
    subdistrict: input.location.subdistrict ?? null,
    countryCode: "ID",
    budgetMin: input.budget.min,
    budgetMax: input.budget.max,
    experienceLevel: input.experienceLevel,
    timeCommitment: input.timeCommitment,
    preferredProductType: input.preferredProductType,
    businessObjective: input.businessObjective,
    notes: input.notes,
    profileVersion,
  };
}

function toSelectionIds(input: EntrepreneurProfileInput): EntrepreneurProfileSelectionIds {
  return {
    interestCategoryIds: input.interestCategoryIds,
    customerSegmentIds: input.customerSegmentIds,
    salesChannelIds: input.salesChannelIds,
  };
}

function assertActiveReferences(
  input: EntrepreneurProfileInput,
  references: Awaited<ReturnType<ReferenceRepositoryPort["listActiveFnbCategories"]>>,
  segments: Awaited<ReturnType<ReferenceRepositoryPort["listActiveCustomerSegments"]>>,
  channels: Awaited<ReturnType<ReferenceRepositoryPort["listActiveSalesChannels"]>>,
): void {
  const activeReferenceIds = new Set(references.map(({ id }) => id));
  const activeSegmentIds = new Set(segments.map(({ id }) => id));
  const activeChannelIds = new Set(channels.map(({ id }) => id));
  const allReferencesExist = input.interestCategoryIds.every((id) => activeReferenceIds.has(id));
  const allSegmentsExist = input.customerSegmentIds.every((id) => activeSegmentIds.has(id));
  const allChannelsExist = input.salesChannelIds.every((id) => activeChannelIds.has(id));

  if (!allReferencesExist || !allSegmentsExist || !allChannelsExist) {
    throw new InvalidReferenceDataError();
  }
}

export class EntrepreneurProfileService {
  private readonly sequelize: Sequelize;
  private readonly userRepository: UserProfileRepositoryPort;
  private readonly profileRepository: EntrepreneurProfileRepositoryPort;
  private readonly referenceRepository: ReferenceRepositoryPort;

  constructor(dependencies: EntrepreneurProfileServiceDependencies = {}) {
    this.sequelize = dependencies.sequelize ?? getSequelize();
    this.userRepository = dependencies.userRepository ?? new UserRepository();
    this.profileRepository =
      dependencies.profileRepository ?? new EntrepreneurProfileRepository();
    this.referenceRepository =
      dependencies.referenceRepository ?? new ReferenceRepository();
  }

  async getForEdit(userId: UserId): Promise<EntrepreneurProfileEditValues> {
    return this.sequelize.transaction(async (transaction) => {
      const currentUser = await this.userRepository.findById(userId, transaction);
      if (!currentUser) {
        throw new CurrentUserNotFoundError();
      }
      if (currentUser.userType !== USER_TYPES.ENTREPRENEUR) {
        throw new EntrepreneurProfileForbiddenError();
      }
      if (currentUser.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
        throw new EntrepreneurProfileStateError();
      }

      const profile = await this.profileRepository.findByUserId(userId, transaction);
      if (!profile) {
        throw new EntrepreneurProfileNotFoundError();
      }

      const selections = await this.profileRepository.loadSelectionIds(profile.id, transaction);
      return entrepreneurProfileReadSchema.parse({
        location: {
          text: profile.locationText,
          city: profile.city,
          province: profile.province,
          district: profile.district,
          subdistrict: profile.subdistrict,
          countryCode: profile.countryCode,
        },
        budget: { min: profile.budgetMin, max: profile.budgetMax },
        experienceLevel: profile.experienceLevel,
        timeCommitment: profile.timeCommitment,
        interestCategoryIds: selections.interestCategoryIds,
        customerSegmentIds: selections.customerSegmentIds,
        salesChannelIds: selections.salesChannelIds,
        preferredProductType: profile.preferredProductType,
        businessObjective: profile.businessObjective,
        notes: profile.notes,
      });
    });
  }

  async save(input: unknown, userId: UserId): Promise<EntrepreneurProfileSaveResult> {
    const data = entrepreneurProfileSchema.parse(input);
    const [categories, segments, channels] = await Promise.all([
      this.referenceRepository.listActiveFnbCategories(),
      this.referenceRepository.listActiveCustomerSegments(),
      this.referenceRepository.listActiveSalesChannels(),
    ]);
    assertActiveReferences(data, categories, segments, channels);
    const selectionIds = toSelectionIds(data);

    return this.sequelize.transaction(async (transaction) => {
      const currentUser = await this.userRepository.findById(userId, transaction);
      if (!currentUser) {
        throw new CurrentUserNotFoundError();
      }
      if (currentUser.userType !== USER_TYPES.ENTREPRENEUR) {
        throw new EntrepreneurProfileForbiddenError();
      }

      const existingProfile = await this.profileRepository.findByUserId(
        userId,
        transaction,
      );
      if (!existingProfile && currentUser.onboardingStatus !== ONBOARDING_STATUSES.USER_TYPE_SELECTED) {
        throw new EntrepreneurProfileStateError();
      }

      const existingSelectionIds = existingProfile
        ? await this.profileRepository.loadSelectionIds(existingProfile.id, transaction)
        : null;
      const profileVersion = existingProfile
        ? existingProfile.profileVersion +
          (existingSelectionIds && hasPersonalizationChanged(existingProfile, existingSelectionIds, data) ? 1 : 0)
        : 1;
      const values = toProfileValues(data, profileVersion);
      const profile = existingProfile
        ? await this.profileRepository.updateProfile(existingProfile.id, values, transaction)
        : await this.profileRepository.createProfile(userId, values, transaction);

      if (!profile) {
        throw new EntrepreneurProfileNotFoundError();
      }

      await this.profileRepository.replaceSelectionIds(profile.id, selectionIds, transaction);
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
