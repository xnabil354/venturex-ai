import { Op, type Transaction } from "sequelize";

import type {
  OnboardingStatus,
  UserId,
  UserRecord,
  UserType,
} from "../../auth/user-types";
import { ONBOARDING_STATUSES, parseUserId } from "../../auth/user-types";
import { normalizeEmail } from "../../auth/validation";
import { getUserModel, type User } from "../models/user.model";

export type CreateUserInput = {
  readonly email: string;
  readonly passwordHash: string;
  readonly userType?: UserType | null;
  readonly onboardingStatus?: OnboardingStatus;
};

export interface UserRepositoryPort {
  findById(id: UserId, transaction?: Transaction): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  setInitialUserType(id: UserId, userType: UserType): Promise<UserRecord | null>;
}

export interface UserProfileRepositoryPort {
  findById(id: UserId, transaction?: Transaction): Promise<UserRecord | null>;
  updateOnboardingStatus(
    id: UserId,
    onboardingStatus: OnboardingStatus,
    transaction: Transaction,
  ): Promise<UserRecord | null>;
}

function toUserRecord(user: User): UserRecord {
  return {
    id: parseUserId(user.id),
    email: user.email,
    passwordHash: user.passwordHash,
    userType: user.userType,
    onboardingStatus: user.onboardingStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class UserRepository implements UserRepositoryPort, UserProfileRepositoryPort {
  private readonly model: typeof User;

  constructor(model: typeof User = getUserModel()) {
    this.model = model;
  }

  async findById(
    id: UserId,
    transaction?: Transaction,
  ): Promise<UserRecord | null> {
    const user = await this.model.findByPk(id, transaction ? { transaction } : {});
    return user ? toUserRecord(user) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.model.findOne({
      where: { email: normalizeEmail(email) },
    });
    return user ? toUserRecord(user) : null;
  }

  async setInitialUserType(
    id: UserId,
    userType: UserType,
  ): Promise<UserRecord | null> {
    const [, updatedUsers] = await this.model.update(
      {
        userType,
        onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
      },
      {
        returning: true,
        where: {
          id,
          onboardingStatus: { [Op.ne]: ONBOARDING_STATUSES.COMPLETED },
        },
      },
    );

    const updatedUser = updatedUsers[0];
    return updatedUser ? toUserRecord(updatedUser) : null;
  }

  async updateOnboardingStatus(
    id: UserId,
    onboardingStatus: OnboardingStatus,
    transaction: Transaction,
  ): Promise<UserRecord | null> {
    const [, updatedUsers] = await this.model.update(
      { onboardingStatus },
      { returning: true, where: { id }, transaction },
    );

    const updatedUser = updatedUsers[0];
    return updatedUser ? toUserRecord(updatedUser) : null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user = await this.model.create({
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      userType: input.userType ?? null,
      onboardingStatus:
        input.onboardingStatus ?? ONBOARDING_STATUSES.NOT_STARTED,
    });
    return toUserRecord(user);
  }
}
