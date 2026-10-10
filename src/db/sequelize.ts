import "server-only";

import { Sequelize } from "sequelize";

import { getServerEnv } from "../lib/env";

declare global {
  var __venturexSequelize: Sequelize | undefined;
}

export function getSequelize(): Sequelize {
  if (globalThis.__venturexSequelize) {
    return globalThis.__venturexSequelize;
  }

  const env = getServerEnv();
  const sequelize = new Sequelize(env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    pool: {
      max: env.DB_POOL_MAX,
      min: env.DB_POOL_MIN,
      idle: env.DB_POOL_IDLE,
      acquire: env.DB_POOL_ACQUIRE,
    },
    define: {
      timestamps: true,
      underscored: true,
    },
  });

  globalThis.__venturexSequelize = sequelize;
  return sequelize;
}