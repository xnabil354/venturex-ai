import { randomBytes, randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

const ROOT = process.cwd();
const IMAGE = "postgres:18-alpine";
const EXPECTED_MIGRATIONS = [
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
  "017-create-trend-evidence-provenances.ts",
  "018-create-private-opportunity-hypotheses.ts",
];
const runId = randomUUID();
const suffix = runId.replaceAll("-", "").slice(0, 8);
const containerName = `venturex-catalog-import-${suffix}`;
const networkName = `venturex-catalog-net-${suffix}`;
const databaseName = `venturex_catalog_import_test_${suffix}`;
const databaseUser = `venturex_catalog_test_${suffix}`;
const databasePassword = randomBytes(32).toString("hex");
let databaseUrl;
let containerCreated = false;
let networkCreated = false;

function redact(text) {
  let result = text;
  if (databasePassword) result = result.replaceAll(databasePassword, "[redacted]");
  if (databaseUrl) result = result.replaceAll(databaseUrl, "[database URL redacted]");
  return result;
}

function capture(command, args, label, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) throw new Error(`${label} could not start (${result.error.code ?? result.error.name}).`);
  if (result.status !== 0) {
    const detail = redact((result.stderr || result.stdout || "").trim()).slice(0, 400);
    throw new Error(`${label} exited with code ${result.status ?? 1}.${detail ? ` ${detail}` : ""}`);
  }
  return result.stdout.trim();
}

function safeProviderEnvironment(databaseUrlValue) {
  const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrlValue };
  for (const name of Object.keys(env)) {
    if (/GEMINI|NINEROUTER|BRIGHTDATA/i.test(name)) delete env[name];
  }
  return env;
}

function runProcess(command, args, label, env) {
  console.log(`[catalog-import-it] ${label}`);
  const buffers = { stdout: "", stderr: "" };
  const writeSafe = (channel, stream, final = false) => {
    const buffered = buffers[channel];
    const newline = buffered.lastIndexOf("\n");
    if (final || newline >= 0) {
      const splitAt = final ? buffered.length : newline + 1;
      stream.write(redact(buffered.slice(0, splitAt)));
      buffers[channel] = buffered.slice(splitAt);
    }
    if (!final && buffers[channel].length > 64 * 1024) buffers[channel] = "[long output line elided]\n";
  };
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => { buffers.stdout += chunk.toString("utf8"); writeSafe("stdout", process.stdout); });
    child.stderr.on("data", (chunk) => { buffers.stderr += chunk.toString("utf8"); writeSafe("stderr", process.stderr); });
    child.once("error", (error) => reject(new Error(`${label} could not start (${error.code ?? error.name}).`)));
    child.once("close", (code) => {
      writeSafe("stdout", process.stdout, true);
      writeSafe("stderr", process.stderr, true);
      if (code !== 0) reject(new Error(`${label} exited with code ${code ?? 1}.`));
      else resolve();
    });
  });
}

function connectionUrl(port) {
  const url = new URL(`postgresql://${databaseUser}:${databasePassword}@127.0.0.1:${port}/${databaseName}`);
  return url.toString();
}

async function queryIdentity(url) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 1_500,
    query_timeout: 5_000,
    statement_timeout: 5_000,
  });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT current_database() AS database_name,
        current_user AS database_user,
        pg_get_userbyid(datdba) AS database_owner,
        current_setting('server_version_num') AS version_number
      FROM pg_database WHERE datname = current_database()`);
    return result.rows[0];
  } finally {
    await client.end();
  }
}

async function waitForPostgres(url) {
  const deadline = Date.now() + 60_000;
  let lastCode = "unavailable";
  while (Date.now() < deadline) {
    try {
      return await queryIdentity(url);
    } catch (error) {
      lastCode = error?.code ?? error?.name ?? "connection failed";
      await delay(500);
    }
  }
  throw new Error(`Disposable PostgreSQL did not become ready (${lastCode}).`);
}

function inspectOwnedContainer() {
  const raw = capture("docker", ["inspect", containerName], "Inspect task-owned PostgreSQL container");
  const [container] = JSON.parse(raw);
  if (
    container?.Name !== `/${containerName}` ||
    container?.Config?.Image !== IMAGE ||
    container?.Config?.Labels?.["venturex.catalog-import.run"] !== runId
  ) {
    throw new Error("Refusing PostgreSQL operation: container ownership or image identity does not match this run.");
  }
  if ((container.Mounts ?? []).some(({ Type }) => Type === "volume" || Type === "bind")) {
    throw new Error("Refusing PostgreSQL operation: container has a persistent or host bind mount.");
  }
  const networkNames = Object.keys(container.NetworkSettings?.Networks ?? {});
  if (networkNames.length !== 1 || networkNames[0] !== networkName) {
    throw new Error("Refusing PostgreSQL operation: container is not on this run's isolated bridge.");
  }
  const [network] = JSON.parse(capture("docker", ["network", "inspect", networkName], "Inspect task-owned isolated network"));
  if (
    network?.Name !== networkName ||
    network?.Labels?.["venturex.catalog-import.run"] !== runId ||
    network?.Options?.["com.docker.network.bridge.enable_ip_masquerade"] !== "false"
  ) {
    throw new Error("Refusing PostgreSQL operation: isolated network ownership or egress control is unverified.");
  }
  return container;
}

async function createDisposablePostgres() {
  const version = capture("docker", ["info", "--format", "{{.ServerVersion}}"], "Docker Desktop connection");
  console.log(`[catalog-import-it] Docker Engine ${version}; starting isolated ${IMAGE} with no persistent mounts.`);
  capture("docker", [
    "network", "create", "--driver", "bridge",
    "--opt", "com.docker.network.bridge.enable_ip_masquerade=false",
    "--label", `venturex.catalog-import.run=${runId}`,
    networkName,
  ], "Create task-owned egress-limited network");
  networkCreated = true;

  capture("docker", [
    "run", "--detach", "--rm",
    "--name", containerName,
    "--label", `venturex.catalog-import.run=${runId}`,
    "--network", networkName,
    "--memory=768m",
    "--cpus=1",
    "--tmpfs", "/var/lib/postgresql:rw,size=512m",
    "--publish", "127.0.0.1::5432",
    "--env", "POSTGRES_PASSWORD",
    "--env", `POSTGRES_DB=${databaseName}`,
    "--env", `POSTGRES_USER=${databaseUser}`,
    "--health-cmd", `pg_isready -U ${databaseUser} -d ${databaseName}`,
    "--health-interval", "1s",
    "--health-timeout", "3s",
    "--health-retries", "60",
    IMAGE,
  ], "Start unique temporary PostgreSQL 18 container", { POSTGRES_PASSWORD: databasePassword });
  containerCreated = true;

  const container = inspectOwnedContainer();
  const portOutput = capture("docker", ["port", containerName, "5432/tcp"], "Read dynamic PostgreSQL host port");
  const match = portOutput.match(/^127\.0\.0\.1:(\d+)$/mu);
  const port = Number(match?.[1]);
  if (!match || !Number.isInteger(port) || port === 5432) {
    throw new Error("Disposable PostgreSQL must use a dynamic loopback port other than 5432.");
  }
  databaseUrl = connectionUrl(port);
  const identity = await waitForPostgres(databaseUrl);
  if (
    identity?.database_name !== databaseName ||
    identity?.database_user !== databaseUser ||
    identity?.database_owner !== databaseUser ||
    !String(identity?.version_number).startsWith("18") ||
    databaseName.toLowerCase() === "venturex_dev"
  ) {
    throw new Error("PostgreSQL identity does not match the isolated disposable target.");
  }
  console.log(`[catalog-import-it] Verified disposable database and owner, PostgreSQL 18, loopback dynamic port ${port}; no persistent mounts.`);
}

async function verifyMigrationFilesBeforeWrite() {
  const actual = (await readdir(path.join(ROOT, "db", "migrations")))
    .filter((name) => name.endsWith(".ts"))
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
    throw new Error("Migration directory differs from the verified set 001-018; refusing to create or migrate a database.");
  }
  console.log(`[catalog-import-it] Preflight verified exactly ${actual.length} migration files, 001-018.`);
}

async function assertDisposableIdentityBeforeWrite(operation) {
  inspectOwnedContainer();
  const identity = await queryIdentity(databaseUrl);
  if (
    identity?.database_name !== databaseName ||
    identity?.database_user !== databaseUser ||
    identity?.database_owner !== databaseUser ||
    !String(identity?.version_number).startsWith("18") ||
    databaseName.toLowerCase() === "venturex_dev"
  ) {
    throw new Error(`Refusing ${operation}: disposable database identity does not match this run.`);
  }
}

async function assertCompleteMigrations() {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000 });
  await client.connect();
  try {
    const result = await client.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    const names = result.rows.map(({ name }) => name);
    if (names.length !== 18 || names.at(-1) !== "018-create-private-opportunity-hypotheses.ts") {
      throw new Error(`Expected migrations 001-018 on disposable database; found ${names.length}.`);
    }
    console.log(`[catalog-import-it] Verified all ${names.length} migrations, 001-018.`);
  } finally {
    await client.end();
  }
}

async function verifyDatabaseResults() {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 2_000 });
  await client.connect();
  try {
    const identity = await client.query(`
      SELECT current_database() AS database_name, current_user AS database_user,
        pg_get_userbyid(datdba) AS database_owner
      FROM pg_database WHERE datname = current_database()`);
    const row = identity.rows[0];
    if (row?.database_name !== databaseName || row?.database_user !== databaseUser || row?.database_owner !== databaseUser) {
      throw new Error("Disposable PostgreSQL identity changed before final verification.");
    }
    const counts = await client.query(`
      SELECT (SELECT count(*) FROM trends)::int AS trends,
        (SELECT count(*) FROM trend_evidences)::int AS evidence,
        (SELECT count(*) FROM trend_evidence_provenances)::int AS provenance,
        (SELECT count(*) FROM opportunities)::int AS opportunities,
        (SELECT count(*) FROM trends WHERE lifecycle_state <> 'DRAFT')::int AS non_draft`);
    const result = counts.rows[0];
    if (result?.opportunities !== 0 || result?.non_draft !== 0 || result?.evidence !== result?.provenance) {
      throw new Error("Disposable catalog postconditions failed.");
    }
    console.log(`[catalog-import-it] Disposable-only results: ${result.trends} Trends, ${result.evidence} Evidence, ${result.provenance} provenance rows; 0 Opportunities, 0 non-DRAFT Trends.`);
  } finally {
    await client.end();
  }
}

async function cleanup() {
  if (containerCreated) {
    try {
      inspectOwnedContainer();
      if (databaseUrl) await queryIdentity(databaseUrl);
      capture("docker", ["stop", "--time", "5", containerName], "Stop and remove only this disposable container");
      console.log("[catalog-import-it] Task-owned disposable PostgreSQL container removed; database storage was tmpfs-backed.");
    } catch (error) {
      process.exitCode = 1;
      console.error(`[catalog-import-it] Container cleanup stopped for safety: ${redact(error instanceof Error ? error.message : "unknown error")}`);
    }
  }
  if (networkCreated) {
    try {
      const [network] = JSON.parse(capture("docker", ["network", "inspect", networkName], "Verify task-owned network before cleanup"));
      if (network?.Name !== networkName || network?.Labels?.["venturex.catalog-import.run"] !== runId) {
        throw new Error("Network ownership did not match this run.");
      }
      capture("docker", ["network", "rm", networkName], "Remove only this task-owned network");
      console.log("[catalog-import-it] Task-owned isolated Docker network removed.");
    } catch (error) {
      process.exitCode = 1;
      console.error(`[catalog-import-it] Network cleanup stopped for safety: ${redact(error instanceof Error ? error.message : "unknown error")}`);
    }
  }
}

async function main() {
  try {
    await verifyMigrationFilesBeforeWrite();
    await createDisposablePostgres();
    await assertDisposableIdentityBeforeWrite("migration");
    const env = safeProviderEnvironment(databaseUrl);
    await runProcess(
      process.execPath,
      ["--experimental-strip-types", "scripts/db.mjs", "up"],
      "Apply existing migrations 001-018 only to the verified disposable target",
      env,
    );
    await assertCompleteMigrations();
    await assertDisposableIdentityBeforeWrite("integration tests");
    await runProcess(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", "src/catalog/google-trends-provenance-import.postgres.integration.test.ts"],
      "Run provider-shaped synthetic import integration tests",
      {
        ...env,
        VENTUREX_GOOGLE_TRENDS_IMPORT_POSTGRES_INTEGRATION: "1",
        VENTUREX_GOOGLE_TRENDS_IMPORT_TEST_DATABASE_URL: databaseUrl,
      },
    );
    await verifyDatabaseResults();
  } catch (error) {
    process.exitCode = 1;
    console.error(`[catalog-import-it] BLOCKED: ${redact(error instanceof Error ? error.message : "unknown failure")}`);
  } finally {
    await cleanup();
  }
}

await main();
