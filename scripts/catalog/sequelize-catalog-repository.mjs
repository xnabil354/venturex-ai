import { QueryTypes, Transaction } from "sequelize";

import { planCatalogImport } from "../../src/catalog/catalog-import.ts";

const tableNames = Object.freeze({
  categories: '"fnb_categories"',
  trends: '"trends"',
  evidences: '"trend_evidences"',
  opportunities: '"opportunities"',
});

export class SequelizeCatalogImportRepository {
  constructor(sequelize) {
    this.sequelize = sequelize;
  }

  async readDatabaseIdentity() {
    const rows = await this.sequelize.query(
      "SELECT current_database() AS database_name, current_user AS database_user",
      { type: QueryTypes.SELECT },
    );
    const identity = rows[0];
    if (!identity) throw new Error("Could not verify PostgreSQL identity.");
    return { database: identity.database_name, user: identity.database_user };
  }

  async preview(manifest) {
    return planCatalogImport(manifest, await this.#readSnapshot(manifest));
  }

  async apply(manifest) {
    return this.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
    }, async (transaction) => {
      const snapshot = await this.#readSnapshot(manifest, transaction);
      const plan = planCatalogImport(manifest, snapshot);
      if (plan.action === "NO_OP") return plan;

      const categoryByCode = new Map(snapshot.categories.map((category) => [category.code, category]));
      for (const trend of manifest.trends) {
        const category = categoryByCode.get(trend.subjectAreaCode);
        if (!category?.isActive) throw new Error("Required active F&B category is unavailable.");
        const userTypeReplacements = Object.fromEntries(
          trend.affectedUserTypes.map((userType, index) => [`userType${index}`, userType]),
        );
        const userTypeValues = trend.affectedUserTypes.map((_, index) => `:userType${index}`).join(", ");
        await this.sequelize.query(`
          INSERT INTO ${tableNames.trends} (
            "id", "title", "category_code", "fnb_category_id", "signal_summary",
            "signal_description", "direction", "period_start", "period_end",
            "business_relevance_explanation", "affected_user_types", "lifecycle_state",
            "archived_reason", "created_at", "updated_at"
          ) VALUES (
            :id, :title, :categoryCode, :subjectAreaId, :signalSummary,
            :signalDescription, :direction, :periodStart, :periodEnd,
            :businessRelevanceExplanation, ARRAY[${userTypeValues}]::VARCHAR(32)[],
            'DRAFT', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`, {
          replacements: {
            id: trend.id,
            title: trend.title,
            categoryCode: trend.categoryCode,
            subjectAreaId: category.id,
            signalSummary: trend.signal.summary,
            signalDescription: trend.signal.description,
            direction: trend.signal.direction,
            periodStart: trend.signal.periodStart,
            periodEnd: trend.signal.periodEnd,
            businessRelevanceExplanation: trend.businessRelevanceExplanation,
            ...userTypeReplacements,
          },
          transaction,
        });

        for (const evidence of trend.evidence) {
          await this.sequelize.query(`
            INSERT INTO ${tableNames.evidences} (
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
        }
      }

      for (const opportunity of manifest.opportunities) {
        const category = categoryByCode.get(opportunity.fnbCategoryCode);
        if (!category?.isActive) throw new Error("Required active F&B category is unavailable.");
        await this.sequelize.query(`
          INSERT INTO ${tableNames.opportunities} (
            "id", "related_trend_id", "fnb_category_id", "name", "description",
            "opportunity_type", "target_consumer_summary", "competition_level",
            "competition_summary", "execution_feasibility", "market_sustainability",
            "additional_attributes", "created_at", "updated_at"
          ) VALUES (
            :id, :relatedTrendId, :fnbCategoryId, :name, :description,
            :opportunityType, NULL, NULL, NULL, NULL, NULL, '{}'::jsonb,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`, {
          replacements: {
            id: opportunity.id,
            relatedTrendId: opportunity.relatedTrendId,
            fnbCategoryId: category.id,
            name: opportunity.name,
            description: opportunity.description,
            opportunityType: opportunity.opportunityType,
          },
          transaction,
        });
      }

      return plan;
    });
  }

  async close() {
    await this.sequelize.close();
  }

  async #readSnapshot(manifest, transaction) {
    const trendIds = manifest.trends.map(({ id }) => id);
    const trendTitles = manifest.trends.map(({ title }) => title);
    const evidenceIds = manifest.trends.flatMap(({ evidence }) => evidence.map(({ id }) => id));
    const evidenceReferences = [...new Set(
      manifest.trends.flatMap(({ evidence }) => evidence.map(({ sourceReference }) => sourceReference)),
    )];
    const opportunityIds = manifest.opportunities.map(({ id }) => id);
    const opportunityNames = manifest.opportunities.map(({ name }) => name);
    const categoryCodes = [...new Set([
      ...manifest.trends.map(({ subjectAreaCode }) => subjectAreaCode),
      ...manifest.opportunities.map(({ fnbCategoryCode }) => fnbCategoryCode),
    ])];
    const transactionOptions = transaction ? { transaction } : {};

    const [categories, trends, evidences, opportunities] = await Promise.all([
      this.sequelize.query(`
        SELECT "id", "code", "is_active" AS "isActive"
        FROM ${tableNames.categories}
        WHERE "code" IN (:categoryCodes)`, {
        replacements: { categoryCodes },
        type: QueryTypes.SELECT,
        ...transactionOptions,
      }),
      this.sequelize.query(`
        SELECT "id", "title", "category_code" AS "categoryCode", "fnb_category_id" AS "subjectAreaId",
          "signal_summary" AS "signalSummary", "signal_description" AS "signalDescription",
          "direction", "period_start" AS "periodStart", "period_end" AS "periodEnd",
          "business_relevance_explanation" AS "businessRelevanceExplanation",
          "affected_user_types" AS "affectedUserTypes", "lifecycle_state" AS "lifecycleState",
          "archived_reason" AS "archivedReason"
        FROM ${tableNames.trends}
        WHERE "id" IN (:trendIds) OR "title" IN (:trendTitles)`, {
        replacements: { trendIds, trendTitles },
        type: QueryTypes.SELECT,
        ...transactionOptions,
      }),
      this.sequelize.query(`
        SELECT "id", "trend_id" AS "trendId", "source_name" AS "sourceName",
          "source_reference" AS "sourceReference", "supporting_detail" AS "supportingDetail",
          "source_date" AS "sourceDate", "limitations"
        FROM ${tableNames.evidences}
        WHERE "id" IN (:evidenceIds) OR "source_reference" IN (:evidenceReferences)`, {
        replacements: { evidenceIds, evidenceReferences },
        type: QueryTypes.SELECT,
        ...transactionOptions,
      }),
      this.sequelize.query(`
        SELECT "id", "related_trend_id" AS "relatedTrendId", "fnb_category_id" AS "fnbCategoryId",
          "name", "description", "opportunity_type" AS "opportunityType",
          "target_consumer_summary" AS "targetConsumerSummary", "competition_level" AS "competitionLevel",
          "competition_summary" AS "competitionSummary", "execution_feasibility" AS "executionFeasibility",
          "market_sustainability" AS "marketSustainability", "additional_attributes" AS "additionalAttributes"
        FROM ${tableNames.opportunities}
        WHERE "id" IN (:opportunityIds)
          OR ("related_trend_id" IN (:trendIds) AND "name" IN (:opportunityNames))`, {
        replacements: { opportunityIds, trendIds, opportunityNames },
        type: QueryTypes.SELECT,
        ...transactionOptions,
      }),
    ]);

    return { categories, trends, evidences, opportunities };
  }
}
