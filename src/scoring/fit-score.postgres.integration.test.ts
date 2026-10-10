import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { QueryTypes, type Sequelize } from "sequelize";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  parseUserId,
  type SafeUser,
  type UserType,
} from "../auth/user-types";
import { getSequelize } from "../db/sequelize";
import {
  OpportunityFitInputContextAccessContextError,
  OpportunityFitInputContextService,
} from "../opportunity/fit-input-context-service";
import { FitScoreService } from "./fit-score-service";

const FIT_TEST_DB_NAME = "venturex_fit_score_test";
const FIT_TEST_DB_USER = "fit_score_test";
const integrationEnabled = process.env.VENTUREX_FIT_SCORE_POSTGRES_INTEGRATION === "1";
const SNAPSHOT_TABLES = [
  "users",
  "fnb_categories",
  "customer_segments",
  "sales_channels",
  "entrepreneur_profiles",
  "entrepreneur_profile_interests",
  "entrepreneur_profile_sales_channels",
  "business_profiles",
  "business_products",
  "business_profile_customer_segments",
  "business_profile_sales_channels",
  "trends",
  "opportunities",
  "opportunity_fit_requirements",
  "opportunity_customer_segments",
  "opportunity_sales_channels",
  "scoring_models",
  "user_opportunity_analyses",
] as const;

const MIGRATION_NAMES = [
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
];

const IDS = {
  entrepreneurA: "10000000-0000-4000-8000-000000000001",
  entrepreneurB: "10000000-0000-4000-8000-000000000002",
  businessUser: "10000000-0000-4000-8000-000000000003",
  entrepreneurMissingProfile: "10000000-0000-4000-8000-000000000004",
  businessMissingProfile: "10000000-0000-4000-8000-000000000005",
  entrepreneurProfileA: "20000000-0000-4000-8000-000000000001",
  entrepreneurProfileB: "20000000-0000-4000-8000-000000000002",
  businessProfile: "20000000-0000-4000-8000-000000000003",
  businessProduct: "30000000-0000-4000-8000-000000000001",
  publishedTrend: "70000000-0000-4000-8000-000000000001",
  entrepreneurOnlyTrend: "70000000-0000-4000-8000-000000000002",
  draftTrend: "70000000-0000-4000-8000-000000000003",
  category: "80000000-0000-4000-8000-000000000001",
  segment: "90000000-0000-4000-8000-000000000001",
  channel: "a0000000-0000-4000-8000-000000000001",
  availableOpportunity: "60000000-0000-4000-8000-000000000001",
  insufficientOpportunity: "60000000-0000-4000-8000-000000000002",
  entrepreneurOnlyOpportunity: "60000000-0000-4000-8000-000000000003",
  draftOpportunity: "60000000-0000-4000-8000-000000000004",
  missingOpportunity: "60000000-0000-4000-8000-000000000099",
} as const;

let sequelize: Sequelize | undefined;

function requireRow<T>(row: T | undefined): T {
  if (row === undefined) throw new Error("Expected a PostgreSQL query result row.");
  return row;
}

function createFitScoreService(userId: string, userType: UserType): FitScoreService {
  const currentUser: SafeUser = {
    id: parseUserId(userId),
    email: `synthetic-${userId.slice(-2)}@example.test`,
    userType,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  };
  const contextService = new OpportunityFitInputContextService({
    currentUserResolver: async () => currentUser,
  });

  return new FitScoreService({ fitInputContextService: contextService });
}

async function seedSyntheticFixtures(connection: Sequelize): Promise<void> {
  await connection.query(
    `INSERT INTO fnb_categories (id, code, name, is_active, created_at, updated_at)
     VALUES ($1, 'SYNTHETIC_FIT_CATEGORY', 'Synthetic Fit Category', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    { bind: [IDS.category] },
  );
  await connection.query(
    `INSERT INTO customer_segments (id, code, name, is_active, created_at, updated_at)
     VALUES ($1, 'SYNTHETIC_FIT_SEGMENT', 'Synthetic Fit Segment', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    { bind: [IDS.segment] },
  );
  await connection.query(
    `INSERT INTO sales_channels (id, code, name, is_active, created_at, updated_at)
     VALUES ($1, 'SYNTHETIC_FIT_CHANNEL', 'Synthetic Fit Channel', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    { bind: [IDS.channel] },
  );

  await connection.query(
    `INSERT INTO users (id, email, password_hash, user_type, onboarding_status, created_at, updated_at)
     VALUES
       ($1, 'synthetic-entrepreneur-a@example.test', 'synthetic-test-hash', 'ENTREPRENEUR', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($2, 'synthetic-entrepreneur-b@example.test', 'synthetic-test-hash', 'ENTREPRENEUR', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($3, 'synthetic-business@example.test', 'synthetic-test-hash', 'UMKM_EXISTING', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($4, 'synthetic-entrepreneur-missing-profile@example.test', 'synthetic-test-hash', 'ENTREPRENEUR', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($5, 'synthetic-business-missing-profile@example.test', 'synthetic-test-hash', 'UMKM_EXISTING', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    {
      bind: [
        IDS.entrepreneurA,
        IDS.entrepreneurB,
        IDS.businessUser,
        IDS.entrepreneurMissingProfile,
        IDS.businessMissingProfile,
      ],
    },
  );

  await connection.query(
    `INSERT INTO entrepreneur_profiles
       (id, user_id, location_text, city, province, country_code, budget_min, budget_max,
        experience_level, time_commitment, profile_version, created_at, updated_at)
     VALUES
       ($1, $2, 'Synthetic City', 'Synthetic City', 'Synthetic Province', 'ID', 10000, 100000, 'BEGINNER', 'PART_TIME', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
       ($3, $4, 'Synthetic City', 'Synthetic City', 'Synthetic Province', 'ID', 10000, 40000, 'BEGINNER', 'PART_TIME', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    { bind: [IDS.entrepreneurProfileA, IDS.entrepreneurA, IDS.entrepreneurProfileB, IDS.entrepreneurB] },
  );
  await connection.query(
    `INSERT INTO entrepreneur_profile_interests (entrepreneur_profile_id, fnb_category_id)
     VALUES ($1, $2), ($3, $2)`,
    { bind: [IDS.entrepreneurProfileA, IDS.category, IDS.entrepreneurProfileB] },
  );
  await connection.query(
    `INSERT INTO entrepreneur_profile_sales_channels (entrepreneur_profile_id, sales_channel_id)
     VALUES ($1, $2), ($3, $2)`,
    { bind: [IDS.entrepreneurProfileA, IDS.channel, IDS.entrepreneurProfileB] },
  );

  await connection.query(
    `INSERT INTO business_profiles
       (id, user_id, business_name, business_category_id, location_text, country_code,
        average_price_min, average_price_max, profile_version, created_at, updated_at)
     VALUES ($1, $2, 'Synthetic Business', $3, 'Synthetic City', 'ID', 10000, 20000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    { bind: [IDS.businessProfile, IDS.businessUser, IDS.category] },
  );
  await connection.query(
    `INSERT INTO business_products (id, business_profile_id, name, fnb_category_id, price, is_active, created_at, updated_at)
     VALUES ($1, $2, 'Synthetic Product', $3, 15000, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    { bind: [IDS.businessProduct, IDS.businessProfile, IDS.category] },
  );
  await connection.query(
    `INSERT INTO business_profile_customer_segments (business_profile_id, customer_segment_id)
     VALUES ($1, $2)`,
    { bind: [IDS.businessProfile, IDS.segment] },
  );
  await connection.query(
    `INSERT INTO business_profile_sales_channels (business_profile_id, sales_channel_id)
     VALUES ($1, $2)`,
    { bind: [IDS.businessProfile, IDS.channel] },
  );

  await connection.query(
    `INSERT INTO trends
       (id, title, category_code, fnb_category_id, signal_summary, signal_description,
        direction, affected_user_types, lifecycle_state)
     VALUES
       ($1, 'Synthetic Published Trend', 'PRODUCT_MENU', $4, 'Synthetic signal', 'Synthetic test fixture', 'STABLE', ARRAY['ENTREPRENEUR', 'UMKM_EXISTING']::varchar(32)[], 'PUBLISHED'),
       ($2, 'Synthetic Entrepreneur Trend', 'PRODUCT_MENU', $4, 'Synthetic signal', 'Synthetic test fixture', 'STABLE', ARRAY['ENTREPRENEUR']::varchar(32)[], 'PUBLISHED'),
       ($3, 'Synthetic Draft Trend', 'PRODUCT_MENU', $4, 'Synthetic signal', 'Synthetic test fixture', 'STABLE', ARRAY['ENTREPRENEUR', 'UMKM_EXISTING']::varchar(32)[], 'DRAFT')`,
    { bind: [IDS.publishedTrend, IDS.entrepreneurOnlyTrend, IDS.draftTrend, IDS.category] },
  );
  await connection.query(
    `INSERT INTO opportunities
       (id, related_trend_id, fnb_category_id, name, description, opportunity_type)
     VALUES
       ($1, $2, $5, 'Synthetic Eligible Opportunity', 'Synthetic database test fixture', 'NEW_BUSINESS'),
       ($3, $2, $5, 'Synthetic Incomplete Opportunity', 'Synthetic database test fixture', 'NEW_BUSINESS'),
       ($4, $6, $5, 'Synthetic Wrong Audience Opportunity', 'Synthetic database test fixture', 'NEW_BUSINESS'),
       ($7, $8, $5, 'Synthetic Unpublished Trend Opportunity', 'Synthetic database test fixture', 'NEW_BUSINESS')`,
    {
      bind: [
        IDS.availableOpportunity,
        IDS.publishedTrend,
        IDS.insufficientOpportunity,
        IDS.entrepreneurOnlyOpportunity,
        IDS.category,
        IDS.entrepreneurOnlyTrend,
        IDS.draftOpportunity,
        IDS.draftTrend,
      ],
    },
  );
  await connection.query(
    `INSERT INTO opportunity_fit_requirements
       (opportunity_id, capital_min, expected_price_min, expected_price_max, metadata, updated_at)
     VALUES
       ($1, 50000, 20000, 25000, '{}'::jsonb, CURRENT_TIMESTAMP),
       ($2, NULL, NULL, NULL, '{}'::jsonb, CURRENT_TIMESTAMP)`,
    { bind: [IDS.availableOpportunity, IDS.insufficientOpportunity] },
  );
  await connection.query(
    `INSERT INTO opportunity_customer_segments (opportunity_id, customer_segment_id)
     VALUES ($1, $3), ($2, $3)`,
    { bind: [IDS.availableOpportunity, IDS.insufficientOpportunity, IDS.segment] },
  );
  await connection.query(
    `INSERT INTO opportunity_sales_channels (opportunity_id, sales_channel_id)
     VALUES ($1, $3), ($2, $3)`,
    { bind: [IDS.availableOpportunity, IDS.insufficientOpportunity, IDS.channel] },
  );
}

async function databaseSnapshot(connection: Sequelize) {
  const snapshot: Record<string, { count: string; fingerprint: string }> = {};
  for (const table of SNAPSHOT_TABLES) {
    const rows = await connection.query<{ count: string; fingerprint: string }>(
      `SELECT
         count(*)::text AS count,
         COALESCE(
           md5(string_agg(
             (to_jsonb(t) || jsonb_build_object('_xmin', t.xmin::text))::text,
             E'\\n' ORDER BY (to_jsonb(t) || jsonb_build_object('_xmin', t.xmin::text))::text
           )),
           md5('')
         ) AS fingerprint
       FROM "${table}" t`,
      { type: QueryTypes.SELECT },
    );
    snapshot[table] = requireRow(rows[0]);
  }
  return snapshot;
}

describe.skipIf(!integrationEnabled)("Fit Score PostgreSQL integration (disposable test DB only)", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "");
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.username).toBe(FIT_TEST_DB_USER);
    expect(decodeURIComponent(url.pathname.slice(1))).toBe(FIT_TEST_DB_NAME);

    sequelize = getSequelize();
    const identityRows = await sequelize.query<{
      database_name: string;
      database_user: string;
      version_number: string;
    }>(
      `SELECT current_database() AS database_name,
              current_user AS database_user,
              current_setting('server_version_num') AS version_number`,
      { type: QueryTypes.SELECT },
    );
    const identity = requireRow(identityRows[0]);
    expect(identity.database_name).toBe(FIT_TEST_DB_NAME);
    expect(identity.database_user).toBe(FIT_TEST_DB_USER);
    expect(identity.version_number).toMatch(/^18/);

    const migrations = await sequelize.query<{ name: string }>(
      `SELECT name FROM "SequelizeMeta" ORDER BY name`,
      { type: QueryTypes.SELECT },
    );
    expect(migrations.map(({ name }) => name)).toEqual(MIGRATION_NAMES);

    for (const table of SNAPSHOT_TABLES) {
      const rows = await sequelize.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${table}"`,
        { type: QueryTypes.SELECT },
      );
      const row = requireRow(rows[0]);
      expect(row.count, `Disposable table ${table} must be empty before synthetic fixtures`).toBe("0");
    }

    await seedSyntheticFixtures(sequelize);
  }, 30_000);

  afterAll(async () => {
    await sequelize?.close();
  });

  it("has migrated score, ownership, eligibility, and Fit Input constraints on PostgreSQL", async () => {
    const constraints = await sequelize!.query<{
      table_name: string;
      constraint_name: string;
      constraint_type: string;
      delete_action: string;
      definition: string;
    }>(
      `SELECT table_row.relname AS table_name,
              constraint_row.conname AS constraint_name,
              constraint_row.contype AS constraint_type,
              constraint_row.confdeltype AS delete_action,
              pg_get_constraintdef(constraint_row.oid) AS definition
       FROM pg_constraint AS constraint_row
       JOIN pg_class AS table_row ON table_row.oid = constraint_row.conrelid
       WHERE table_row.relname IN (
         'opportunity_fit_requirements', 'opportunity_customer_segments',
         'opportunity_sales_channels', 'scoring_models', 'user_opportunity_analyses'
       )
       ORDER BY table_row.relname, constraint_row.conname`,
      { type: QueryTypes.SELECT },
    );
    const names = constraints.map(({ constraint_name }) => constraint_name);
    expect(names).toEqual(expect.arrayContaining([
      "opportunity_fit_requirements_capital_range_check",
      "opportunity_fit_requirements_expected_price_range_check",
      "opportunity_fit_requirements_operational_complexity_check",
      "scoring_models_model_type_check",
      "uq_scoring_models_type_version",
      "user_opportunity_analyses_fit_score_check",
      "user_opportunity_analyses_score_status_check",
      "user_opportunity_analyses_profile_version_check",
    ]));
    expect(constraints.some(({ table_name, constraint_type, delete_action, definition }) =>
      table_name === "user_opportunity_analyses"
      && constraint_type === "f"
      && delete_action === "c"
      && definition.includes("FOREIGN KEY (user_id) REFERENCES users(id)"),
    )).toBe(true);
    expect(constraints.some(({ table_name, constraint_type, delete_action, definition }) =>
      table_name === "user_opportunity_analyses"
      && constraint_type === "f"
      && delete_action === "r"
      && definition.includes("FOREIGN KEY (opportunity_id) REFERENCES opportunities(id)"),
    )).toBe(true);
    expect(constraints.some(({ table_name, constraint_type, delete_action, definition }) =>
      table_name === "user_opportunity_analyses"
      && constraint_type === "f"
      && delete_action === "n"
      && definition.includes("FOREIGN KEY (dataset_version_id) REFERENCES dataset_versions(id)"),
    )).toBe(true);

    const trendDatasetLinkRows = await sequelize!.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM pg_constraint
       WHERE conrelid = 'trends'::regclass
         AND confrelid = 'dataset_versions'::regclass`,
      { type: QueryTypes.SELECT },
    );
    const trendDatasetLinks = requireRow(trendDatasetLinkRows[0]);
    expect(trendDatasetLinks.count).toBe("0");
  });

  it("calculates AVAILABLE results from persisted Entrepreneur and UMKM profiles", async () => {
    const entrepreneur = await createFitScoreService(IDS.entrepreneurA, "ENTREPRENEUR")
      .calculateForOpportunity(IDS.availableOpportunity);
    expect(entrepreneur).toMatchObject({
      status: "AVAILABLE",
      score: 100,
      modelType: "ENTREPRENEUR_FIT",
      policyVersion: "FIT_MVP_HEURISTIC_V1",
      confidence: null,
    });
    if (!entrepreneur || entrepreneur.status !== "AVAILABLE") throw new Error("Expected Entrepreneur score.");
    expect(entrepreneur.activeComponents.map(({ component, normalizedValue }) => [component, normalizedValue]))
      .toEqual([["budgetFit", 100], ["interestFit", 100], ["channelFit", 100]]);

    const business = await createFitScoreService(IDS.businessUser, "UMKM_EXISTING")
      .calculateForOpportunity(IDS.availableOpportunity);
    expect(business).toMatchObject({
      status: "AVAILABLE",
      score: 100,
      modelType: "BUSINESS_FIT",
      policyVersion: "FIT_MVP_HEURISTIC_V1",
      confidence: null,
    });
    if (!business || business.status !== "AVAILABLE") throw new Error("Expected Business score.");
    expect(Object.fromEntries(business.activeComponents.map(({ component, normalizedValue }) => [component, normalizedValue])))
      .toEqual({ priceFit: 100, productFit: 100, customerFit: 100, channelFit: 100 });
  });

  it("returns INSUFFICIENT_DATA without a numeric score when required persisted boundaries are absent", async () => {
    const entrepreneur = await createFitScoreService(IDS.entrepreneurA, "ENTREPRENEUR")
      .calculateForOpportunity(IDS.insufficientOpportunity);
    expect(entrepreneur).toMatchObject({ status: "INSUFFICIENT_DATA", score: null, modelType: "ENTREPRENEUR_FIT" });
    if (!entrepreneur || entrepreneur.status !== "INSUFFICIENT_DATA") throw new Error("Expected insufficient Entrepreneur result.");
    expect(entrepreneur.missingComponents).toContain("budgetFit");

    const business = await createFitScoreService(IDS.businessUser, "UMKM_EXISTING")
      .calculateForOpportunity(IDS.insufficientOpportunity);
    expect(business).toMatchObject({ status: "INSUFFICIENT_DATA", score: null, modelType: "BUSINESS_FIT" });
    if (!business || business.status !== "INSUFFICIENT_DATA") throw new Error("Expected insufficient Business result.");
    expect(business.missingComponents).toContain("priceFit");
  });

  it("rejects completed users when their role-specific persisted profile row is missing", async () => {
    await expect(
      createFitScoreService(IDS.entrepreneurMissingProfile, "ENTREPRENEUR")
        .calculateForOpportunity(IDS.availableOpportunity),
    ).rejects.toBeInstanceOf(OpportunityFitInputContextAccessContextError);
    await expect(
      createFitScoreService(IDS.businessMissingProfile, "UMKM_EXISTING")
        .calculateForOpportunity(IDS.availableOpportunity),
    ).rejects.toBeInstanceOf(OpportunityFitInputContextAccessContextError);
  });

  it("isolates persisted profile ownership and rejects missing, unpublished, or wrong-audience Opportunities", async () => {
    const ownerAResult = await createFitScoreService(IDS.entrepreneurA, "ENTREPRENEUR")
      .calculateForOpportunity(IDS.availableOpportunity);
    const ownerBResult = await createFitScoreService(IDS.entrepreneurB, "ENTREPRENEUR")
      .calculateForOpportunity(IDS.availableOpportunity);
    expect(ownerAResult).toMatchObject({ status: "AVAILABLE", score: 100 });
    expect(ownerBResult).toMatchObject({ status: "AVAILABLE", score: 60 });

    const businessService = createFitScoreService(IDS.businessUser, "UMKM_EXISTING");
    await expect(businessService.calculateForOpportunity(IDS.entrepreneurOnlyOpportunity)).resolves.toBeNull();
    await expect(businessService.calculateForOpportunity(IDS.draftOpportunity)).resolves.toBeNull();
    await expect(businessService.calculateForOpportunity(IDS.missingOpportunity)).resolves.toBeNull();
  });

  it("does not modify persisted profiles, catalogue rows, scoring models, or analysis snapshots", async () => {
    const before = await databaseSnapshot(sequelize!);
    await createFitScoreService(IDS.entrepreneurA, "ENTREPRENEUR")
      .calculateForOpportunity(IDS.availableOpportunity);
    await createFitScoreService(IDS.businessUser, "UMKM_EXISTING")
      .calculateForOpportunity(IDS.availableOpportunity);
    await createFitScoreService(IDS.entrepreneurA, "ENTREPRENEUR")
      .calculateForOpportunity(IDS.insufficientOpportunity);
    const after = await databaseSnapshot(sequelize!);

    expect(after).toEqual(before);
    expect(after).toMatchObject({
      scoring_models: { count: "0" },
      user_opportunity_analyses: { count: "0" },
    });
  });
});
