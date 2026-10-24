import { QueryTypes, Transaction, type Sequelize } from "sequelize";

import type { TrendEvidenceProvenanceInput } from "../trend/trend-evidence-provenance.schema";
import {
  GoogleTrendsProvenanceImportError,
  assertDisposableGoogleTrendsImportTarget,
  planGoogleTrendsProvenanceImport,
  prepareGoogleTrendsProvenanceImport,
  type GoogleTrendsProvenanceImportPlan,
  type GoogleTrendsProvenanceImportSnapshot,
  type PreparedGoogleTrendsProvenanceImport,
  type DisposableImportTarget,
} from "./google-trends-provenance-import";

const tables = Object.freeze({
  categories: '"fnb_categories"',
  trends: '"trends"',
  evidence: '"trend_evidences"',
  provenance: '"trend_evidence_provenances"',
});

export class SequelizeGoogleTrendsProvenanceImportRepository {
  private readonly target: DisposableImportTarget;

  constructor(
    private readonly sequelize: Sequelize,
    databaseUrl: string,
    nodeEnv = process.env.NODE_ENV,
  ) {
    this.target = assertDisposableGoogleTrendsImportTarget(databaseUrl, nodeEnv);
  }

  async apply(input: unknown): Promise<GoogleTrendsProvenanceImportPlan> {
    const prepared = prepareGoogleTrendsProvenanceImport(input);
    await this.#assertConnectedIdentity();

    try {
      return await this.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
      }, async (transaction) => {
        await this.#lockIdentities(prepared, transaction);
        const snapshot = await this.#readSnapshot(prepared, transaction);
        const plan = planGoogleTrendsProvenanceImport(prepared, snapshot);
        if (plan.action === "NO_OP") return plan;

        const categoryByCode = new Map(snapshot.categories.map((category) => [category.code, category]));
        for (const trend of prepared.records) {
          const category = trend.subjectAreaCode === null ? null : categoryByCode.get(trend.subjectAreaCode);
          const userTypeReplacements = Object.fromEntries(
            trend.affectedUserTypes.map((userType, index) => [`userType${index}`, userType]),
          );
          const userTypeValues = trend.affectedUserTypes.length === 0
            ? "'{}'::VARCHAR(32)[]"
            : `ARRAY[${trend.affectedUserTypes.map((_, index) => `:userType${index}`).join(", ")}]::VARCHAR(32)[]`;
          await this.sequelize.query(`
            INSERT INTO ${tables.trends} (
              "id", "title", "category_code", "fnb_category_id", "signal_summary",
              "signal_description", "direction", "period_start", "period_end",
              "business_relevance_explanation", "affected_user_types", "lifecycle_state",
              "archived_reason", "created_at", "updated_at"
            ) VALUES (
              :id, :title, :categoryCode, :subjectAreaId, :signalSummary,
              :signalDescription, :direction, :periodStart, :periodEnd,
              :businessRelevanceExplanation, ${userTypeValues}, 'DRAFT', NULL,
              CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )`, {
            replacements: {
              id: trend.id,
              title: trend.title,
              categoryCode: trend.categoryCode,
              subjectAreaId: category?.id ?? null,
              signalSummary: trend.signalSummary,
              signalDescription: trend.signalDescription,
              direction: trend.direction,
              periodStart: trend.periodStart,
              periodEnd: trend.periodEnd,
              businessRelevanceExplanation: trend.businessRelevanceExplanation,
              ...userTypeReplacements,
            },
            transaction,
          });

          for (const evidence of trend.evidence) {
            await this.sequelize.query(`
              INSERT INTO ${tables.evidence} (
                "id", "trend_id", "source_name", "source_reference", "supporting_detail",
                "source_date", "limitations", "created_at", "updated_at"
              ) VALUES (
                :id, :trendId, :sourceName, :sourceReference, :supportingDetail,
                NULL, :limitations, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )`, {
              replacements: {
                id: evidence.id,
                trendId: trend.id,
                sourceName: evidence.sourceName,
                sourceReference: evidence.sourceReference,
                supportingDetail: evidence.supportingDetail,
                limitations: evidence.limitations,
              },
              transaction,
            });

            const provenance = evidence.provenance;
            await this.sequelize.query(`
              INSERT INTO ${tables.provenance} (
                "trend_evidence_id", "schema_version", "source_id", "original_publisher",
                "transport_provider", "source_product", "collection_target_url", "retrieved_at",
                "observation_period_status", "observation_period_start", "observation_period_end",
                "geography_code", "metrics_availability", "metrics", "completeness",
                "created_at", "updated_at"
              ) VALUES (
                :trendEvidenceId, :schemaVersion, :sourceId, :originalPublisher,
                :transportProvider, :sourceProduct, :collectionTargetUrl, :retrievedAt,
                :observationPeriodStatus, :observationPeriodStart, :observationPeriodEnd,
                :geographyCode, :metricsAvailability, CAST(:metrics AS JSONB), :completeness,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )`, {
              replacements: { ...provenance, metrics: JSON.stringify(provenance.metrics) },
              transaction,
            });
          }
        }
        return plan;
      });
    } catch (error) {
      if (error instanceof GoogleTrendsProvenanceImportError) throw error;
      const databaseCode = (error as { parent?: { code?: string }; original?: { code?: string } })?.parent?.code ??
        (error as { original?: { code?: string } })?.original?.code;
      if (databaseCode === "40001" || databaseCode === "23505") {
        throw new GoogleTrendsProvenanceImportError(
          "CONCURRENT_CONFLICT",
          "Concurrent catalog import conflict; no partial transaction was committed.",
        );
      }
      throw new GoogleTrendsProvenanceImportError(
        "PERSISTENCE_FAILED",
        "Catalog DRAFT import failed; the transaction was rolled back.",
      );
    }
  }

  async #assertConnectedIdentity(): Promise<void> {
    let rows: { database: string; user: string; owner: string }[];
    try {
      rows = await this.sequelize.query<{
        database: string;
        user: string;
        owner: string;
      }>(`
        SELECT current_database() AS database,
          current_user AS "user",
          pg_get_userbyid(datdba) AS owner
        FROM pg_database WHERE datname = current_database()`,
      { type: QueryTypes.SELECT });
    } catch {
      throw new GoogleTrendsProvenanceImportError(
        "IDENTITY_MISMATCH",
        "Connected PostgreSQL identity could not be verified.",
      );
    }
    const identity = rows[0];
    if (
      !identity ||
      identity.database !== this.target.database ||
      identity.user !== this.target.user ||
      identity.owner !== this.target.user
    ) {
      throw new GoogleTrendsProvenanceImportError(
        "IDENTITY_MISMATCH",
        "Connected PostgreSQL identity does not match the disposable target.",
      );
    }
  }

  async #lockIdentities(
    prepared: PreparedGoogleTrendsProvenanceImport,
    transaction: Transaction,
  ): Promise<void> {
    const keys = prepared.records.flatMap((trend) => [
      `manifest:${prepared.manifestId}`,
      `trend:${trend.id}`,
      `trend-title:${trend.title}`,
      ...trend.evidence.map((evidence) => `evidence:${evidence.id}`),
    ]);
    for (const key of [...new Set(keys)].sort()) {
      await this.sequelize.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(:lockKey, 0))",
        { replacements: { lockKey: key }, transaction },
      );
    }
  }

  async #readSnapshot(
    prepared: PreparedGoogleTrendsProvenanceImport,
    transaction: Transaction,
  ): Promise<GoogleTrendsProvenanceImportSnapshot> {
    const trendIds = prepared.records.map(({ id }) => id);
    const titles = prepared.records.map(({ title }) => title);
    const evidenceIds = prepared.records.flatMap(({ evidence }) => evidence.map(({ id }) => id));
    const categoryCodes = [...new Set(prepared.records.flatMap(({ subjectAreaCode }) =>
      subjectAreaCode === null ? [] : [subjectAreaCode],
    ))];
    const categories = categoryCodes.length === 0
      ? []
      : await this.sequelize.query<GoogleTrendsProvenanceImportSnapshot["categories"][number]>(`
          SELECT "id", "code", "is_active" AS "isActive"
          FROM ${tables.categories} WHERE "code" IN (:categoryCodes)`, {
        replacements: { categoryCodes }, type: QueryTypes.SELECT, transaction,
      });
    const trends = await this.sequelize.query<GoogleTrendsProvenanceImportSnapshot["trends"][number]>(`
        SELECT "id", "title", "category_code" AS "categoryCode", "fnb_category_id" AS "subjectAreaId",
          "signal_summary" AS "signalSummary", "signal_description" AS "signalDescription",
          "direction", "period_start" AS "periodStart", "period_end" AS "periodEnd",
          "business_relevance_explanation" AS "businessRelevanceExplanation",
          "affected_user_types" AS "affectedUserTypes", "lifecycle_state" AS "lifecycleState",
          "archived_reason" AS "archivedReason"
        FROM ${tables.trends} WHERE "id" IN (:trendIds) OR "title" IN (:titles)`, {
        replacements: { trendIds, titles }, type: QueryTypes.SELECT, transaction,
      });
    const evidences = await this.sequelize.query<GoogleTrendsProvenanceImportSnapshot["evidences"][number]>(`
        SELECT "id", "trend_id" AS "trendId", "source_name" AS "sourceName",
          "source_reference" AS "sourceReference", "supporting_detail" AS "supportingDetail",
          "source_date" AS "sourceDate", "limitations"
        FROM ${tables.evidence} WHERE "trend_id" IN (:trendIds) OR "id" IN (:evidenceIds)`, {
        replacements: { trendIds, evidenceIds }, type: QueryTypes.SELECT, transaction,
      });
    const provenances = await this.sequelize.query<TrendEvidenceProvenanceInput>(`
        SELECT "trend_evidence_id" AS "trendEvidenceId", "schema_version" AS "schemaVersion",
          "source_id" AS "sourceId", "original_publisher" AS "originalPublisher",
          "transport_provider" AS "transportProvider", "source_product" AS "sourceProduct",
          "collection_target_url" AS "collectionTargetUrl", "retrieved_at" AS "retrievedAt",
          "observation_period_status" AS "observationPeriodStatus",
          "observation_period_start" AS "observationPeriodStart",
          "observation_period_end" AS "observationPeriodEnd", "geography_code" AS "geographyCode",
          "metrics_availability" AS "metricsAvailability", "metrics", "completeness"
        FROM ${tables.provenance} WHERE "trend_evidence_id" IN (:evidenceIds)`, {
        replacements: { evidenceIds }, type: QueryTypes.SELECT, transaction,
      });
    return { categories, trends, evidences, provenances };
  }
}
