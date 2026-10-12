import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { Client } from "pg";

const ROOT = process.cwd();
const IMAGE = "postgres:18-alpine";
const INTEGRATION_DATABASE = "venturex_fit_score_test";
const E2E_DATABASE = "venturex_batch10_e2e_test";
const DATABASE_USER = "fit_score_test";
const MIGRATIONS = [
  "001-create-users.ts",
  "002-create-reference-tables.ts",
  "003-create-entrepreneur-profiles.ts",
  "004-create-entrepreneur-profile-junctions.ts",
  "005-create-business-profiles.ts",
  "006-create-business-products.ts",
  "007-create-business-profile-junctions.ts",
  "008-create-trends.ts",
  "009-create-opportunities.ts",
  "010-create-evidences.ts",
  "011-create-saved-opportunities.ts",
  "012-create-dataset-versions.ts",
  "013-create-scoring-models.ts",
  "014-create-user-opportunity-analyses.ts",
  "015-create-opportunity-fit-inputs.ts",
  "016-create-roadmaps.ts",
];

const runId = randomUUID();
const containerName = `venturex-b10-db-${runId.slice(0, 8)}`;
const networkName = `venturex-b10-net-${runId.slice(0, 8)}`;
const postgresPassword = randomBytes(32).toString("hex");
const authSecret = randomBytes(32).toString("base64url");
const secretsForLogs = [postgresPassword, authSecret];
let temporaryDirectory;
let containerCreated = false;
let networkCreated = false;
let integrationUrl;
let e2eUrl;

function redact(text) {
  let result = text;
  for (const secret of secretsForLogs) {
    if (secret.length >= 8) result = result.replaceAll(secret, "[redacted]");
  }
  for (const value of [integrationUrl, e2eUrl]) {
    if (value) result = result.replaceAll(value, "[database URL redacted]");
  }
  return result;
}

function capture(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`${label} could not start (${result.error.code ?? result.error.name}).`);
  }
  if (result.status !== 0) {
    const detail = redact((result.stderr || result.stdout || "").trim()).slice(0, 500);
    throw new Error(`${label} exited with code ${result.status ?? 1}.${detail ? ` ${detail}` : ""}`);
  }
  return result.stdout.trim();
}

function runProcess(command, args, label, env, extraSecrets = []) {
  console.log(`[batch-10] ${label}`);
  const knownSecrets = [...secretsForLogs, ...extraSecrets].filter(Boolean);
  let buffers = { stdout: "", stderr: "" };

  const safeWrite = (stream, channel, final = false) => {
    let buffered = buffers[channel];
    const newline = buffered.lastIndexOf("\n");
    if (final || newline >= 0) {
      const splitAt = final ? buffered.length : newline + 1;
      const output = buffered.slice(0, splitAt);
      buffers[channel] = buffered.slice(splitAt);
      let safe = output;
      for (const secret of knownSecrets) {
        if (secret.length >= 8) safe = safe.replaceAll(secret, "[redacted]");
      }
      stream.write(safe);
    }
    if (!final && buffers[channel].length > 64 * 1024) {
      buffers[channel] = "[long output line elided]\n";
    }
  };

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      buffers.stdout += chunk.toString("utf8");
      safeWrite(process.stdout, "stdout");
    });
    child.stderr.on("data", (chunk) => {
      buffers.stderr += chunk.toString("utf8");
      safeWrite(process.stderr, "stderr");
    });
    child.once("error", (error) => reject(new Error(`${label} could not start (${error.code ?? error.name}).`)));
    child.once("close", (code) => {
      safeWrite(process.stdout, "stdout", true);
      safeWrite(process.stderr, "stderr", true);
      if (code !== 0) reject(new Error(`${label} exited with code ${code ?? 1}.`));
      else resolve();
    });
  });
}

function databaseUrl(port, databaseName) {
  const url = new URL(`postgresql://${DATABASE_USER}:${postgresPassword}@127.0.0.1:${port}/${databaseName}`);
  return url.toString();
}

async function connect(url) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 2_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
  });
  await client.connect();
  return client;
}

async function assertDatabaseIdentity(url, expectedDatabase, { requireSuperuser = false } = {}) {
  const parsed = new URL(url);
  if (parsed.hostname !== "127.0.0.1" || parsed.port === "5432") {
    throw new Error("Refusing database operation: connection is not on the isolated dynamic localhost port.");
  }
  if (decodeURIComponent(parsed.username) !== DATABASE_USER || decodeURIComponent(parsed.pathname.slice(1)) !== expectedDatabase) {
    throw new Error("Refusing database operation: URL identity does not match the Batch 10 test target.");
  }

  const client = await connect(url);
  try {
    const result = await client.query(
      `SELECT current_database() AS database_name,
              current_user AS database_user,
              current_setting('server_version_num') AS version_number,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser`,
    );
    const identity = result.rows[0];
    if (identity?.database_name !== expectedDatabase
      || identity?.database_user !== DATABASE_USER
      || typeof identity?.version_number !== "string"
      || !identity.version_number.startsWith("18")) {
      throw new Error("Refusing database operation: PostgreSQL identity/version check failed.");
    }
    if (requireSuperuser && identity.is_superuser !== true) {
      throw new Error("Refusing database creation: the disposable test role lacks the required local privilege.");
    }
    return identity;
  } finally {
    await client.end();
  }
}

async function waitForPostgres(url) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await assertDatabaseIdentity(url, INTEGRATION_DATABASE, { requireSuperuser: true });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Disposable PostgreSQL did not become ready: ${lastError instanceof Error ? lastError.name : "connection failure"}.`);
}

async function assertMigrations(url, databaseName) {
  await assertDatabaseIdentity(url, databaseName);
  const client = await connect(url);
  try {
    const result = await client.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    const names = result.rows.map(({ name }) => name);
    if (JSON.stringify(names) !== JSON.stringify(MIGRATIONS)) {
      throw new Error(`Expected all 16 migrations on ${databaseName}; found ${names.length}.`);
    }
  } finally {
    await client.end();
  }
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local application port.");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function environmentFor(url, appPort = undefined) {
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DB_POOL_MAX: "4",
    DB_POOL_MIN: "0",
    DB_POOL_IDLE: "5000",
    DB_POOL_ACQUIRE: "15000",
    AUTH_SECRET: authSecret,
    AUTH_TRUST_HOST: "true",
    AI_ANALYSIS_PROVIDER: "",
    AI_ANALYSIS_BASE_URL: "",
    AI_ANALYSIS_API_KEY: "",
    AI_ANALYSIS_MODEL: "",
    BRIGHTDATA_TRENDS_ENABLED: "false",
    BRIGHTDATA_TRENDS_API_KEY: "",
    NODE_ENV: "development",
  };
  delete env.AI_ANALYSIS_TIMEOUT_MS;
  delete env.VENTUREX_FIT_SCORE_POSTGRES_INTEGRATION;
  if (appPort !== undefined) {
    env.VENTUREX_E2E_PORT = String(appPort);
    env.APP_URL = `http://127.0.0.1:${appPort}`;
    secretsForLogs.push(url);
  }
  return env;
}

function inspectOwnedContainer() {
  const raw = capture("docker", ["inspect", containerName], "Inspect isolated PostgreSQL container");
  const [container] = JSON.parse(raw);
  if (!container
    || container.Config?.Labels?.["venturex.e2e.run"] !== runId
    || container.Config?.Image !== IMAGE
    || container.HostConfig?.NetworkMode !== networkName
    || container.HostConfig?.Tmpfs?.["/var/lib/postgresql"] === undefined) {
    throw new Error("Refusing to stop a container that does not match the unique Batch 10 test identity.");
  }
  const persistentMount = (container.Mounts ?? []).some(({ Type }) => Type === "volume" || Type === "bind");
  if (persistentMount) throw new Error("Refusing test setup: PostgreSQL container has a persistent or host bind mount.");
  const networkNames = Object.keys(container.NetworkSettings?.Networks ?? {});
  if (networkNames.length !== 1 || networkNames[0] !== networkName) {
    throw new Error("Refusing test setup: PostgreSQL is not isolated on its unique Batch 10 network.");
  }
  const rawNetwork = capture("docker", ["network", "inspect", networkName], "Inspect unique Batch 10 network");
  const [network] = JSON.parse(rawNetwork);
  if (network?.Name !== networkName
    || network?.Driver !== "bridge"
    || network?.Labels?.["venturex.e2e.run"] !== runId
    || network?.Internal !== false
    || network?.Options?.["com.docker.network.bridge.enable_ip_masquerade"] !== "false") {
    throw new Error("Refusing test setup: the custom Docker bridge is not labeled or egress NAT is not disabled.");
  }
  return container;
}

async function createDisposablePostgres() {
  const dockerVersion = capture("docker", ["info", "--format", "{{.ServerVersion}}"], "Docker Desktop connection");
  console.log(`[batch-10] Docker Engine ${dockerVersion}; using ${IMAGE} on a unique bridge with egress masquerading disabled.`);

  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "venturex-batch10-"));
  const envFile = path.join(temporaryDirectory, "postgres.env");
  await writeFile(envFile, `POSTGRES_PASSWORD=${postgresPassword}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });

  capture("docker", [
    "network", "create", "--driver", "bridge", "--opt", "com.docker.network.bridge.enable_ip_masquerade=false",
    "--label", `venturex.e2e.run=${runId}`,
    networkName,
  ], "Create unique egress-limited Docker bridge");
  networkCreated = true;

  capture("docker", [
    "run", "--detach", "--rm",
    "--name", containerName,
    "--label", `venturex.e2e.run=${runId}`,
    "--network", networkName,
    "--memory=768m",
    "--cpus=1",
    "--tmpfs", "/var/lib/postgresql:rw,size=512m",
    "--publish", "127.0.0.1::5432",
    "--env-file", envFile,
    "--env", `POSTGRES_DB=${INTEGRATION_DATABASE}`,
    "--env", `POSTGRES_USER=${DATABASE_USER}`,
    "--health-cmd", `pg_isready -U ${DATABASE_USER} -d ${INTEGRATION_DATABASE}`,
    "--health-interval", "1s",
    "--health-timeout", "3s",
    "--health-retries", "60",
    IMAGE,
  ], "Start dedicated PostgreSQL 18 test container");
  containerCreated = true;

  const container = inspectOwnedContainer();
  const portOutput = capture("docker", ["port", containerName, "5432/tcp"], "Read isolated PostgreSQL port");
  const match = portOutput.match(/^127\.0\.0\.1:(\d+)$/mu);
  if (!match) throw new Error("The disposable PostgreSQL port was not published on localhost only.");
  const port = Number(match[1]);
  integrationUrl = databaseUrl(port, INTEGRATION_DATABASE);
  const identity = await waitForPostgres(integrationUrl);
  if (!container.Config?.Image) throw new Error("PostgreSQL image identity is unavailable.");
  console.log(`[batch-10] Verified ${identity.database_name}, PostgreSQL ${Number(identity.version_number) / 10000}, user ${identity.database_user}, localhost port ${port}; container has no persistent mounts.`);
  return port;
}

async function createE2EDatabase() {
  await assertDatabaseIdentity(integrationUrl, INTEGRATION_DATABASE, { requireSuperuser: true });
  const client = await connect(integrationUrl);
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [E2E_DATABASE]);
    if (existing.rowCount !== 0) throw new Error("Refusing setup: the E2E database unexpectedly already exists.");
    await client.query(`CREATE DATABASE "${E2E_DATABASE}"`);
  } finally {
    await client.end();
  }
  const port = new URL(integrationUrl).port;
  e2eUrl = databaseUrl(port, E2E_DATABASE);
  await assertDatabaseIdentity(e2eUrl, E2E_DATABASE);
}

async function cleanup() {
  if (containerCreated) {
    try {
      inspectOwnedContainer();
      if (e2eUrl) {
        try {
          await assertDatabaseIdentity(e2eUrl, E2E_DATABASE);
          console.log("[batch-10] Verified E2E database identity before removing its disposable container.");
        } catch {
          console.log("[batch-10] Final database identity check unavailable; cleanup remains limited to the uniquely labeled disposable container.");
        }
      } else if (integrationUrl) {
        try {
          await assertDatabaseIdentity(integrationUrl, INTEGRATION_DATABASE);
        } catch {
          console.log("[batch-10] Integration database is no longer reachable; cleanup remains limited to the uniquely labeled disposable container.");
        }
      }
      capture("docker", ["stop", "--time", "5", containerName], "Stop uniquely labeled Batch 10 container");
      console.log("[batch-10] Disposable PostgreSQL container stopped; --rm removed its tmpfs-backed data.");
    } catch (error) {
      console.error(`[batch-10] Container cleanup stopped for safety: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (networkCreated) {
    try {
      const raw = capture("docker", ["network", "inspect", networkName], "Inspect unique Batch 10 network");
      const [network] = JSON.parse(raw);
      if (network?.Name !== networkName || network?.Labels?.["venturex.e2e.run"] !== runId) {
        throw new Error("Network label did not match this run.");
      }
      capture("docker", ["network", "rm", networkName], "Remove unique Batch 10 network");
      console.log("[batch-10] Unique Batch 10 Docker bridge removed.");
    } catch (error) {
      console.error(`[batch-10] Network cleanup stopped for safety: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (temporaryDirectory) {
    const expectedParent = path.resolve(os.tmpdir());
    const actualDirectory = path.resolve(temporaryDirectory);
    if (path.dirname(actualDirectory) === expectedParent && path.basename(actualDirectory).startsWith("venturex-batch10-")) {
      await rm(actualDirectory, { recursive: true, force: true });
    }
  }
}

async function main() {
  try {
    await createDisposablePostgres();
    await assertDatabaseIdentity(integrationUrl, INTEGRATION_DATABASE, { requireSuperuser: true });
    await runProcess(
      process.execPath,
      ["--env-file-if-exists=.env", "--experimental-strip-types", "scripts/db.mjs", "up"],
      "Apply migrations 001-016 to the empty PostgreSQL integration database",
      environmentFor(integrationUrl),
      [integrationUrl],
    );
    await assertMigrations(integrationUrl, INTEGRATION_DATABASE);

    await runProcess(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", "src/scoring/fit-score.postgres.integration.test.ts"],
      "Run PostgreSQL 18 integration tests against the verified disposable database",
      {
        ...environmentFor(integrationUrl),
        VENTUREX_FIT_SCORE_POSTGRES_INTEGRATION: "1",
      },
      [integrationUrl],
    );

    await createE2EDatabase();
    await runProcess(
      process.execPath,
      ["--env-file-if-exists=.env", "--experimental-strip-types", "scripts/db.mjs", "up"],
      "Apply migrations 001-016 to the fresh E2E database",
      environmentFor(e2eUrl),
      [e2eUrl],
    );
    await assertMigrations(e2eUrl, E2E_DATABASE);
    await runProcess(
      process.execPath,
      ["scripts/reference-seed.mjs"],
      "Seed approved reference categories, customer segments, and sales channels",
      environmentFor(e2eUrl),
      [e2eUrl],
    );
    await runProcess(
      process.execPath,
      ["scripts/e2e/seed.mjs"],
      "Seed explicitly synthetic, test-only Trend, Opportunity, and Evidence records",
      environmentFor(e2eUrl),
      [e2eUrl],
    );

    const appPort = await findFreePort();
    const appEnv = environmentFor(e2eUrl, appPort);
    await assertDatabaseIdentity(e2eUrl, E2E_DATABASE);
    console.log(`[batch-10] App server will use 127.0.0.1:${appPort}; AI provider configuration is explicitly empty and Bright Data is disabled.`);
    await runProcess(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test", "--config=playwright.config.ts", ...process.argv.slice(2)],
      "Run real Chromium desktop and mobile browser journeys",
      appEnv,
      [e2eUrl],
    );
  } catch (error) {
    process.exitCode = 1;
    console.error(`[batch-10] BLOCKED: ${redact(error instanceof Error ? error.message : "unknown failure")}`);
  } finally {
    await cleanup();
  }
}

await main();
