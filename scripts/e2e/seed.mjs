import { Sequelize } from "sequelize";

const expectedDatabase = "venturex_batch10_e2e_test";
const expectedUser = "fit_score_test";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("E2E fixture seed requires the orchestrator's disposable DATABASE_URL.");

const parsedUrl = new URL(databaseUrl);
if (parsedUrl.hostname !== "127.0.0.1"
  || parsedUrl.port === "5432"
  || decodeURIComponent(parsedUrl.username) !== expectedUser
  || decodeURIComponent(parsedUrl.pathname.slice(1)) !== expectedDatabase) {
  throw new Error("E2E fixture seed refused a database URL outside its disposable localhost target.");
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  pool: { max: 1, min: 0, idle: 1_000, acquire: 5_000 },
});

const ids = {
  category: "10000000-0000-4000-8000-000000000001",
  segment: "20000000-0000-4000-8000-000000000001",
  channel: "30000000-0000-4000-8000-000000000001",
  startupTrend: "71000000-0000-4000-8000-000000000001",
  growthTrend: "71000000-0000-4000-8000-000000000002",
  startupOpportunity: "72000000-0000-4000-8000-000000000001",
  growthOpportunity: "72000000-0000-4000-8000-000000000002",
  comparisonOpportunity: "72000000-0000-4000-8000-000000000003",
  startupTrendEvidence: "73000000-0000-4000-8000-000000000001",
  growthTrendEvidence: "73000000-0000-4000-8000-000000000002",
  startupEvidence: "74000000-0000-4000-8000-000000000001",
  growthEvidence: "74000000-0000-4000-8000-000000000002",
  comparisonEvidence: "74000000-0000-4000-8000-000000000003",
};

async function assertIdentity() {
  const [rows] = await sequelize.query(
    `SELECT current_database() AS database_name,
            current_user AS database_user,
            current_setting('server_version_num') AS version_number`,
  );
  const identity = rows[0];
  if (identity?.database_name !== expectedDatabase
    || identity?.database_user !== expectedUser
    || typeof identity?.version_number !== "string"
    || !identity.version_number.startsWith("18")) {
    throw new Error("E2E fixture seed refused because the connected database identity/version did not match.");
  }
}

async function seed() {
  await sequelize.authenticate();
  await assertIdentity();
  await sequelize.transaction(async (transaction) => {
    const trends = [
      [ids.startupTrend, "E2E synthetic fixture Trend A (not market evidence)"],
      [ids.growthTrend, "E2E synthetic fixture Trend B (not market evidence)"],
    ];
    for (const [trendId, title] of trends) {
      await sequelize.query(
        `INSERT INTO trends
           (id, title, category_code, fnb_category_id, signal_summary, signal_description,
            direction, period_start, period_end, business_relevance_explanation,
            affected_user_types, lifecycle_state, created_at, updated_at)
         VALUES
           ($1, $2, 'PRODUCT_MENU', $3,
            'Synthetic E2E test data only; no actual market signal is represented.',
            'This record exists only to exercise local browser flows. It is not a factual market observation.',
            'STABLE', NULL, NULL,
            'Test fixture only. This record is not reviewed or validated market evidence.',
            ARRAY['ENTREPRENEUR', 'UMKM_EXISTING']::varchar(32)[], 'PUBLISHED', NOW(), NOW())`,
        { bind: [trendId, title, ids.category], transaction },
      );
    }

    const trendEvidence = [
      [ids.startupTrendEvidence, ids.startupTrend],
      [ids.growthTrendEvidence, ids.growthTrend],
    ];
    for (const [evidenceId, trendId] of trendEvidence) {
      await sequelize.query(
        `INSERT INTO trend_evidences
           (id, trend_id, source_name, source_reference, supporting_detail,
            source_date, limitations, created_at, updated_at)
         VALUES
           ($1, $2, 'Synthetic E2E fixture (not market evidence)',
            'synthetic://venturex/batch-10',
            'Local test marker only. No consumer, market, or performance claim is asserted.',
            NULL, 'Synthetic test data; not a real source and not validated evidence.', NOW(), NOW())`,
        { bind: [evidenceId, trendId], transaction },
      );
    }

    const opportunities = [
      {
        id: ids.startupOpportunity,
        trend: ids.startupTrend,
        name: "E2E synthetic opportunity - Startup path",
      },
      {
        id: ids.growthOpportunity,
        trend: ids.growthTrend,
        name: "E2E synthetic opportunity - Growth path",
      },
      {
        id: ids.comparisonOpportunity,
        trend: ids.startupTrend,
        name: "E2E synthetic opportunity - Compare path",
      },
    ];
    for (const opportunity of opportunities) {
      await sequelize.query(
        `INSERT INTO opportunities
           (id, related_trend_id, fnb_category_id, name, description, opportunity_type,
            target_consumer_summary, competition_level, competition_summary,
            execution_feasibility, market_sustainability, additional_attributes,
            created_at, updated_at)
         VALUES
           ($1, $2, $3, $4,
            'Synthetic local fixture used only to verify application navigation and persistence. Not a real business opportunity.',
            'NEW_BUSINESS',
            'Synthetic test marker only; no actual consumer segment claim.',
            NULL, NULL, NULL, NULL,
            '{"fixture":"batch-10","synthetic":true,"notMarketEvidence":true}'::jsonb,
            NOW(), NOW())`,
        { bind: [opportunity.id, opportunity.trend, ids.category, opportunity.name], transaction },
      );

      await sequelize.query(
        `INSERT INTO opportunity_fit_requirements
           (opportunity_id, capital_min, capital_max, expected_price_min, expected_price_max,
            required_experience_level, required_time_commitment, operational_complexity,
            location_scope, metadata, updated_at)
         VALUES
           ($1, 4000000, 8000000, 15000, 30000,
            'BEGINNER', 'PART_TIME', NULL, NULL,
            '{"fixture":"batch-10","synthetic":true}'::jsonb, NOW())`,
        { bind: [opportunity.id], transaction },
      );

      await sequelize.query(
        `INSERT INTO opportunity_customer_segments (opportunity_id, customer_segment_id)
         VALUES ($1, $2)`,
        { bind: [opportunity.id, ids.segment], transaction },
      );
      await sequelize.query(
        `INSERT INTO opportunity_sales_channels (opportunity_id, sales_channel_id)
         VALUES ($1, $2)`,
        { bind: [opportunity.id, ids.channel], transaction },
      );
    }

    const opportunitiesWithEvidence = [
      [ids.startupEvidence, ids.startupOpportunity],
      [ids.growthEvidence, ids.growthOpportunity],
      [ids.comparisonEvidence, ids.comparisonOpportunity],
    ];
    for (const [evidenceId, opportunityId] of opportunitiesWithEvidence) {
      await sequelize.query(
        `INSERT INTO evidences
           (id, trend_id, opportunity_id, source_name, source_type, source_mode,
            source_reference, source_url, source_date, retrieved_at, metadata, created_at)
         VALUES
           ($1, NULL, $2, 'Synthetic E2E fixture (not market evidence)',
            'TEST_FIXTURE', 'SYNTHETIC', 'synthetic://venturex/batch-10', NULL, NULL,
            NOW(), '{"limitations":"Synthetic local test data only; no real source or market claim."}'::jsonb,
            NOW())`,
        { bind: [evidenceId, opportunityId], transaction },
      );
    }
  });

  const [counts] = await sequelize.query(
    `SELECT
       (SELECT count(*)::int FROM trends) AS trends,
       (SELECT count(*)::int FROM opportunities) AS opportunities,
       (SELECT count(*)::int FROM evidences) AS evidences,
       (SELECT count(*)::int FROM scoring_models) AS scoring_models`,
  );
  if (counts[0]?.trends !== 2
    || counts[0]?.opportunities !== 3
    || counts[0]?.evidences !== 3
    || counts[0]?.scoring_models !== 0) {
    throw new Error("E2E fixture verification failed; expected 2 synthetic Trends, 3 synthetic Opportunities, 3 evidence records, and no scoring policies.");
  }
  console.log("E2E-only fixture verified: 2 synthetic Trends, 3 synthetic Opportunities, 3 synthetic Evidence records, and 0 scoring policies.");
}

try {
  await seed();
} finally {
  await sequelize.close();
}
