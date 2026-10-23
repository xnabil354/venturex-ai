import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QueryTypes, Sequelize } from "sequelize";

import {
  APPROVED_CATALOG_MANIFEST_ID,
  APPROVED_CATALOG_MANIFEST_SHA256,
  CatalogLifecycleService,
  fingerprintCatalogContent,
  JsonlCatalogAuditLedger,
  verifyApprovedManifest,
} from "../../src/catalog/catalog-lifecycle.ts";
import { parseCuratedCatalogManifest } from "../../src/catalog/catalog-manifest.ts";
import { loadCatalogLifecycleSnapshot } from "../../src/catalog/catalog-lifecycle-repository.ts";
import { assertTrendTransition } from "../../src/trend/domain.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, "../../data/catalog/curated-fnb-2025-candidates.v1.json");

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  if (!command || command === "--help" || command === "help") return { command: "help", flags: new Map() };
  const flags = new Map();
  for (let index = 0; index < tokens.length; index += 1) {
    const key = tokens[index];
    if (!key?.startsWith("--")) throw new Error("Arguments must be provided as named options.");
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Option ${key} requires a value.`);
    if (flags.has(key) && key !== "--limitation") throw new Error(`Option ${key} cannot be repeated.`);
    const values = flags.get(key) ?? [];
    values.push(value);
    flags.set(key, values);
    index += 1;
  }
  return { command, flags };
}

function getOption(flags, name, required = true) {
  const values = flags.get(name);
  if (!values?.length && required) throw new Error(`Required option is missing: ${name}.`);
  return values?.[0];
}

function getRepeatedOption(flags, name) {
  return flags.get(name) ?? [];
}

function assertOnlyOptions(flags, allowed) {
  for (const key of flags.keys()) if (!allowed.includes(key)) throw new Error(`Unsupported option: ${key}.`);
}

function parseDecision(value) {
  if (value !== "APPROVED" && value !== "REJECTED") throw new Error("Decision must be APPROVED or REJECTED.");
  return value;
}

function parseDatabaseTarget(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is unavailable or invalid.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(url.username);
  const port = Number(url.port || "5432");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase().replace(/^\[|\]$/g, "")) ||
    port !== 5432 || database !== "venturex_dev" || user !== "venturex" ||
    process.env.NODE_ENV?.toLowerCase() === "production"
  ) {
    throw new Error("Catalog lifecycle writes are restricted to the approved local venturex_dev database target.");
  }
  return { database, user };
}

function printHelp() {
  console.info(`Catalog lifecycle commands (local venturex_dev only):
  review --trend-id <uuid> --decision APPROVED|REJECTED --rationale <text> --limitation <text> [--limitation <text> ...]
  validate --trend-id <uuid> --confirm "VALIDATE <uuid>"
  approve-publication --trend-id <uuid> --decision APPROVED|REJECTED --rationale <text>
  publish --trend-id <uuid> --confirm "PUBLISH <uuid>"

Each review and Product/Data Owner decision is a separate, explicit ledger event.
The local OS account and the action's self-attested role are recorded; this is not strong reviewer authentication.
No command is run automatically by this help output.`);
}

async function transitionTrend(sequelize, trendId, toState, expectedContentSha256) {
  const snapshot = await loadCatalogLifecycleSnapshot(sequelize, trendId);
  if (!snapshot) throw new Error("Trend was not found at the transition boundary.");
  if (fingerprintCatalogContent(snapshot) !== expectedContentSha256) {
    throw new Error("Catalog content changed after its review decision.");
  }
  const fromState = snapshot.trend.lifecycleState;
  assertTrendTransition(fromState, toState);
  if (snapshot.trend.evidence.length === 0) throw new Error("Trend lifecycle requires at least one evidence record.");
  if (!snapshot.trend.businessRelevanceExplanation?.trim()) throw new Error("Trend lifecycle requires a business relevance explanation.");
  if (snapshot.trend.affectedUserTypes.length === 0) throw new Error("Trend lifecycle requires at least one eligible user type.");
  const rows = await sequelize.query(
    `UPDATE trends
        SET lifecycle_state = $3, archived_reason = NULL, updated_at = NOW()
      WHERE id = $1 AND lifecycle_state = $2
      RETURNING id::text AS id`,
    { bind: [trendId, fromState, toState], type: QueryTypes.SELECT },
  );
  if (rows.length !== 1) throw new Error("Trend lifecycle compare-and-set failed because the record changed concurrently.");
}

async function main() {
  const { command, flags } = parseArguments(process.argv.slice(2));
  if (command === "help") {
    printHelp();
    return;
  }

  const supportedCommands = ["review", "validate", "approve-publication", "publish"];
  if (!supportedCommands.includes(command)) throw new Error("Unknown catalog lifecycle command.");
  const requiredOptions = command === "review"
    ? ["--trend-id", "--decision", "--rationale", "--limitation"]
    : command === "approve-publication"
      ? ["--trend-id", "--decision", "--rationale"]
      : ["--trend-id", "--confirm"];
  const allowedOptions = command === "review"
    ? ["--trend-id", "--decision", "--rationale", "--limitation"]
    : command === "approve-publication"
      ? ["--trend-id", "--decision", "--rationale"]
      : ["--trend-id", "--confirm"];
  for (const option of requiredOptions) getOption(flags, option);
  assertOnlyOptions(flags, allowedOptions);

  const databaseTarget = parseDatabaseTarget(process.env.DATABASE_URL ?? "");
  const rawManifest = await readFile(manifestPath);
  const manifestSha256 = createHash("sha256").update(rawManifest).digest("hex").toUpperCase();
  const manifest = parseCuratedCatalogManifest(JSON.parse(rawManifest.toString("utf8")));
  verifyApprovedManifest(manifest, manifestSha256);

  const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    pool: {
      max: Number(process.env.DB_POOL_MAX ?? 10),
      min: Number(process.env.DB_POOL_MIN ?? 0),
      idle: Number(process.env.DB_POOL_IDLE ?? 10_000),
      acquire: Number(process.env.DB_POOL_ACQUIRE ?? 30_000),
    },
  });
  try {
    const identityRows = await sequelize.query(
      "SELECT current_database() AS database, current_user AS user",
      { type: QueryTypes.SELECT },
    );
    const identity = identityRows[0];
    if (!identity || identity.database !== databaseTarget.database || identity.user !== databaseTarget.user) {
      throw new Error("Connected database identity does not match the approved local target.");
    }

    const lifecycle = new CatalogLifecycleService(
      manifest,
      manifestSha256,
      new JsonlCatalogAuditLedger(),
      {
        loadSnapshot: (trendId) => loadCatalogLifecycleSnapshot(sequelize, trendId),
        assertTransition: assertTrendTransition,
        validateTrend: (trendId, contentSha256) => transitionTrend(sequelize, trendId, "VALIDATED", contentSha256),
        publishTrend: (trendId, contentSha256) => transitionTrend(sequelize, trendId, "PUBLISHED", contentSha256),
      },
      { osAccount: os.userInfo().username },
    );
    const trendId = getOption(flags, "--trend-id");

    if (command === "review") {
      const event = await lifecycle.recordFactualReview({
        trendId,
        decision: parseDecision(getOption(flags, "--decision")),
        rationale: getOption(flags, "--rationale"),
        evidenceLimitations: getRepeatedOption(flags, "--limitation"),
      });
      console.info(`Factual review recorded: ${event.decision}; Trend ${event.trendId}; ledger sequence ${event.sequence}.`);
    } else if (command === "validate") {
      await lifecycle.validate({ trendId, confirmation: getOption(flags, "--confirm") });
      console.info(`Trend ${trendId} transitioned to VALIDATED; audit ledger updated.`);
    } else if (command === "approve-publication") {
      const event = await lifecycle.recordPublicationApproval({
        trendId,
        decision: parseDecision(getOption(flags, "--decision")),
        rationale: getOption(flags, "--rationale"),
      });
      console.info(`Publication decision recorded: ${event.decision}; Trend ${event.trendId}; ledger sequence ${event.sequence}.`);
    } else {
      await lifecycle.publish({ trendId, confirmation: getOption(flags, "--confirm") });
      console.info(`Trend ${trendId} transitioned to PUBLISHED; audit ledger updated.`);
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error(`Catalog lifecycle command failed (${errorName}). No credentials or provider details are included.`);
  process.exitCode = 1;
});
