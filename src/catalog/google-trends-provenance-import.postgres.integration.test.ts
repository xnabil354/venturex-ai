import { randomUUID } from "node:crypto";

import { QueryTypes, Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  assertDisposableGoogleTrendsImportTarget,
  GoogleTrendsProvenanceImportError,
  SequelizeGoogleTrendsProvenanceImportRepository,
  type GenericTrendManifestForImport,
} from "./google-trends-provenance-import";

const enabled = process.env.VENTUREX_GOOGLE_TRENDS_IMPORT_POSTGRES_INTEGRATION === "1";
const databaseUrl = process.env.VENTUREX_GOOGLE_TRENDS_IMPORT_TEST_DATABASE_URL;
let sequelize: Sequelize | undefined;
let repository: SequelizeGoogleTrendsProvenanceImportRepository | undefined;

function syntheticManifest(): GenericTrendManifestForImport {
  const trendId = randomUUID();
  const evidenceId = randomUUID();
  const targetUrl = "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1";
  return {
    manifestType: "VENTUREX_GENERIC_TREND_PREPARATION",
    manifestVersion: 1,
    manifestId: `synthetic-import-test-${randomUUID()}`,
    evidenceMode: "EXTERNAL_SOURCE_CLAIM",
    trends: [{
      id: trendId,
      title: `Synthetic persistence trend ${randomUUID()}`,
      categoryCode: "CONSUMER_BEHAVIOR",
      subjectAreaCode: null,
      signal: {
        summary: "Synthetic test signal; not an observed market claim.",
        summaryEvidenceIds: [evidenceId],
        description: "Synthetic test description only.",
        descriptionEvidenceIds: [evidenceId],
        direction: null,
        directionEvidenceIds: [],
        observationPeriod: { requiredForCuration: false, start: null, end: null, evidenceIds: [] },
        metrics: [{ name: "volume", rawValue: 120, unit: null, evidenceId, limitation: "Synthetic test value; unit unavailable." }],
        unavailableFields: ["related_queries"],
      },
      evidence: [{
        id: evidenceId,
        sourceName: "Google Trends Trending Now",
        sourceReference: targetUrl,
        providerName: null,
        sourceDate: null,
        retrievalTimestamp: "2026-10-13T00:00:00.123Z",
        supportingDetail: "Synthetic provider-shaped evidence fixture; not a provider response.",
        limitations: ["Synthetic fixture only; not factual evidence."],
        sourceProvenance: {
          schemaVersion: 1,
          sourceId: "google_trends_trending_now_indonesia",
          originalPublisher: "GOOGLE",
          transportProvider: "BRIGHTDATA_SERP_API",
          sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
          collectionTargetUrl: targetUrl,
          observationPeriodStatus: "NOT_PROVIDED",
          observationPeriodStart: null,
          observationPeriodEnd: null,
          geographyCode: "ID",
          relatedQueriesAvailability: "UNAVAILABLE",
          metricsAvailability: "PARTIAL",
          metrics: [
            { name: "volume", availability: "AVAILABLE", value: 120, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
            { name: "volume_change", availability: "UNAVAILABLE", value: null, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
          ],
          completeness: "PARTIAL",
        },
      }],
      businessRelevanceExplanation: null,
      affectedUserTypes: [],
      factualReview: {
        decision: "PENDING",
        reviewerIdentity: null,
        reviewedAt: null,
        evidenceLimitations: ["Synthetic test data has not been factually reviewed."],
      },
    }],
  };
}

async function countRows() {
  if (!sequelize) throw new Error("Disposable PostgreSQL is not initialized.");
  const rows = await sequelize.query<{
    trends: string;
    evidence: string;
    provenance: string;
    opportunities: string;
    published: string;
  }>(`
    SELECT
      (SELECT count(*) FROM trends)::text AS trends,
      (SELECT count(*) FROM trend_evidences)::text AS evidence,
      (SELECT count(*) FROM trend_evidence_provenances)::text AS provenance,
      (SELECT count(*) FROM opportunities)::text AS opportunities,
      (SELECT count(*) FROM trends WHERE lifecycle_state = 'PUBLISHED')::text AS published`,
  { type: QueryTypes.SELECT });
  return rows[0]!;
}

beforeAll(async () => {
  if (!enabled) return;
  if (!databaseUrl) throw new Error("Disposable import integration database is required when enabled.");
  const target = assertDisposableGoogleTrendsImportTarget(databaseUrl, "test");
  if (target.database.toLowerCase() === "venturex_dev") {
    throw new Error("Google Trends import integration refuses venturex_dev.");
  }
  sequelize = new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false,
    pool: { max: 8, min: 0, acquire: 5_000, idle: 1_000 },
  });
  await sequelize.authenticate();
  const identity = await sequelize.query<{
    database: string;
    user: string;
    owner: string;
    version: string;
  }>(`
    SELECT current_database() AS database, current_user AS "user",
      pg_get_userbyid(datdba) AS owner,
      current_setting('server_version_num') AS version
    FROM pg_database WHERE datname = current_database()`,
  { type: QueryTypes.SELECT });
  if (
    identity[0]?.database !== target.database ||
    identity[0]?.user !== target.user ||
    identity[0]?.owner !== target.user ||
    !identity[0]?.version.startsWith("18")
  ) {
    throw new Error("PostgreSQL identity does not match the disposable import test target.");
  }
  const migrations = await sequelize.query<{ name: string }>(
    'SELECT name FROM "SequelizeMeta" ORDER BY name',
    { type: QueryTypes.SELECT },
  );
  if (migrations.length !== 17 || migrations.at(-1)?.name !== "017-create-trend-evidence-provenances.ts") {
    throw new Error("The complete migration sequence 001-017 is required for import integration tests.");
  }

  await sequelize.query(`
    CREATE FUNCTION public.vx_catalog_test_fail_evidence_insert() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.supporting_detail = 'SYNTHETIC_TEST_FORCE_EVIDENCE_INSERT_FAILURE' THEN
        RAISE EXCEPTION 'synthetic evidence insert failure';
      END IF;
      RETURN NEW;
    END;
    $$`);
  await sequelize.query(`
    CREATE TRIGGER vx_catalog_test_fail_evidence_insert
    BEFORE INSERT ON trend_evidences
    FOR EACH ROW EXECUTE FUNCTION public.vx_catalog_test_fail_evidence_insert()`);
  await sequelize.query(`
    CREATE FUNCTION public.vx_catalog_test_fail_trend_insert() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.title = 'SYNTHETIC_TEST_FORCE_TREND_INSERT_FAILURE' THEN
        RAISE EXCEPTION 'synthetic trend insert failure';
      END IF;
      RETURN NEW;
    END;
    $$`);
  await sequelize.query(`
    CREATE TRIGGER vx_catalog_test_fail_trend_insert
    BEFORE INSERT ON trends
    FOR EACH ROW EXECUTE FUNCTION public.vx_catalog_test_fail_trend_insert()`);
  repository = new SequelizeGoogleTrendsProvenanceImportRepository(sequelize, databaseUrl, "test");
});

afterAll(async () => {
  if (sequelize) await sequelize.close();
});

describe.skipIf(!enabled)("Google Trends provenance DRAFT import PostgreSQL integration", () => {
  it("writes and reads back Trend, Evidence and bounded provenance as DRAFT", async () => {
    if (!sequelize || !repository) throw new Error("Disposable PostgreSQL is not initialized.");
    const before = await countRows();
    const manifest = syntheticManifest();
    const trendId = manifest.trends[0]!.id;
    const evidenceId = manifest.trends[0]!.evidence[0]!.id;
    const plan = await repository.apply(manifest);
    const rows = await sequelize.query<{
      lifecycleState: string;
      trendTitle: string;
      periodStart: string | null;
      periodEnd: string | null;
      sourceDate: Date | null;
      limitations: string;
      sourceId: string;
      publisher: string;
      transport: string;
      sourceProduct: string;
      retrieval: Date;
      periodStatus: string;
      metricsAvailability: string;
      metrics: { name: string; value: number | null; unit: string | null }[];
      completeness: string;
    }>(`
      SELECT t.lifecycle_state AS "lifecycleState", t.title AS "trendTitle",
        t.period_start AS "periodStart", t.period_end AS "periodEnd",
        e.source_date AS "sourceDate", e.limitations,
        p.source_id AS "sourceId", p.original_publisher AS publisher,
        p.transport_provider AS transport, p.source_product AS "sourceProduct",
        p.retrieved_at AS retrieval, p.observation_period_status AS "periodStatus",
        p.metrics_availability AS "metricsAvailability", p.metrics, p.completeness
      FROM trends t
      JOIN trend_evidences e ON e.trend_id = t.id
      JOIN trend_evidence_provenances p ON p.trend_evidence_id = e.id
      WHERE t.id = :trendId AND e.id = :evidenceId`, {
      replacements: { trendId, evidenceId }, type: QueryTypes.SELECT,
    });
    expect(plan).toMatchObject({ action: "CREATE", trendCount: 1, evidenceCount: 1, provenanceCount: 1, databaseWrites: 3 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      lifecycleState: "DRAFT",
      periodStart: null,
      periodEnd: null,
      sourceDate: null,
      sourceId: "google_trends_trending_now_indonesia",
      publisher: "GOOGLE",
      transport: "BRIGHTDATA_SERP_API",
      sourceProduct: "GOOGLE_TRENDS_TRENDING_NOW",
      retrieval: new Date("2026-10-13T00:00:00.123Z"),
      periodStatus: "NOT_PROVIDED",
      metricsAvailability: "PARTIAL",
      metrics: [
        expect.objectContaining({ name: "volume", value: 120, unit: null }),
        expect.objectContaining({ name: "volume_change", value: null }),
      ],
      completeness: "PARTIAL",
    });
    expect(rows[0]?.limitations).toContain("Provider field related_queries availability: UNAVAILABLE.");
    expect(rows[0]?.limitations).toContain("Source date is unavailable for Google Trends Trending Now");
    const after = await countRows();
    expect(Number(after.trends) - Number(before.trends)).toBe(1);
    expect(Number(after.evidence) - Number(before.evidence)).toBe(1);
    expect(Number(after.provenance) - Number(before.provenance)).toBe(1);
    expect(after.opportunities).toBe(before.opportunities);
    expect(after.published).toBe(before.published);
  });

  it("makes repeated exact imports no-ops without duplicates or updates", async () => {
    if (!repository) throw new Error("Disposable PostgreSQL is not initialized.");
    const manifest = syntheticManifest();
    const first = await repository.apply(manifest);
    const second = await repository.apply(manifest);
    expect(first.action).toBe("CREATE");
    expect(second).toMatchObject({ action: "NO_OP", databaseWrites: 0 });
    const counts = await countRows();
    expect(counts.opportunities).toBe("0");
  });

  it("serializes concurrent identical imports and reuses the committed DRAFT rows", async () => {
    if (!sequelize || !repository) throw new Error("Disposable PostgreSQL is not initialized.");
    const manifest = syntheticManifest();
    const trendId = manifest.trends[0]!.id;
    const evidenceId = manifest.trends[0]!.evidence[0]!.id;
    const results = await Promise.all([repository.apply(manifest), repository.apply(manifest)]);
    expect(results.map(({ action }) => action).sort()).toEqual(["CREATE", "NO_OP"]);
    const counts = await countRows();
    const identityCounts = await sequelize.query<{ trends: string; evidence: string; provenance: string }>(`
      SELECT (SELECT count(*) FROM trends WHERE id = :trendId)::text AS trends,
        (SELECT count(*) FROM trend_evidences WHERE id = :evidenceId)::text AS evidence,
        (SELECT count(*) FROM trend_evidence_provenances WHERE trend_evidence_id = :evidenceId)::text AS provenance`, {
      replacements: { trendId, evidenceId }, type: QueryTypes.SELECT,
    });
    expect(identityCounts[0]).toEqual({ trends: "1", evidence: "1", provenance: "1" });
    expect(Number(counts.opportunities)).toBe(0);
    expect(Number(counts.published)).toBe(0);
  });

  it("rejects a concurrent conflicting revision after the first import commits", async () => {
    if (!sequelize || !repository) throw new Error("Disposable PostgreSQL is not initialized.");
    const original = syntheticManifest();
    const trendId = original.trends[0]!.id;
    const evidenceId = original.trends[0]!.evidence[0]!.id;
    const changed = structuredClone(original);
    changed.trends[0]!.title = "Conflicting synthetic revision";
    const results = await Promise.allSettled([repository.apply(original), repository.apply(changed)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(GoogleTrendsProvenanceImportError);
      expect(rejected.reason.code).toBe("CATALOG_CONFLICT");
    }
    const persisted = await sequelize.query<{ title: string; trends: string; evidence: string }>(`
      SELECT (SELECT count(*)::text FROM trends WHERE id = :trendId) AS trends,
        (SELECT count(*)::text FROM trend_evidences WHERE id = :evidenceId) AS evidence,
        (SELECT title FROM trends WHERE id = :trendId) AS title`, {
      replacements: { trendId, evidenceId }, type: QueryTypes.SELECT,
    });
    expect(persisted[0]?.trends).toBe("1");
    expect(persisted[0]?.evidence).toBe("1");
    expect([original.trends[0]!.title, changed.trends[0]!.title]).toContain(persisted[0]?.title);
  });

  it("rolls back Trend insert if a later Evidence insert fails", async () => {
    if (!sequelize || !repository) throw new Error("Disposable PostgreSQL is not initialized.");
    const manifest = syntheticManifest();
    const trendId = manifest.trends[0]!.id;
    manifest.trends[0]!.evidence[0]!.supportingDetail = "SYNTHETIC_TEST_FORCE_EVIDENCE_INSERT_FAILURE";
    await expect(repository.apply(manifest)).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    const rows = await sequelize.query<{ trends: string; evidence: string; provenance: string }>(`
      SELECT (SELECT count(*) FROM trends WHERE id = :trendId)::text AS trends,
        (SELECT count(*) FROM trend_evidences WHERE trend_id = :trendId)::text AS evidence,
        (SELECT count(*) FROM trend_evidence_provenances WHERE trend_evidence_id = :evidenceId)::text AS provenance`, {
      replacements: { trendId, evidenceId: manifest.trends[0]!.evidence[0]!.id }, type: QueryTypes.SELECT,
    });
    expect(rows[0]).toEqual({ trends: "0", evidence: "0", provenance: "0" });
  });

  it("persists no Evidence when the initial Trend insert fails", async () => {
    if (!sequelize || !repository) throw new Error("Disposable PostgreSQL is not initialized.");
    const manifest = syntheticManifest();
    const trendId = manifest.trends[0]!.id;
    const evidenceId = manifest.trends[0]!.evidence[0]!.id;
    manifest.trends[0]!.title = "SYNTHETIC_TEST_FORCE_TREND_INSERT_FAILURE";
    await expect(repository.apply(manifest)).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    const rows = await sequelize.query<{ trends: string; evidence: string; provenance: string }>(`
      SELECT (SELECT count(*) FROM trends WHERE id = :trendId)::text AS trends,
        (SELECT count(*) FROM trend_evidences WHERE id = :evidenceId)::text AS evidence,
        (SELECT count(*) FROM trend_evidence_provenances WHERE trend_evidence_id = :evidenceId)::text AS provenance`, {
      replacements: { trendId, evidenceId }, type: QueryTypes.SELECT,
    });
    expect(rows[0]).toEqual({ trends: "0", evidence: "0", provenance: "0" });
  });

  it("rejects incomplete and unsupported manifests before writing rows", async () => {
    if (!repository) throw new Error("Disposable PostgreSQL is not initialized.");
    const before = await countRows();
    const incomplete = syntheticManifest();
    incomplete.trends[0]!.evidence[0]!.sourceDate = "2026-10-12";
    await expect(repository.apply(incomplete)).rejects.toBeInstanceOf(GoogleTrendsProvenanceImportError);

    const missingEvidence = syntheticManifest();
    missingEvidence.trends[0]!.evidence = [];
    await expect(repository.apply(missingEvidence)).rejects.toBeInstanceOf(GoogleTrendsProvenanceImportError);

    const invalidPeriod = syntheticManifest();
    invalidPeriod.trends[0]!.signal.observationPeriod.start = "2026-01-01";
    await expect(repository.apply(invalidPeriod)).rejects.toBeInstanceOf(GoogleTrendsProvenanceImportError);

    const unsupported = syntheticManifest();
    (unsupported.trends[0]!.evidence[0]!.sourceProvenance as unknown as { transportProvider: string }).transportProvider = "UNKNOWN";
    await expect(repository.apply(unsupported)).rejects.toBeInstanceOf(GoogleTrendsProvenanceImportError);
    const counts = await countRows();
    expect(counts).toEqual(before);
    expect(counts.opportunities).toBe("0");
    expect(counts.published).toBe("0");
  });
});
