import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createEntrepreneurProfiles: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("entrepreneur_profiles", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    location_text: { type: DataTypes.STRING(255), allowNull: false },
    city: { type: DataTypes.STRING(120), allowNull: true },
    province: { type: DataTypes.STRING(120), allowNull: true },
    country_code: { type: DataTypes.STRING(2), allowNull: false, defaultValue: "ID" },
    budget_min: { type: DataTypes.BIGINT, allowNull: false },
    budget_max: { type: DataTypes.BIGINT, allowNull: false },
    experience_level: { type: DataTypes.STRING(32), allowNull: false },
    time_commitment: { type: DataTypes.STRING(32), allowNull: false },
    preferred_product_type: { type: DataTypes.STRING(100), allowNull: true },
    business_objective: { type: DataTypes.TEXT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    profile_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addConstraint("entrepreneur_profiles", {
    fields: ["user_id"],
    type: "unique",
    name: "entrepreneur_profiles_user_id_unique",
  });
  await context.sequelize.query(`
    ALTER TABLE "entrepreneur_profiles"
    ADD CONSTRAINT "entrepreneur_profiles_budget_min_check"
    CHECK ("budget_min" >= 0)
  `);
  await context.sequelize.query(`
    ALTER TABLE "entrepreneur_profiles"
    ADD CONSTRAINT "entrepreneur_profiles_budget_range_check"
    CHECK ("budget_max" >= "budget_min")
  `);
  await context.sequelize.query(`
    ALTER TABLE "entrepreneur_profiles"
    ADD CONSTRAINT "entrepreneur_profiles_experience_level_check"
    CHECK ("experience_level" IN ('BEGINNER', 'SOME_EXPERIENCE', 'EXPERIENCED'))
  `);
  await context.sequelize.query(`
    ALTER TABLE "entrepreneur_profiles"
    ADD CONSTRAINT "entrepreneur_profiles_time_commitment_check"
    CHECK ("time_commitment" IN ('LIMITED', 'PART_TIME', 'FULL_TIME'))
  `);
  await context.sequelize.query(`
    ALTER TABLE "entrepreneur_profiles"
    ADD CONSTRAINT "entrepreneur_profiles_version_check"
    CHECK ("profile_version" >= 1)
  `);
};

const dropEntrepreneurProfiles: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("entrepreneur_profiles");
};

export const up = createEntrepreneurProfiles;
export const down = dropEntrepreneurProfiles;
