import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../db/sequelize", () => ({
  getSequelize: () => ({
    transaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback(null),
  }),
}));

import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  parseUserId,
  type UserRecord,
} from "../auth/user-types";
import type { UserProfileRepositoryPort } from "../db/repositories/user-repository";
import type {
  EntrepreneurProfileRecord,
  EntrepreneurProfileRepositoryPort,
  EntrepreneurProfileSelectionIds,
} from "./repository";
import type { ReferenceRepositoryPort } from "../reference/repository";
import type {
  CustomerSegmentReference,
  FnbCategoryReference,
  SalesChannelReference,
} from "../reference/types";
import { EntrepreneurProfileService } from "./service";
import { EntrepreneurProfileForbiddenError, InvalidReferenceDataError } from "./errors";
import type { EntrepreneurProfileInput } from "./validation";

const USER_ID = parseUserId("00000000-0000-4000-8000-000000000101");
const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";
const SEGMENT_ID = "20000000-0000-4000-8000-000000000001";
const CHANNEL_ID = "30000000-0000-4000-8000-000000000001";

const validInput: EntrepreneurProfileInput = {
  location: {
    text: "Jakarta Pusat",
    city: "Jakarta Pusat",
    province: "DKI Jakarta",
    district: "Menteng",
    subdistrict: "Pegangsaan",
    countryCode: "ID",
  },
  budget: { min: 5_000_000, max: 10_000_000 },
  experienceLevel: "BEGINNER",
  timeCommitment: "PART_TIME",
  interestCategoryIds: [CATEGORY_ID],
  customerSegmentIds: [SEGMENT_ID],
  salesChannelIds: [CHANNEL_ID],
  preferredProductType: "Beverage",
  businessObjective: "Membangun usaha minuman.",
  notes: null,
};

class MemoryUserRepository implements UserProfileRepositoryPort {
  user: UserRecord = {
    id: USER_ID,
    email: "founder@example.com",
    passwordHash: "hash",
    userType: USER_TYPES.ENTREPRENEUR,
    onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  async findById(): Promise<UserRecord> {
    return this.user;
  }

  async updateOnboardingStatus(
    _id: UserRecord["id"],
    onboardingStatus: UserRecord["onboardingStatus"],
  ): Promise<UserRecord> {
    this.user = { ...this.user, onboardingStatus };
    return this.user;
  }
}

class MemoryReferenceRepository implements ReferenceRepositoryPort {
  readonly categories: readonly FnbCategoryReference[] = [
    { id: CATEGORY_ID, code: "BEVERAGES", name: "Minuman", parentId: null },
  ];
  readonly segments: readonly CustomerSegmentReference[] = [
    { id: SEGMENT_ID, code: "STUDENTS", name: "Pelajar dan mahasiswa", description: null },
  ];
  readonly channels: readonly SalesChannelReference[] = [
    { id: CHANNEL_ID, code: "OFFLINE_STORE", name: "Gerai atau toko offline" },
  ];

  async listActiveFnbCategories(): Promise<readonly FnbCategoryReference[]> {
    return this.categories;
  }

  async listActiveCustomerSegments(): Promise<readonly CustomerSegmentReference[]> {
    return this.segments;
  }

  async listActiveSalesChannels(): Promise<readonly SalesChannelReference[]> {
    return this.channels;
  }
}

class MemoryProfileRepository implements EntrepreneurProfileRepositoryPort {
  profile: EntrepreneurProfileRecord | null = null;
  selections: EntrepreneurProfileSelectionIds = {
    interestCategoryIds: [],
    customerSegmentIds: [],
    salesChannelIds: [],
  };

  async findByUserId(): Promise<EntrepreneurProfileRecord | null> {
    return this.profile;
  }

  async loadSelectionIds(): Promise<EntrepreneurProfileSelectionIds> {
    return this.selections;
  }

  async createProfile(
    userId: UserRecord["id"],
    values: Omit<EntrepreneurProfileRecord, "id" | "userId">,
  ): Promise<EntrepreneurProfileRecord> {
    this.profile = {
      id: "40000000-0000-4000-8000-000000000001",
      userId,
      ...values,
    };
    return this.profile;
  }

  async updateProfile(
    _profileId: string,
    values: Omit<EntrepreneurProfileRecord, "id" | "userId">,
  ): Promise<EntrepreneurProfileRecord> {
    if (!this.profile) {
      throw new Error("profile missing");
    }
    this.profile = { ...this.profile, ...values };
    return this.profile;
  }

  async replaceSelectionIds(
    _profileId: string,
    selectionIds: EntrepreneurProfileSelectionIds,
  ): Promise<void> {
    this.selections = selectionIds;
  }
}

function createService(
  userRepository = new MemoryUserRepository(),
  profileRepository = new MemoryProfileRepository(),
) {
  return {
    service: new EntrepreneurProfileService({
      userRepository,
      profileRepository,
      referenceRepository: new MemoryReferenceRepository(),
    }),
    profileRepository,
    userRepository,
  };
}

describe("EntrepreneurProfileService", () => {
  it("creates a complete profile and advances onboarding", async () => {
    // Given
    const { service, profileRepository, userRepository } = createService();

    // When
    const result = await service.save(validInput, USER_ID);

    // Then
    expect(result).toEqual({ profileVersion: 1, profileComplete: true });
    expect(profileRepository.profile?.budgetMin).toBe(5_000_000);
    expect(userRepository.user.onboardingStatus).toBe(ONBOARDING_STATUSES.COMPLETED);
  });

  it("rejects a non-entrepreneur user", async () => {
    // Given
    const userRepository = new MemoryUserRepository();
    userRepository.user = { ...userRepository.user, userType: USER_TYPES.UMKM_EXISTING };
    const { service } = createService(userRepository);

    // When / Then
    await expect(service.save(validInput, USER_ID)).rejects.toBeInstanceOf(
      EntrepreneurProfileForbiddenError,
    );
  });

  it("rejects an inactive or unknown reference id", async () => {
    // Given
    const { service } = createService();

    // When / Then
    await expect(
      service.save({ ...validInput, interestCategoryIds: ["50000000-0000-4000-8000-000000000001"] }, USER_ID),
    ).rejects.toBeInstanceOf(InvalidReferenceDataError);
  });

  it("deduplicates and sorts selection ids before persistence", async () => {
    // Given
    const { service, profileRepository } = createService();

    // When
    await service.save(
      {
        ...validInput,
        interestCategoryIds: [CATEGORY_ID, CATEGORY_ID],
        customerSegmentIds: [SEGMENT_ID, SEGMENT_ID],
        salesChannelIds: [CHANNEL_ID, CHANNEL_ID],
      },
      USER_ID,
    );

    // Then
    expect(profileRepository.selections).toEqual({
      interestCategoryIds: [CATEGORY_ID],
      customerSegmentIds: [SEGMENT_ID],
      salesChannelIds: [CHANNEL_ID],
    });
  });

  it("does not increment version for notes-only or reordered-set updates", async () => {
    // Given
    const { service } = createService();
    await service.save(validInput, USER_ID);

    // When
    const result = await service.save(
      {
        ...validInput,
        notes: "Catatan baru",
        interestCategoryIds: [CATEGORY_ID, CATEGORY_ID],
        customerSegmentIds: [SEGMENT_ID, SEGMENT_ID],
        salesChannelIds: [CHANNEL_ID, CHANNEL_ID],
      },
      USER_ID,
    );

    // Then
    expect(result.profileVersion).toBe(1);
  });

  it("increments version for a personalization change", async () => {
    // Given
    const { service } = createService();
    await service.save(validInput, USER_ID);

    // When
    const result = await service.save(
      { ...validInput, budget: { min: 7_000_000, max: 12_000_000 } },
      USER_ID,
    );

    // Then
    expect(result.profileVersion).toBe(2);
  });

  it("loads the persisted profile fields and reference selections for editing", async () => {
    const { service } = createService();
    await service.save(validInput, USER_ID);

    await expect(service.getForEdit(USER_ID)).resolves.toEqual(validInput);
  });

  it("rejects profile prefill for a non-entrepreneur", async () => {
    const userRepository = new MemoryUserRepository();
    userRepository.user = { ...userRepository.user, userType: USER_TYPES.UMKM_EXISTING };
    const { service } = createService(userRepository);

    await expect(service.getForEdit(USER_ID)).rejects.toBeInstanceOf(
      EntrepreneurProfileForbiddenError,
    );
  });

  it("rejects profile prefill until onboarding is complete", async () => {
    const userRepository = new MemoryUserRepository();
    userRepository.user = {
      ...userRepository.user,
      onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
    };
    const { service } = createService(userRepository);

    await expect(service.getForEdit(USER_ID)).rejects.toThrow("Status profile entrepreneur tidak valid.");
  });
});
