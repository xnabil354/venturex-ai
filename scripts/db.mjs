import path from "node:path";

import { Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";
import { z } from "zod";

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
  console.error("Database command failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
});