import { QueryTypes, type Sequelize } from "sequelize";

import {
  isCatalogFingerprintV2Snapshot,
  type CatalogFingerprintVersion,
  type CatalogFingerprintV2Snapshot,
} from "./catalog-fingerprint";
import type { CatalogLifecycleSnapshot } from "./catalog-lifecycle";

export type VersionedCatalogLifecycleSnapshot =
  | { readonly fingerprintVersion: 1; readonly snapshot: CatalogLifecycleSnapshot }
  | { readonly fingerprintVersion: 2; readonly snapshot: CatalogFingerprintV2Snapshot };

type FingerprintV2TrendRow = {
  readonly id: string;
  readonly title: string;
  readonly categoryCode: string;
  readonly subjectAreaCode: string | null;
  readonly signalSummary: string;
  readonly signalDescription: string;
  readonly direction: string | null;
  readonly periodStart: unknown;
  readonly periodEnd: unknown;
  readonly businessRelevanceExplanation: string | null;
  readonly affectedUserTypes: string[];
};

type FingerprintV2EvidenceRow = {
  readonly id: string;
  readonly sourceName: string;
  readonly sourceReference: string;
  readonly supportingDetail: string;
  readonly sourceDate: unknown;
  readonly limitations: string | null;
  readonly provenanceSchemaVersion: unknown;
  readonly provenanceSourceId: unknown;
  readonly provenanceOriginalPublisher: unknown;
  readonly provenanceTransportProvider: unknown;
  readonly provenanceSourceProduct: unknown;
  readonly provenanceCollectionTargetUrl: unknown;
  readonly provenanceRetrievedAt: unknown;
  readonly provenanceObservationPeriodStatus: unknown;
  readonly provenanceObservationPeriodStart: unknown;
  readonly provenanceObservationPeriodEnd: unknown;
  readonly provenanceGeographyCode: unknown;
  readonly provenanceMetricsAvailability: unknown;
  readonly provenanceMetrics: unknown;
  readonly provenanceCompleteness: unknown;
};

function dateOnly(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function loadCatalogLifecycleSnapshot(
  sequelize: Sequelize,
  trendId: string,
): Promise<CatalogLifecycleSnapshot | null> {
  const trendRows = await sequelize.query<CatalogLifecycleSnapshot["trend"]>(
    `SELECT t.id::text AS id, t.title, t.category_code AS "categoryCode",
            c.code AS "subjectAreaCode", t.signal_summary AS "signalSummary",
            t.signal_description AS "signalDescription", t.direction,
            t.period_start AS "periodStart", t.period_end AS "periodEnd",
            t.business_relevance_explanation AS "businessRelevanceExplanation",
            t.affected_user_types AS "affectedUserTypes", t.lifecycle_state AS "lifecycleState"
       FROM trends AS t
       LEFT JOIN fnb_categories AS c ON c.id = t.fnb_category_id
      WHERE t.id = $1`,
    { bind: [trendId], type: QueryTypes.SELECT },
  );
  const trend = trendRows[0];
  if (!trend) return null;

  const evidence = await sequelize.query<CatalogLifecycleSnapshot["trend"]["evidence"][number]>(
    `SELECT id::text AS id, source_name AS "sourceName", source_reference AS "sourceReference",
            supporting_detail AS "supportingDetail", source_date AS "sourceDate", limitations
       FROM trend_evidences
      WHERE trend_id = $1
      ORDER BY id ASC`,
    { bind: [trendId], type: QueryTypes.SELECT },
  );
  const opportunities = await sequelize.query<CatalogLifecycleSnapshot["opportunities"][number]>(
    `SELECT o.id::text AS id, o.related_trend_id::text AS "relatedTrendId",
            c.code AS "fnbCategoryCode", o.name, o.description,
            o.opportunity_type AS "opportunityType",
            o.target_consumer_summary AS "targetConsumerSummary",
            o.competition_level AS "competitionLevel",
            o.competition_summary AS "competitionSummary",
            o.execution_feasibility AS "executionFeasibility",
            o.market_sustainability AS "marketSustainability",
            o.additional_attributes AS "additionalAttributes"
       FROM opportunities AS o
       LEFT JOIN fnb_categories AS c ON c.id = o.fnb_category_id
      WHERE o.related_trend_id = $1
      ORDER BY o.id ASC`,
    { bind: [trendId], type: QueryTypes.SELECT },
  );

  return {
    trend: {
      ...trend,
      periodStart: dateOnly(trend.periodStart),
      periodEnd: dateOnly(trend.periodEnd),
      evidence: evidence.map((item) => ({ ...item, sourceDate: dateOnly(item.sourceDate) })),
    },
    opportunities: opportunities.map((item) => ({
      ...item,
      additionalAttributes: item.additionalAttributes ?? {},
    })),
  };
}

/**
 * Loads a snapshot only for the explicitly requested fingerprint contract.
 * Version 1 delegates to the historical loader unchanged. Version 2 contains
 * Trend and Evidence only and never queries Opportunity rows.
 */
export async function loadVersionedCatalogLifecycleSnapshot(
  sequelize: Sequelize,
  trendId: string,
  fingerprintVersion: CatalogFingerprintVersion,
): Promise<VersionedCatalogLifecycleSnapshot | null> {
  if (fingerprintVersion === 1) {
    const snapshot = await loadCatalogLifecycleSnapshot(sequelize, trendId);
    return snapshot === null ? null : { fingerprintVersion: 1, snapshot };
  }
  if (fingerprintVersion !== 2) throw new Error("Unsupported catalog fingerprint version.");

  const trendRows = await sequelize.query<FingerprintV2TrendRow>(
    `SELECT t.id::text AS id, t.title, t.category_code AS "categoryCode",
            c.code AS "subjectAreaCode", t.signal_summary AS "signalSummary",
            t.signal_description AS "signalDescription", t.direction,
            t.period_start AS "periodStart", t.period_end AS "periodEnd",
            t.business_relevance_explanation AS "businessRelevanceExplanation",
            t.affected_user_types AS "affectedUserTypes"
       FROM trends AS t
       LEFT JOIN fnb_categories AS c ON c.id = t.fnb_category_id
      WHERE t.id = $1`,
    { bind: [trendId], type: QueryTypes.SELECT },
  );
  const trend = trendRows[0];
  if (!trend) return null;

  const evidenceRows = await sequelize.query<FingerprintV2EvidenceRow>(
    `SELECT e.id::text AS id, e.source_name AS "sourceName",
            e.source_reference AS "sourceReference", e.supporting_detail AS "supportingDetail",
            e.source_date AS "sourceDate", e.limitations,
            p.schema_version AS "provenanceSchemaVersion", p.source_id AS "provenanceSourceId",
            p.original_publisher AS "provenanceOriginalPublisher",
            p.transport_provider AS "provenanceTransportProvider",
            p.source_product AS "provenanceSourceProduct",
            p.collection_target_url AS "provenanceCollectionTargetUrl",
            p.retrieved_at AS "provenanceRetrievedAt",
            p.observation_period_status AS "provenanceObservationPeriodStatus",
            p.observation_period_start AS "provenanceObservationPeriodStart",
            p.observation_period_end AS "provenanceObservationPeriodEnd",
            p.geography_code AS "provenanceGeographyCode",
            p.metrics_availability AS "provenanceMetricsAvailability",
            p.metrics AS "provenanceMetrics", p.completeness AS "provenanceCompleteness"
       FROM trend_evidences AS e
       LEFT JOIN trend_evidence_provenances AS p ON p.trend_evidence_id = e.id
      WHERE e.trend_id = $1
      ORDER BY e.id ASC`,
    { bind: [trendId], type: QueryTypes.SELECT },
  );

  const evidence = evidenceRows.map((row) => {
    const provenanceColumns = [
      row.provenanceSourceId,
      row.provenanceOriginalPublisher,
      row.provenanceTransportProvider,
      row.provenanceSourceProduct,
      row.provenanceCollectionTargetUrl,
      row.provenanceRetrievedAt,
      row.provenanceObservationPeriodStatus,
      row.provenanceObservationPeriodStart,
      row.provenanceObservationPeriodEnd,
      row.provenanceGeographyCode,
      row.provenanceMetricsAvailability,
      row.provenanceMetrics,
      row.provenanceCompleteness,
    ];
    if (row.provenanceSchemaVersion === null && provenanceColumns.some((value) => value !== null)) {
      throw new Error("Version 2 lifecycle snapshot contains an incomplete provenance row.");
    }

    const provenance = row.provenanceSchemaVersion === null ? null : {
      trendEvidenceId: row.id,
      schemaVersion: row.provenanceSchemaVersion,
      sourceId: row.provenanceSourceId,
      originalPublisher: row.provenanceOriginalPublisher,
      transportProvider: row.provenanceTransportProvider,
      sourceProduct: row.provenanceSourceProduct,
      collectionTargetUrl: row.provenanceCollectionTargetUrl,
      retrievedAt: row.provenanceRetrievedAt,
      observationPeriodStatus: row.provenanceObservationPeriodStatus,
      observationPeriodStart: dateOnly(row.provenanceObservationPeriodStart),
      observationPeriodEnd: dateOnly(row.provenanceObservationPeriodEnd),
      geographyCode: row.provenanceGeographyCode,
      metricsAvailability: row.provenanceMetricsAvailability,
      metrics: row.provenanceMetrics,
      completeness: row.provenanceCompleteness,
    };

    return {
      id: row.id,
      sourceName: row.sourceName,
      sourceReference: row.sourceReference,
      supportingDetail: row.supportingDetail,
      sourceDate: dateOnly(row.sourceDate),
      limitations: row.limitations,
      provenance,
    };
  }).sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

  const candidate = {
    id: trend.id,
    title: trend.title,
    categoryCode: trend.categoryCode,
    subjectAreaCode: trend.subjectAreaCode,
    signalSummary: trend.signalSummary,
    signalDescription: trend.signalDescription,
    direction: trend.direction,
    periodStart: dateOnly(trend.periodStart),
    periodEnd: dateOnly(trend.periodEnd),
    businessRelevanceExplanation: trend.businessRelevanceExplanation,
    affectedUserTypes: [...trend.affectedUserTypes].sort(),
    evidence,
  };

  if (!isCatalogFingerprintV2Snapshot(candidate)) {
    throw new Error("Version 2 lifecycle snapshot failed strict Trend and Evidence validation.");
  }

  const snapshot: CatalogFingerprintV2Snapshot = {
    ...candidate,
    evidence: candidate.evidence.map((item) => item.provenance === null ? item : ({
      ...item,
      provenance: {
        ...item.provenance,
        metrics: [...item.provenance.metrics].sort((left, right) =>
          left.name < right.name ? -1 : left.name > right.name ? 1 : 0),
      },
    })),
  };
  return { fingerprintVersion: 2, snapshot };
}
