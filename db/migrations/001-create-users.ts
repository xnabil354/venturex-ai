import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createUsers: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("users", {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    user_type: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    onboarding_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "NOT_STARTED",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addConstraint("users", {
    fields: ["email"],
    type: "unique",
    name: "users_email_unique",
  });

  await context.sequelize.query(`
    ALTER TABLE "users"
    ADD CONSTRAINT "users_user_type_check"
    CHECK ("user_type" IS NULL OR "user_type" IN ('ENTREPRENEUR', 'UMKM_EXISTING'))
  `);

  await context.sequelize.query(`
    ALTER TABLE "users"
    ADD CONSTRAINT "users_onboarding_status_check"
    CHECK ("onboarding_status" IN ('NOT_STARTED', 'USER_TYPE_SELECTED', 'PROFILE_IN_PROGRESS', 'COMPLETED'))
  `);
};

const dropUsers: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("users");
};

export const up = createUsers;
export const down = dropUsers;
