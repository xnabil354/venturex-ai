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
import { CurrentUserNotFoundError } from "../auth/errors";
import type { UserProfileRepositoryPort } from "../db/repositories/user-repository";
import {
  BusinessProfileNotFoundError,
  BusinessProfileForbiddenError,
  BusinessProfileStateError,
  InvalidBusinessReferenceDataError,
} from "./business-errors";
import {
  BusinessProfileService,
} from "./business-service";
import type {
  BusinessProfileRecord,
  BusinessProfileRepositoryPort,
  BusinessProfileState,
  BusinessProfileValues,
  BusinessProductValues,
} from "./business-repository";
import type { BusinessProfileInput } from "./business-validation";
import type {
  CustomerSegmentReference,
  FnbCategoryReference,
  SalesChannelReference,
} from "../reference/types";
import type { ReferenceRepositoryPort } from "../reference/repository";

const USER_ID = parseUserId("00000000-0000-4000-8000-000000000201");
const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";
const SEGMENT_ID = "20000000-0000-4000-8000-000000000001";
const CHANNEL_ID = "30000000-0000-4000-8000-000000000001";
const PROFILE_ID = "40000000-0000-4000-8000-000000000001";

const validInput: BusinessProfileInput = {
  businessName: "Kopi Nusantara",
  businessCategoryId: CATEGORY_ID,
  location: { text: "Jakarta Pusat", city: null, province: "DKI Jakarta", district: null, subdistrict: null },
  averagePrice: { min: 20_000, max: 40_000 },
  products: [
    { name: "Kopi Susu", categoryId: CATEGORY_ID, price: 25_000 },
    { name: "Teh Lemon", categoryId: null, price: null },
  ],
  customerSegmentIds: [SEGMENT_ID],
  salesChannelIds: [CHANNEL_ID],
  businessDescription: null,
  notes: null,
};

class MemoryUserRepository implements UserProfileRepositoryPort {
  user: UserRecord = {
    id: USER_ID,
    email: "owner@example.com",
    passwordHash: "hash",
    userType: USER_TYPES.UMKM_EXISTING,
    onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  async findById(id: UserRecord["id"]): Promise<UserRecord | null> {
    return this.user.id === id ? this.user : null;
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

class MemoryBusinessProfileRepository implements BusinessProfileRepositoryPort {
  readonly lookedUpUserIds: UserRecord["id"][] = [];
  profile: BusinessProfileRecord | null = null;
  state: BusinessProfileState = {
    products: [],
    customerSegmentIds: [],
    salesChannelIds: [],
  };

  async findByUserId(userId: UserRecord["id"]): Promise<BusinessProfileRecord | null> {
    this.lookedUpUserIds.push(userId);
    return this.profile?.userId === userId ? this.profile : null;
  }

  async loadState(): Promise<BusinessProfileState> {
    return this.state;
  }

  async createProfile(
    userId: UserRecord["id"],
    values: BusinessProfileValues,
  ): Promise<BusinessProfileRecord> {
    this.profile = { id: PROFILE_ID, userId, ...values };
    return this.profile;
  }

  async updateProfile(
    _profileId: string,
    values: BusinessProfileValues,
  ): Promise<BusinessProfileRecord> {
    if (!this.profile) {
      throw new Error("profile missing");
    }
    this.profile = { ...this.profile, ...values };
    return this.profile;
  }

  async replaceProducts(
    _profileId: string,
    products: readonly BusinessProductValues[],
  ): Promise<void> {
    this.state = {
      ...this.state,
      products: products.map((product, index) => ({
        id: `50000000-0000-4000-8000-00000000000${index + 1}`,
        ...product,
        isActive: true,
      })),
    };
  }

  async replaceSelectionIds(
    _profileId: string,
    selectionIds: {
      readonly customerSegmentIds: readonly string[];
      readonly salesChannelIds: readonly string[];
    },
  ): Promise<void> {
    this.state = { ...this.state, ...selectionIds };
  }
}

function createService() {
  const userRepository = new MemoryUserRepository();
  const profileRepository = new MemoryBusinessProfileRepository();
  const service = new BusinessProfileService({
    userRepository,
    profileRepository,
    referenceRepository: new MemoryReferenceRepository(),
  });
  return { service, profileRepository, userRepository };
}

describe("BusinessProfileService", () => {
  it("creates a complete business profile and advances onboarding", async () => {
    // Given
    const { service, profileRepository, userRepository } = createService();

    // When
    const result = await service.save(validInput, USER_ID);

    // Then
    expect(result).toEqual({ profileVersion: 1, profileComplete: true });
    expect(profileRepository.state.products).toHaveLength(2);
    expect(userRepository.user.onboardingStatus).toBe(ONBOARDING_STATUSES.COMPLETED);
  });

  it("replaces products and increments version for a semantic change", async () => {
    // Given
    const { service, profileRepository } = createService();
    await service.save(validInput, USER_ID);

    // When
    const result = await service.save(
      {
        ...validInput,
        products: [{ name: "Kopi Susu Gula Aren", categoryId: null, price: 30_000 }],
      },
      USER_ID,
    );

    // Then
    expect(result.profileVersion).toBe(2);
    expect(profileRepository.state.products).toHaveLength(1);
    expect(profileRepository.state.products[0]?.name).toBe("Kopi Susu Gula Aren");
  });

  it("does not increment version for a notes-only update", async () => {
    // Given
    const { service } = createService();
    await service.save(validInput, USER_ID);

    // When
    const result = await service.save({ ...validInput, notes: "Catatan baru" }, USER_ID);

    // Then
    expect(result.profileVersion).toBe(1);
  });

  it("prefills persisted fields including nullable location names, products, and reference selections", async () => {
    // Given
    const { service } = createService();
    await service.save(validInput, USER_ID);

    // When
    const result = await service.getForEdit(USER_ID);

    // Then
    expect(result).toEqual(validInput);
    expect(result.location).toMatchObject({ district: null, subdistrict: null });
    expect(result.products).toEqual([
      { name: "Kopi Susu", categoryId: CATEGORY_ID, price: 25_000 },
      { name: "Teh Lemon", categoryId: null, price: null },
    ]);
    expect(result.customerSegmentIds).toEqual([SEGMENT_ID]);
    expect(result.salesChannelIds).toEqual([CHANNEL_ID]);
  });

  it("rejects edit reads for the wrong role and incomplete onboarding", async () => {
    // Given
    const { service, userRepository } = createService();
    await service.save(validInput, USER_ID);

    // When / Then
    userRepository.user = { ...userRepository.user, userType: USER_TYPES.ENTREPRENEUR };
    await expect(service.getForEdit(USER_ID)).rejects.toBeInstanceOf(
      BusinessProfileForbiddenError,
    );

    userRepository.user = {
      ...userRepository.user,
      onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
      userType: USER_TYPES.UMKM_EXISTING,
    };
    await expect(service.getForEdit(USER_ID)).rejects.toBeInstanceOf(BusinessProfileStateError);
  });

  it("does not return another user's business profile", async () => {
    // Given
    const { service, profileRepository, userRepository } = createService();
    await service.save(validInput, USER_ID);
    const otherUserId = parseUserId("00000000-0000-4000-8000-000000000202");
    userRepository.user = { ...userRepository.user, id: otherUserId };

    // When / Then
    await expect(service.getForEdit(otherUserId)).rejects.toBeInstanceOf(
      BusinessProfileNotFoundError,
    );
    expect(profileRepository.lookedUpUserIds).toContain(otherUserId);
    expect(profileRepository.profile?.userId).toBe(USER_ID);
  });

  it("does not increment profile version for normalized no-op values", async () => {
    // Given
    const { service } = createService();
    await service.save(validInput, USER_ID);

    // When
    const result = await service.save(
      {
        ...validInput,
        businessName: " Kopi Nusantara ",
        location: { ...validInput.location, text: " Jakarta Pusat " },
        products: [
          { name: " Teh  Lemon ", categoryId: null, price: null },
          { name: " Kopi   Susu ", categoryId: CATEGORY_ID, price: 25_000 },
        ],
        customerSegmentIds: [SEGMENT_ID, SEGMENT_ID],
        salesChannelIds: [CHANNEL_ID, CHANNEL_ID],
      },
      USER_ID,
    );

    // Then
    expect(result.profileVersion).toBe(1);
  });

  it("rejects entrepreneur users and inactive references", async () => {
    // Given
    const { service, userRepository } = createService();
    userRepository.user = { ...userRepository.user, userType: USER_TYPES.ENTREPRENEUR };

    // When / Then
    await expect(service.save(validInput, USER_ID)).rejects.toBeInstanceOf(
      BusinessProfileForbiddenError,
    );

    userRepository.user = { ...userRepository.user, userType: USER_TYPES.UMKM_EXISTING };
    await expect(
      service.save({ ...validInput, businessCategoryId: "10000000-0000-4000-8000-000000000002" }, USER_ID),
    ).rejects.toBeInstanceOf(InvalidBusinessReferenceDataError);
  });

  it("rejects an edit read when the authenticated user record is missing", async () => {
    // Given
    const { service } = createService();
    const missingUserId = parseUserId("00000000-0000-4000-8000-000000000203");

    // When / Then
    await expect(service.getForEdit(missingUserId)).rejects.toBeInstanceOf(
      CurrentUserNotFoundError,
    );
  });
});
