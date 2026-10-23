import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
} from "sequelize";

import type { UserOpportunityAnalysis } from "./user-opportunity-analysis.model";
import type {
  OnboardingStatus,
  UserId,
  UserType,
} from "../../auth/user-types";
import { ONBOARDING_STATUSES } from "../../auth/user-types";
import { getSequelize } from "../sequelize";

declare global {
  var __venturexUserModel: typeof User | undefined;
}

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<UserId>;
  declare email: string;
  declare passwordHash: string;
  declare userType: UserType | null;
  declare onboardingStatus: OnboardingStatus;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare loginDisabledAt: Date | null;
  declare opportunityAnalyses: NonAttribute<UserOpportunityAnalysis[]> | undefined;
}

export function getUserModel(): typeof User {
  if (globalThis.__venturexUserModel) {
    return globalThis.__venturexUserModel;
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(320),
        allowNull: false,
        field: "email",
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "password_hash",
      },
      userType: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: "user_type",
      },
      onboardingStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: ONBOARDING_STATUSES.NOT_STARTED,
        field: "onboarding_status",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at",
      },
      loginDisabledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "login_disabled_at",
      },
    },
    {
      sequelize: getSequelize(),
      tableName: "users",
      timestamps: true,
      underscored: true,
    },
  );

  globalThis.__venturexUserModel = User;
  return User;
}
