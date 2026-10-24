import { randomUUID } from "node:crypto";
import path from "node:path";

import argon2 from "argon2";
import { Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";
import { z } from "zod";

const LEGACY_ADMIN_EMAIL = "adminventurex@gmail.com";
const ADMIN_MIGRATION_PREFIX = "024-create-admin-billing-controls";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DB_POOL_IDLE: z.coerce.number().int().min(0).default(10_000),
  DB_POOL_ACQUIRE: z.coerce.number().int().min(1).default(30_000),
});

function getDatabaseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const variables = [
      ...new Set(
        result.error.issues.map((issue) => issue.path.join(".")).filter(Boolean),
      ),
    ];
    throw new Error(`Invalid database environment: ${variables.join(", ")}`);
  }
  return result.data;
}

function parseCommand(value) {
  switch (value) {
    case "status":
    case "down":
    case "up":
    case undefined:
      return value ?? "up";
    default:
      throw new Error(`Unknown database command: ${value}`);
  }
}

async function prepareLegacyAdmin(migrator, sequelize) {
  const pending = await migrator.pending();
  const adminMigrationIndex = pending.findIndex(({ name }) =>
    name.startsWith(ADMIN_MIGRATION_PREFIX),
  );
  if (adminMigrationIndex === -1) return;

  const previousMigration = pending[adminMigrationIndex - 1];
  if (previousMigration) {
    await migrator.up({ to: previousMigration.name });
  }

  await sequelize.transaction(async (transaction) => {
    const [rows] = await sequelize.query(
      "SELECT password_hash FROM users WHERE email = $1 FOR UPDATE",
      { bind: [LEGACY_ADMIN_EMAIL], transaction },
    );
    const existingAdmin = rows[0];
    if (existingAdmin) {
      if (!existingAdmin.password_hash) {
        throw new Error(
          "The legacy admin account has no password hash; migration 024 cannot create an admin login.",
        );
      }
      return;
    }

    const passwordResult = z
      .string()
      .min(32)
      .max(128)
      .safeParse(process.env.ADMIN_BOOTSTRAP_PASSWORD);
    if (!passwordResult.success) {
      throw new AdminBootstrapConfigurationError(
        "A fresh database needs ADMIN_BOOTSTRAP_PASSWORD (32–128 characters) before migration 024. Set a unique password, rerun migrations, then remove it from the runtime environment.",
      );
    }

    const passwordHash = await argon2.hash(passwordResult.data, {
      type: argon2.argon2id,
    });
    await sequelize.query(
      `INSERT INTO users (id, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (email) DO NOTHING`,
      {
        bind: [randomUUID(), LEGACY_ADMIN_EMAIL, passwordHash],
        transaction,
      },
    );
  });
}

class AdminBootstrapConfigurationError extends Error {}

async function main() {
  const env = getDatabaseEnv();
  const sequelize = new Sequelize(env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    pool: {
      max: env.DB_POOL_MAX,
      min: env.DB_POOL_MIN,
      idle: env.DB_POOL_IDLE,
      acquire: env.DB_POOL_ACQUIRE,
    },
  });
  const migrator = new Umzug({
    migrations: {
      glob: ["*.ts", { cwd: path.join(process.cwd(), "db", "migrations") }],
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: undefined,
  });

  try {
    const command = parseCommand(process.argv[2]);
    if (command === "up") {
      await prepareLegacyAdmin(migrator, sequelize);
      const migrations = await migrator.up();
      console.info(`Applied migrations: ${migrations.map(({ name }) => name).join(", ") || "none"}`);
    } else if (command === "status") {
      const [executed, pending] = await Promise.all([
        migrator.executed(),
        migrator.pending(),
      ]);
      console.info(`Executed migrations: ${executed.map(({ name }) => name).join(", ") || "none"}`);
      console.info(`Pending migrations: ${pending.map(({ name }) => name).join(", ") || "none"}`);
    } else {
      const migrations = await migrator.down();
      console.info(`Reverted migrations: ${migrations.map(({ name }) => name).join(", ") || "none"}`);
    }
  } finally {
    await sequelize.close();
  }
}

// no-excuse-ok: catch — CLI boundary reports failure without exposing credentials.
main().catch((error) => {
  if (error instanceof AdminBootstrapConfigurationError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  console.error("Database command failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});
