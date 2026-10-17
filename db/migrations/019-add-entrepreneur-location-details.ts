import { DataTypes, type QueryInterface } from "sequelize";
import type { MigrationFn } from "umzug";

const addEntrepreneurLocationDetails: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.addColumn("entrepreneur_profiles", "district", {
    type: DataTypes.STRING(120),
    allowNull: true,
  });
  await context.addColumn("entrepreneur_profiles", "subdistrict", {
    type: DataTypes.STRING(120),
    allowNull: true,
  });
};

const removeEntrepreneurLocationDetails: MigrationFn<QueryInterface> = async ({ context }) => {
  await context.removeColumn("entrepreneur_profiles", "subdistrict");
  await context.removeColumn("entrepreneur_profiles", "district");
};

export const up = addEntrepreneurLocationDetails;
export const down = removeEntrepreneurLocationDetails;
