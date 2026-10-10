import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const createBusinessProfiles: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.createTable("business_profiles", {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    business_name: { type: DataTypes.STRING(180), allowNull: false },
    business_category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "fnb_categories", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    location_text: { type: DataTypes.STRING(255), allowNull: false },
    city: { type: DataTypes.STRING(120), allowNull: true },
    province: { type: DataTypes.STRING(120), allowNull: true },
    country_code: { type: DataTypes.CHAR(2), allowNull: false, defaultValue: "ID" },
    average_price_min: { type: DataTypes.BIGINT, allowNull: false },
    average_price_max: { type: DataTypes.BIGINT, allowNull: false },
    business_description: { type: DataTypes.TEXT, allowNull: true },
    operation_model: { type: DataTypes.STRING(100), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    profile_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await context.addConstraint("business_profiles", {
    fields: ["user_id"],
    type: "unique",
    name: "business_profiles_user_id_unique",
  });
  await context.sequelize.query(`
    ALTER TABLE "business_profiles"
    ADD CONSTRAINT "business_profiles_average_price_min_check"
    CHECK ("average_price_min" >= 0)
  `);
  await context.sequelize.query(`
    ALTER TABLE "business_profiles"
    ADD CONSTRAINT "business_profiles_average_price_range_check"
    CHECK ("average_price_max" >= "average_price_min")
  `);
  await context.sequelize.query(`
    ALTER TABLE "business_profiles"
    ADD CONSTRAINT "business_profiles_version_check"
    CHECK ("profile_version" >= 1)
  `);
};

const dropBusinessProfiles: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.dropTable("business_profiles");
};

export const up = createBusinessProfiles;
export const down = dropBusinessProfiles;
