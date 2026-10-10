import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(10),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DB_POOL_IDLE: z.coerce.number().int().min(0).default(10_000),
  DB_POOL_ACQUIRE: z.coerce.number().int().min(1).default(30_000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvironmentValidationError extends Error {
  override readonly name = "EnvironmentValidationError";

  constructor(readonly variables: readonly string[]) {
    super(`Invalid server environment: ${variables.join(", ")}`);
  }
}

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const variables = [
      ...new Set(
        result.error.issues.map((issue) => issue.path.join(".")).filter(Boolean),
      ),
    ];
    throw new EnvironmentValidationError(variables);
  }

  cachedEnv = result.data;
  return cachedEnv;
}