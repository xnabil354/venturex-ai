import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { QueryTypes, Sequelize } from "sequelize";

vi.mock("server-only", () => ({}));

import { getTrendModel } from "../db/models/trend.model";
import { getTrendEvidenceModel } from "../db/models/trend.model";
import {
  createTrendEvidenceProvenance,
  getTrendEvidenceProvenanceModel,
  type TrendEvidenceProvenanceInput,
} from "../db/models/trend-evidence-provenance.model";
import { TrendRepository } from "./repository";
import { trendIdSchema } from "./domain";

const enabled = process.env.VENTUREX_TREND_EVIDENCE_PROVENANCE_POSTGRES_INTEGRATION === "1";
const databaseUrl = process.env.VENTUREX_TREND_EVIDENCE_PROVENANCE_TEST_DATABASE_URL;
let sequelize: Sequelize | undefined;
let previousSequelize: Sequelize | undefined;
let trendIds: string[] = [];

function assertDisposableDatabaseUrl(value: string | undefined): asserts value is string {
  if (!value) throw new Error("Disposable provenance integration URL is required when the suite is enabled.");
  const url = new URL(value);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55433" ||
    decodeURIComponent(url.pathname.replace(/^\//, "")) !== "venturex_trend_evidence_provenance_test" ||
    decodeURIComponent(url.username) !== "venturex" ||
    url.password !== ""
  ) {
    throw new Error("Provenance integration tests refuse any database except the named loopback disposable target on port 55433.");
  }
}

function makeTrendEvidenceProvenance(trendEvidenceId: string): TrendEvidenceProvenanceInput {
  return {
    trendEvidenceId,
    schemaVersion: 1,
    sourceId: "google_trends_trending_now_indonesia",
    originalPublisher: "GOOGLE",
    transportProvider: "BRIGHTDATA_SERP_API",
    sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
    collectionTargetUrl: "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1",
    retrievedAt: new Date("2025-10-20T10:00:00.000Z"),
    observationPeriodStatus: "NOT_PROVIDED",
    observationPeriodStart: null,
    observationPeriodEnd: null,
    geographyCode: "ID",
    metricsAvailability: "AVAILABLE",
    metrics: [{ name: "volume", availability: "AVAILABLE", value: 1200, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null }],
    completeness: "COMPLETE",
  };
}

async function createEvidence() {
  if (!sequelize) throw new Error("Disposable PostgreSQL is not initialized.");
  const trend = await getTrendModel().create({
    title: "Synthetic provenance integration trend",
    categoryCode: "PRODUCT_MENU",
    subjectAreaId: null,
    signalSummary: "Synthetic fixture for provenance persistence testing.",
    signalDescription: "No external provider output or real market claim is present.",
    direction: null,
    periodStart: null,
    periodEnd: null,
    businessRelevanceExplanation: null,
    affectedUserTypes: [],
    lifecycleState: "DRAFT",
    archivedReason: null,
  });
  trendIds.push(trend.id);
  const evidence = await getTrendEvidenceModel().create({
    trendId: trend.id,
    sourceName: "Synthetic evidence source",
    sourceReference: "https://example.test/synthetic-evidence",
    supportingDetail: "Synthetic test evidence only.",
    sourceDate: null,
    limitations: "Synthetic fixture; not factual evidence.",
  });
  return evidence;
}

beforeAll(async () => {
  if (!enabled) return;
  assertDisposableDatabaseUrl(databaseUrl);
  previousSequelize = globalThis.__venturexSequelize;
  sequelize = new Sequelize(databaseUrl, { dialect: "postgres", logging: false });
  await sequelize.authenticate();
  const identity = await sequelize.query<{ database: string; user: string; port: number | null }>(
    "SELECT current_database() AS database, current_user AS user, inet_server_port() AS port",
    { type: QueryTypes.SELECT },
  );
  if (
    identity[0]?.database !== "venturex_trend_evidence_provenance_test" ||
    identity[0]?.user !== "venturex" ||
    identity[0]?.port !== 5432
  ) {
    throw new Error("PostgreSQL identity does not match the isolated Docker provenance test target.");
  }
  globalThis.__venturexSequelize = sequelize;
  const table = await sequelize.query<{ exists: boolean }>(
    "SELECT to_regclass('public.trend_evidence_provenances') IS NOT NULL AS exists",
    { type: QueryTypes.SELECT },
  );
  if (table[0]?.exists !== true) throw new Error("Complete migration sequence has not created the provenance table.");
});

afterEach(async () => {
  if (sequelize && trendIds.length > 0) {
    await sequelize.query("DELETE FROM trends WHERE id = ANY($1::uuid[])", { bind: [trendIds] });
    trendIds = [];
  }
});

afterAll(async () => {
  if (sequelize) await sequelize.close();
  if (previousSequelize) globalThis.__venturexSequelize = previousSequelize;
  else globalThis.__venturexSequelize = undefined;
});

describe.skipIf(!enabled)("Trend evidence provenance PostgreSQL integration", () => {
  it("inserts and retrieves approved synthetic metadata through the one-to-one association", async () => {
    const evidence = await createEvidence();
    const Provenance = getTrendEvidenceProvenanceModel();
    await createTrendEvidenceProvenance(makeTrendEvidenceProvenance(evidence.id));

    const loaded = await getTrendEvidenceModel().findByPk(evidence.id, {
      include: [{ model: Provenance, as: "provenance", required: false }],
    });
    expect(loaded?.provenance).toMatchObject({
      trendEvidenceId: evidence.id,
      sourceId: "google_trends_trending_now_indonesia",
      originalPublisher: "GOOGLE",
      transportProvider: "BRIGHTDATA_SERP_API",
      retrievedAt: new Date("2025-10-20T10:00:00.000Z"),
      observationPeriodStatus: "NOT_PROVIDED",
      observationPeriodStart: null,
      observationPeriodEnd: null,
      metrics: [{ value: 1200, semanticAvailability: "UNKNOWN", unitAvailability: "UNKNOWN" }],
    });
  });

  it("enforces the foreign key and one-provenance-per-evidence primary key", async () => {
    const evidence = await createEvidence();
    const Provenance = getTrendEvidenceProvenanceModel();
    await expect(createTrendEvidenceProvenance(makeTrendEvidenceProvenance(randomUUID()))).rejects.toMatchObject({ name: "SequelizeForeignKeyConstraintError" });
    await createTrendEvidenceProvenance(makeTrendEvidenceProvenance(evidence.id));
    await expect(createTrendEvidenceProvenance(makeTrendEvidenceProvenance(evidence.id))).rejects.toMatchObject({ name: "SequelizeUniqueConstraintError" });
  });

  it("enforces the metadata version and JSON shape constraints in PostgreSQL", async () => {
    const evidence = await createEvidence();
    const metadata = makeTrendEvidenceProvenance(evidence.id);
    const insertSql = `
      INSERT INTO trend_evidence_provenances
        (trend_evidence_id, schema_version, source_id, original_publisher, transport_provider,
         source_product, collection_target_url, retrieved_at, observation_period_status,
         observation_period_start, observation_period_end, geography_code,
         metrics_availability, metrics, completeness)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)
    `;
    const bind = (schemaVersion: number, metrics: string) => [
      evidence.id,
      schemaVersion,
      metadata.sourceId,
      metadata.originalPublisher,
      metadata.transportProvider,
      metadata.sourceProduct,
      metadata.collectionTargetUrl,
      metadata.retrievedAt,
      metadata.observationPeriodStatus,
      metadata.observationPeriodStart,
      metadata.observationPeriodEnd,
      metadata.geographyCode,
      metadata.metricsAvailability,
      metrics,
      metadata.completeness,
    ];

    await expect(sequelize!.query(insertSql, { bind: bind(2, JSON.stringify(metadata.metrics)) }))
      .rejects.toThrow(/trend_evidence_provenances_schema_version_check/);
    await expect(sequelize!.query(insertSql, { bind: bind(1, "{}") }))
      .rejects.toThrow(/trend_evidence_provenances_metrics_shape_check/);
  });

  it("keeps legacy Trend Evidence readable when it has no provenance row", async () => {
    const evidence = await createEvidence();
    const trend = await getTrendModel().findByPk(evidence.trendId);
    expect(trend).not.toBeNull();
    const repository = new TrendRepository(
      sequelize!,
      getTrendModel(),
      getTrendEvidenceModel(),
      { findAll: vi.fn().mockResolvedValue([]) } as never,
    );
    await expect(repository.findById(trendIdSchema.parse(trend!.id))).resolves.toMatchObject({
      id: trend!.id,
      evidence: [expect.objectContaining({ id: evidence.id, sourceName: "Synthetic evidence source" })],
    });
    const withOptionalRelation = await getTrendEvidenceModel().findByPk(evidence.id, {
      include: [{ model: getTrendEvidenceProvenanceModel(), as: "provenance", required: false }],
    });
    expect(withOptionalRelation?.provenance).toBeNull();
  });

  it("rejects malformed URLs, unsupported versions, and unknown JSON metadata fields", async () => {
    const evidence = await createEvidence();
    const Provenance = getTrendEvidenceProvenanceModel();
    await expect(createTrendEvidenceProvenance({ ...makeTrendEvidenceProvenance(evidence.id), schemaVersion: 2 })).rejects.toThrow();
    await expect(createTrendEvidenceProvenance({ ...makeTrendEvidenceProvenance(evidence.id), collectionTargetUrl: "http://example.test/" })).rejects.toThrow();
    await expect(createTrendEvidenceProvenance({
      ...makeTrendEvidenceProvenance(evidence.id),
      metrics: [{ ...makeTrendEvidenceProvenance(evidence.id).metrics[0]!, rawProviderPayload: { query: "synthetic" } }],
    })).rejects.toThrow();
  });
});
