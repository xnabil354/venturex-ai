import { z } from "zod";

export const USER_TYPES = {
  ENTREPRENEUR: "ENTREPRENEUR",
  UMKM_EXISTING: "UMKM_EXISTING",
} as const;

export type UserType = (typeof USER_TYPES)[keyof typeof USER_TYPES];

export function isUserType(value: unknown): value is UserType {
  return value === USER_TYPES.ENTREPRENEUR || value === USER_TYPES.UMKM_EXISTING;
}

export const ONBOARDING_STATUSES = {
  NOT_STARTED: "NOT_STARTED",
  USER_TYPE_SELECTED: "USER_TYPE_SELECTED",
  PROFILE_IN_PROGRESS: "PROFILE_IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export type OnboardingStatus =
  (typeof ONBOARDING_STATUSES)[keyof typeof ONBOARDING_STATUSES];

export const userIdSchema = z.string().uuid().brand<"UserId">();
export type UserId = z.infer<typeof userIdSchema>;

export function parseUserId(value: string): UserId {
  return userIdSchema.parse(value);
}

export type UserRecord = {
  readonly id: UserId;
  readonly email: string;
  readonly passwordHash: string;
  readonly userType: UserType | null;
  readonly onboardingStatus: OnboardingStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SafeUser = Omit<
  UserRecord,
  "passwordHash" | "createdAt" | "updatedAt"
>;

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    email: user.email,
    userType: user.userType,
    onboardingStatus: user.onboardingStatus,
  };
}