import { readFile } from "node:fs/promises";
import path from "node:path";

import { Sequelize } from "sequelize";

import { parseCuratedCatalogManifest } from "../../src/catalog/catalog-manifest.ts";
import {
  assertApplyConfirmation,
  assertDatabaseIdentity,
  assertSafeCatalogTarget,
  CatalogImportError,
  targetFromDatabaseUrl,
} from "../../src/catalog/catalog-import.ts";
import { SequelizeCatalogImportRepository } from "./sequelize-catalog-repository.mjs";

function parseOptions(args) {
  let apply = false;
  let confirmDatabase;
  let confirmUser;
  for (const argument of args) {
    if (argument === "--apply") {
      if (apply) throw new CatalogImportError("Duplicate --apply flag.");
      apply = true;
    } else if (argument.startsWith("--confirm-db=")) {
      if (confirmDatabase !== undefined) throw new CatalogImportError("Duplicate --confirm-db flag.");
      confirmDatabase = argument.slice("--confirm-db=".length);
    } else if (argument.startsWith("--confirm-user=")) {
      if (confirmUser !== undefined) throw new CatalogImportError("Duplicate --confirm-user flag.");
      confirmUser = argument.slice("--confirm-user=".length);
    } else if (argument === "--dry-run") {
      if (apply) throw new CatalogImportError("Choose either --dry-run or --apply.");
    } else {
      throw new CatalogImportError("Unknown catalog importer argument.");
    }
  }
  if (!apply && (confirmDatabase !== undefined || confirmUser !== undefined)) {
    throw new CatalogImportError("Confirmation flags are only valid together with --apply.");
  }
  return { apply, confirmDatabase, confirmUser };
}

async function main() {
  let repository;
  try {
    const options = parseOptions(process.argv.slice(2));
    const databaseUrl = process.env.DATABASE_URL ?? "";
    const target = targetFromDatabaseUrl(databaseUrl, process.env.NODE_ENV);
    assertSafeCatalogTarget(target);
    assertApplyConfirmation(options.apply, {
      database: options.confirmDatabase,
      user: options.confirmUser,
    });

    const manifestPath = path.join(
      process.cwd(),
      "data",
      "catalog",
      "curated-fnb-2025-candidates.v1.json",
    );
    const manifest = parseCuratedCatalogManifest(JSON.parse(await readFile(manifestPath, "utf8")));
    const sequelize = new Sequelize(databaseUrl, {
      dialect: "postgres",
      logging: false,
      pool: { max: 1, min: 0, acquire: 5_000, idle: 1_000 },
    });
    repository = new SequelizeCatalogImportRepository(sequelize);

    const identity = await repository.readDatabaseIdentity();
    assertDatabaseIdentity(target, identity);
    const plan = options.apply
      ? await repository.apply(manifest)
      : await repository.preview(manifest);

    console.info(JSON.stringify({
      mode: options.apply ? "APPLY" : "DRY_RUN",
      target: { database: identity.database, user: identity.user },
      outcome: options.apply
        ? plan.action === "CREATE" ? "APPLIED" : "ALREADY_PRESENT"
        : plan.action,
      records: {
        trends: plan.trendCount,
        trendEvidence: plan.evidenceCount,
        opportunities: plan.opportunityCount,
      },
      writesExecuted: options.apply ? plan.databaseWrites : 0,
      note: options.apply
        ? "Only catalog records are eligible for creation; Trend lifecycle is forced to DRAFT."
        : "Read-only preview; no database writes were executed.",
    }, null, 2));
  } catch (error) {
    if (error instanceof CatalogImportError) {
      console.error("Catalog import stopped:", error.message);
    } else {
      console.error("Catalog import stopped:", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        detail: "Sensitive connection and provider details were suppressed.",
      });
    }
    process.exitCode = 1;
  } finally {
    if (repository) {
      try {
        await repository.close();
      } catch {
        process.exitCode = 1;
      }
    }
  }
}

await main();
