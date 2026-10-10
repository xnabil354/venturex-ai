import path from "node:path";

import type { QueryInterface, Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";

import { getSequelize } from "./sequelize";

export function createMigrator(
  sequelize: Sequelize = getSequelize(),
): Umzug<QueryInterface> {
  return new Umzug<QueryInterface>({
    migrations: {
      glob: ["*.ts", { cwd: path.join(process.cwd(), "db", "migrations") }],
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: undefined,
  });
}