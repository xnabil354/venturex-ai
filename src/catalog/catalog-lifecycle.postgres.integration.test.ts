import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { QueryTypes, Sequelize } from "sequelize";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  APPROVED_CATALOG_MANIFEST_SHA256,
  CatalogLifecycleService,
  JsonlCatalogAuditLedger,
} from "./catalog-lifecycle";
import { loadCatalogLifecycleSnapshot } from "./catalog-lifecycle-repository";
import { parseCuratedCatalogManifest } from "./catalog-manifest";
import { ONBOARDING_STATUSES, parseUserId, USER_TYPES, type SafeUser, type UserType } from "../auth/user-types";
import { TrendRepository } from "../trend/repository";
import { TrendService } from "../trend/service";
import { assertTrendTransition } from "../trend/domain";

const enabled = process.env.VENTUREX_CATALOG_LIFECYCLE_POSTGRES_INTEGRATION === "1";
const databaseUrl = process.env.VENTUREX_CATALOG_LIFECYCLE_TEST_DATABASE_URL;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const rawManifest = await (await import("node:fs/promises")).readFile(path.join(root, "data/catalog/curated-fnb-2025-candidates.v1.json"));
const manifest = parseCuratedCatalogManifest(JSON.parse(rawManifest.toString("utf8")));
const manifestSha256 = createHash("sha256").update(rawManifest).digest("hex").toUpperCase();
const trendIds = manifest.trends.map(({ id }) => id);
const opportunityIds = manifest.opportunities.map(({ id }) => id);
const activeUserId = "a1200000-2025-5500-8000-000000000001";
let sequelize: Sequelize | undefined;
let previousDatabaseUrl: string | undefined;
let auditDirectory: string | undefined;

function createUser(userType: UserType): SafeUser {
  return {
    id: parseUserId(activeUserId),
    email: "synthetic-catalog-review@example.test",
    userType,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  };
}

function assertDisposableDatabaseUrl(value: string | undefined): asserts value is string {
  if (!value) throw new Error("Disposable integration URL is required when the lifecycle PostgreSQL suite is enabled.");
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(url.username);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(host) ||
    url.port !== "55432" ||
    database !== "venturex_catalog_lifecycle_test" ||
    user !== "venturex"
  ) {
    throw new Error("Lifecycle integration tests refuse any database except the named loopback disposable target on port 55432.");
  }
}

async function seedApprovedManifest(): Promise<void> {
  if (!sequelize) throw new Error("Disposable PostgreSQL is not initialized.");
  const existingRows = await sequelize.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM trends WHERE id = ANY($1::uuid[])",
    { bind: [trendIds], type: QueryTypes.SELECT },
  );
  if (existingRows[0]?.count !== "0") throw new Error("Disposable database already contains one of the fixed integration Trend IDs.");

  const categories = await sequelize.query<{ id: string; code: string }>(
    "SELECT id::text AS id, code FROM fnb_categories WHERE code = ANY($1::varchar[])",
    {
      bind: [[...new Set(manifest.trends.map(({ subjectAreaCode }) => subjectAreaCode))]],
      type: QueryTypes.SELECT,
    },
  );
  const categoryIds = new Map(categories.map(({ id, code }) => [code, id]));
  if (categoryIds.size !== 2) throw new Error("Disposable database reference categories were not seeded.");

  await sequelize.transaction(async (transaction) => {
    for (const trend of manifest.trends) {
      const categoryId = categoryIds.get(trend.subjectAreaCode);
      if (!categoryId) throw new Error("Required test category was not found.");
      await sequelize!.query(
        `INSERT INTO trends
          (id, title, category_code, fnb_category_id, signal_summary, signal_description,
           direction, period_start, period_end, business_relevance_explanation,
           affected_user_types, lifecycle_state, archived_reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::varchar(32)[], 'DRAFT', NULL, NOW(), NOW())`,
        {
          bind: [trend.id, trend.title, trend.categoryCode, categoryId, trend.signal.summary,
            trend.signal.description, trend.signal.direction, trend.signal.periodStart,
            trend.signal.periodEnd, trend.businessRelevanceExplanation, trend.affectedUserTypes],
          transaction,
        },
      );
      for (const evidence of trend.evidence) {
        await sequelize!.query(
          `INSERT INTO trend_evidences
            (id, trend_id, source_name, source_reference, supporting_detail, source_date, limitations, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NULL, $6, NOW(), NOW())`,
          { bind: [evidence.id, trend.id, evidence.sourceName, evidence.sourceReference, evidence.supportingDetail, evidence.limitations], transaction },
        );
      }
    }
    for (const opportunity of manifest.opportunities) {
      const categoryId = categoryIds.get(opportunity.fnbCategoryCode);
      if (!categoryId) throw new Error("Required Opportunity category was not found.");
      await sequelize!.query(
        `INSERT INTO opportunities
          (id, related_trend_id, fnb_category_id, name, description, opportunity_type,
           target_consumer_summary, competition_level, competition_summary,
           execution_feasibility, market_sustainability, additional_attributes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb, NOW(), NOW())`,
        { bind: [opportunity.id, opportunity.relatedTrendId, categoryId, opportunity.name, opportunity.description, opportunity.opportunityType], transaction },
      );
    }
  });
}

async function createLifecycle(trendId: string) {
  if (!sequelize) throw new Error("Disposable PostgreSQL is not initialized.");
  auditDirectory = await mkdtemp(path.join(os.tmpdir(), "venturex-catalog-lifecycle-postgres-"));
  const repository = new TrendRepository(sequelize);
  const trendService = new TrendService(repository);
  const lifecycle = new CatalogLifecycleService(
    manifest,
    manifestSha256,
    new JsonlCatalogAuditLedger(path.join(auditDirectory, `audit-${trendId}.jsonl`)),
    {
      loadSnapshot: (id) => loadCatalogLifecycleSnapshot(sequelize!, id),
      assertTransition: assertTrendTransition,
      validateTrend: (id) => trendService.validateTrend(id),
      publishTrend: (id) => trendService.publishTrend(id),
    },
    { osAccount: "disposable-postgres-integration-test" },
  );
  return lifecycle;
}

beforeAll(async () => {
  if (!enabled) return;
  assertDisposableDatabaseUrl(databaseUrl);
  previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  sequelize = new Sequelize(databaseUrl, { dialect: "postgres", logging: false });
  await sequelize.authenticate();
  const identity = await sequelize.query<{ database: string; user: string }>(
    "SELECT current_database() AS database, current_user AS user",
    { type: QueryTypes.SELECT },
  );
  if (identity[0]?.database !== "venturex_catalog_lifecycle_test" || identity[0]?.user !== "venturex") {
    throw new Error("PostgreSQL identity does not match the disposable test target.");
  }
  const runtime = globalThis as typeof globalThis & { __venturexSequelize?: Sequelize };
  runtime.__venturexSequelize = sequelize;
  await seedApprovedManifest();
});

afterAll(async () => {
  if (sequelize) {
    try {
      await sequelize.query("DELETE FROM opportunities WHERE id = ANY($1::uuid[])", { bind: [opportunityIds] });
      await sequelize.query("DELETE FROM trend_evidences WHERE trend_id = ANY($1::uuid[])", { bind: [trendIds] });
      await sequelize.query("DELETE FROM trends WHERE id = ANY($1::uuid[])", { bind: [trendIds] });
    } finally {
      await sequelize.close();
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  }
  if (auditDirectory) await rm(auditDirectory, { recursive: true, force: true });
});

describe.skipIf(!enabled)("curated catalog lifecycle PostgreSQL integration", () => {
  it("keeps both DRAFT Trends invisible to both account audiences", async () => {
    for (const userType of [USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING] as const) {
      const service = new TrendService(new TrendRepository(sequelize!), async () => createUser(userType));
      await expect(service.getPublishedTrends()).resolves.toEqual([]);
      for (const trendId of trendIds) await expect(service.getPublishedTrend(trendId)).resolves.toBeNull();
    }
  });

  it("rejects missing review, missing publication approval, invalid transitions, and checksum mismatch", async () => {
    const trendId = trendIds[0]!;
    const lifecycle = await createLifecycle(trendId);
    await expect(lifecycle.validate({ trendId, confirmation: `VALIDATE ${trendId}` })).rejects.toThrow(/FACTUAL_REVIEW is missing/);
    await expect(lifecycle.publish({ trendId, confirmation: `PUBLISH ${trendId}` })).rejects.toThrow(/must be VALIDATED/);
    await expect(lifecycle.recordPublicationApproval({
      trendId,
      decision: "APPROVED",
      rationale: "This should fail without an approved factual review.",
    })).rejects.toThrow(/must be VALIDATED/);
    expect(() => new CatalogLifecycleService(
      manifest,
      "0".repeat(64),
      new JsonlCatalogAuditLedger(path.join(auditDirectory!, "wrong-checksum.jsonl")),
      { loadSnapshot: (id) => loadCatalogLifecycleSnapshot(sequelize!, id), assertTransition: assertTrendTransition, validateTrend: async () => undefined, publishTrend: async () => undefined },
      { osAccount: "integration-test" },
    )).toThrow(/approved identifier and checksum/);
    const state = await sequelize!.query<{ lifecycleState: string }>(
      "SELECT lifecycle_state AS \"lifecycleState\" FROM trends WHERE id = $1",
      { bind: [trendId], type: QueryTypes.SELECT },
    );
    expect(state[0]?.lifecycleState).toBe("DRAFT");
    expect(manifestSha256).toBe(APPROVED_CATALOG_MANIFEST_SHA256);
  });

  it("rejects database content changed after factual review", async () => {
    const trendId = trendIds[1]!;
    const lifecycle = await createLifecycle(trendId);
    const original = manifest.trends.find(({ id }) => id === trendId)!.signal.summary;
    await lifecycle.recordFactualReview({
      trendId,
      decision: "APPROVED",
      rationale: "Synthetic integration factual review with explicit scope limitations.",
      evidenceLimitations: ["Historical relative interest is not purchase demand."],
    });
    await sequelize!.query("UPDATE trends SET signal_summary = $2 WHERE id = $1", {
      bind: [trendId, "changed after factual review"],
    });
    await expect(lifecycle.validate({ trendId, confirmation: `VALIDATE ${trendId}` }))
      .rejects.toThrow(/differs from the approved manifest/);
    await sequelize!.query("UPDATE trends SET signal_summary = $2 WHERE id = $1", { bind: [trendId, original] });
    const state = await sequelize!.query<{ lifecycleState: string }>(
      "SELECT lifecycle_state AS \"lifecycleState\" FROM trends WHERE id = $1",
      { bind: [trendId], type: QueryTypes.SELECT },
    );
    expect(state[0]?.lifecycleState).toBe("DRAFT");
  });

  it.each(trendIds)("requires review and owner approval before publishing Trend %s and applies audience visibility", async (trendId) => {
    const lifecycle = await createLifecycle(trendId);
    await lifecycle.recordFactualReview({
      trendId,
      decision: "APPROVED",
      rationale: "Synthetic integration review checked the provided source and its limitations.",
      evidenceLimitations: ["Year in Search rank does not prove purchasing demand or current interest."],
    });
    await lifecycle.validate({ trendId, confirmation: `VALIDATE ${trendId}` });
    await expect(lifecycle.publish({ trendId, confirmation: `PUBLISH ${trendId}` }))
      .rejects.toThrow(/PUBLICATION_APPROVAL is missing/);
    await lifecycle.recordPublicationApproval({
      trendId,
      decision: "REJECTED",
      rationale: "Synthetic negative Product Owner decision must block publication.",
    });
    await expect(lifecycle.publish({ trendId, confirmation: `PUBLISH ${trendId}` }))
      .rejects.toThrow(/PUBLICATION_APPROVAL is missing, rejected/);
    await lifecycle.recordPublicationApproval({
      trendId,
      decision: "APPROVED",
      rationale: "Synthetic Product Owner approval for lifecycle integration testing.",
    });
    await lifecycle.publish({ trendId, confirmation: `PUBLISH ${trendId}` });

    for (const userType of [USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING] as const) {
      const service = new TrendService(new TrendRepository(sequelize!), async () => createUser(userType));
      await expect(service.getPublishedTrend(trendId)).resolves.toMatchObject({ id: trendId, lifecycleState: "PUBLISHED" });
      await expect(service.getPublishedTrends()).resolves.toEqual(expect.arrayContaining([
        expect.objectContaining({ id: trendId, lifecycleState: "PUBLISHED" }),
      ]));
    }
    const state = await sequelize!.query<{ lifecycleState: string }>(
      "SELECT lifecycle_state AS \"lifecycleState\" FROM trends WHERE id = $1",
      { bind: [trendId], type: QueryTypes.SELECT },
    );
    expect(state[0]?.lifecycleState).toBe("PUBLISHED");
  });
});
