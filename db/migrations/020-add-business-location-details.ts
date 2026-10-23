import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const addBusinessLocationDetails: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.addColumn("business_profiles", "district", {
    type: DataTypes.STRING(120),
    allowNull: true,
  });
  await context.addColumn("business_profiles", "subdistrict", {
    type: DataTypes.STRING(120),
    allowNull: true,
  });
};

const removeBusinessLocationDetails: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.removeColumn("business_profiles", "subdistrict");
  await context.removeColumn("business_profiles", "district");
};

export const up = addBusinessLocationDetails;
export const down = removeBusinessLocationDetails;
