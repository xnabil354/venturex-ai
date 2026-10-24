import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  EmailAlreadyExistsError,
  UserTypeAlreadyActiveError,
  UserTypeAlreadySelectedError,
  UserTypeSwitchNotAllowedError,
} from "./errors";
import { AuthService } from "./service";
import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  parseUserId,
  type UserRecord,
  type UserType,
} from "./user-types";
import { normalizeEmail, type RegistrationInput } from "./validation";
import type {
  CreateUserInput,
  UserRepositoryPort,
} from "../db/repositories/user-repository";

class MemoryUserRepository implements UserRepositoryPort {
  private user: UserRecord | null;

  constructor(user: UserRecord | null = null) {
    this.user = user;
  }

  async findById(): Promise<UserRecord | null> {
    return this.user;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.user?.email === normalizeEmail(email) ? this.user : null;
  }

  async setInitialUserType(
    id: UserRecord["id"],
    userType: UserType,
  ): Promise<UserRecord | null> {
    if (!this.user || this.user.id !== id || this.user.userType !== null) {
      return null;
    }

    this.user = {
      ...this.user,
      userType,
      onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
      updatedAt: new Date(),
    };
    return this.user;
  }

  async switchUserType(
    id: UserRecord["id"],
    userType: UserType,
  ): Promise<UserRecord | null> {
    if (!this.user || this.user.id !== id || this.user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || this.user.userType === userType) {
      return null;
    }
    this.user = { ...this.user, userType, onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED, updatedAt: new Date() };
    return this.user;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const now = new Date();
    const user: UserRecord = {
      id: parseUserId("00000000-0000-4000-8000-000000000001"),
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      userType: input.userType ?? null,
      onboardingStatus: input.onboardingStatus ?? "NOT_STARTED",
      createdAt: now,
      updatedAt: now,
    };
    this.user = user;
    return user;
  }
}

const registration: RegistrationInput = {
  email: "  USER@example.com ",
  password: "StrongPassword",
  passwordConfirmation: "StrongPassword",
};

describe("AuthService", () => {
  it("normalizes email and returns a DTO without passwordHash", async () => {
    // Given
    const service = new AuthService(new MemoryUserRepository());

    // When
    const user = await service.register(registration);

    // Then
    expect(user.email).toBe("user@example.com");
    expect(user.onboardingStatus).toBe("NOT_STARTED");
    expect("passwordHash" in user).toBe(false);
  });

  it("selects an initial user type and advances onboarding", async () => {
    // Given
    const repository = new MemoryUserRepository({
      id: parseUserId("00000000-0000-4000-8000-000000000003"),
      email: "founder@example.com",
      passwordHash: "stored-hash",
      userType: null,
      onboardingStatus: ONBOARDING_STATUSES.NOT_STARTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const service = new AuthService(repository);

    // When
    const user = await service.selectInitialUserType(
      { userType: USER_TYPES.ENTREPRENEUR },
      parseUserId("00000000-0000-4000-8000-000000000003"),
    );

    // Then
    expect(user.userType).toBe(USER_TYPES.ENTREPRENEUR);
    expect(user.onboardingStatus).toBe(ONBOARDING_STATUSES.USER_TYPE_SELECTED);
    expect("passwordHash" in user).toBe(false);
  });

  it("rejects a second user type selection", async () => {
    // Given
    const existingUser: UserRecord = {
      id: parseUserId("00000000-0000-4000-8000-000000000004"),
      email: "owner@example.com",
      passwordHash: "stored-hash",
      userType: USER_TYPES.UMKM_EXISTING,
      onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = new AuthService(new MemoryUserRepository(existingUser));

    // When / Then
    await expect(
      service.selectInitialUserType(
        { userType: USER_TYPES.ENTREPRENEUR },
        existingUser.id,
      ),
    ).rejects.toBeInstanceOf(UserTypeAlreadySelectedError);
  });

  it("rejects an invalid user type at the service boundary", async () => {
    // Given
    const service = new AuthService(new MemoryUserRepository());

    // When / Then
    await expect(
      service.selectInitialUserType(
        { userType: "INVALID" },
        parseUserId("00000000-0000-4000-8000-000000000005"),
      ),
    ).rejects.toThrow();
  });

  it("rejects an existing email", async () => {
    // Given
    const existingUser: UserRecord = {
      id: parseUserId("00000000-0000-4000-8000-000000000002"),
      email: "user@example.com",
      passwordHash: "stored-hash",
      userType: null,
      onboardingStatus: "NOT_STARTED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = new AuthService(new MemoryUserRepository(existingUser));

    // When / Then
    await expect(service.register(registration)).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
  });

  it("switches a completed account and sends it back to target onboarding", async () => {
    const existingUser: UserRecord = {
      id: parseUserId("00000000-0000-4000-8000-000000000006"),
      email: "owner@example.com",
      passwordHash: "stored-hash",
      userType: USER_TYPES.ENTREPRENEUR,
      onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = new AuthService(new MemoryUserRepository(existingUser));

    const user = await service.switchUserType({ userType: USER_TYPES.UMKM_EXISTING }, existingUser.id);

    expect(user.userType).toBe(USER_TYPES.UMKM_EXISTING);
    expect(user.onboardingStatus).toBe(ONBOARDING_STATUSES.USER_TYPE_SELECTED);
  });

  it("does not switch an incomplete account or the already active persona", async () => {
    const incomplete: UserRecord = {
      id: parseUserId("00000000-0000-4000-8000-000000000007"),
      email: "incomplete@example.com",
      passwordHash: "stored-hash",
      userType: USER_TYPES.ENTREPRENEUR,
      onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await expect(new AuthService(new MemoryUserRepository(incomplete)).switchUserType({ userType: USER_TYPES.UMKM_EXISTING }, incomplete.id)).rejects.toBeInstanceOf(UserTypeSwitchNotAllowedError);
    const completed: UserRecord = { ...incomplete, onboardingStatus: ONBOARDING_STATUSES.COMPLETED };
    await expect(new AuthService(new MemoryUserRepository(completed)).switchUserType({ userType: USER_TYPES.ENTREPRENEUR }, completed.id)).rejects.toBeInstanceOf(UserTypeAlreadyActiveError);
  });
});
