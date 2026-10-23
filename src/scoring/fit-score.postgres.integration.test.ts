import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { QueryTypes, UniqueConstraintError, type Sequelize } from "sequelize";

vi.mock("server-only", () => ({}));
vi.mock("../auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import {
  ONBOARDING_STATUSES,
  parseUserId,
  type SafeUser,
  type UserType,
} from "../auth/user-types";
import { AIAnalysisResponseInvalidError, type OpportunityAnalysis } from "../ai-analysis/domain";
import { AIAnalysisService, InMemoryOpportunityAnalysisRateLimiter } from "../ai-analysis/service";
import { getSequelize } from "../db/sequelize";
import {
  OpportunityFitInputContextAccessContextError,
  OpportunityFitInputContextService,
} from "../opportunity/fit-input-context-service";
import { OpportunityComparisonService } from "../opportunity/compare-service";
import { SavedOpportunityService } from "../opportunity/saved-service";
import { RoadmapRepository } from "../roadmap/repository";
import { StartupRoadmapService } from "../roadmap/service";
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
  "entrepreneur_profile_customer_segments",
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
  "evidences",
  "saved_opportunities",
  "roadmaps",
  "roadmap_steps",
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
  "016-create-roadmaps.ts",
  "017-create-trend-evidence-provenances.ts",
  "018-create-private-opportunity-hypotheses.ts",
  "019-add-entrepreneur-location-details.ts",
  "020-add-business-location-details.ts",
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
  evidenceA: "40000000-0000-4000-8000-000000000001",
  evidenceB: "40000000-0000-4000-8000-000000000002",
} as const;

let sequelize: Sequelize | undefined;

function requireRow<T>(row: T | undefined): T {
  if (row === undefined) throw new Error("Expected a PostgreSQL query result row.");
  return row;
}

function createFitScoreService(userId: string, userType: UserType): FitScoreService {
  const currentUser = createSafeUser(userId, userType);
  const contextService = new OpportunityFitInputContextService({
    currentUserResolver: async () => currentUser,
  });

  return new FitScoreService({ fitInputContextService: contextService });
}

function createSafeUser(userId: string, userType: UserType): SafeUser {
  return {
    id: parseUserId(userId),
    email: `synthetic-${userId.slice(-2)}@example.test`,
    userType,
    onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
  };
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
    `INSERT INTO entrepreneur_profile_customer_segments (entrepreneur_profile_id, customer_segment_id)
     VALUES ($1, $3), ($2, $3)`,
    { bind: [IDS.entrepreneurProfileA, IDS.entrepreneurProfileB, IDS.segment] },
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
  await connection.query(
    `INSERT INTO evidences
       (id, trend_id, opportunity_id, source_name, source_type, source_mode,
        source_reference, source_url, source_date, retrieved_at, metadata)
     VALUES
       ($1, NULL, $3, 'Synthetic Evidence A', 'SYNTHETIC', 'PREPARED', 'reference-a', 'https://example.test/a', NULL, CURRENT_TIMESTAMP, '{}'::jsonb),
       ($2, NULL, $3, 'Synthetic Evidence B', 'SYNTHETIC', 'PREPARED', 'reference-b', 'https://example.test/b', NULL, CURRENT_TIMESTAMP, '{}'::jsonb)`,
    { bind: [IDS.evidenceA, IDS.evidenceB, IDS.availableOpportunity] },
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

  it("persists six-step Startup and five-step Growth Roadmaps with ordered evidence and owner isolation", async () => {
    const startupOwner = createSafeUser(IDS.entrepreneurA, "ENTREPRENEUR");
    const startupService = new StartupRoadmapService({ currentUserResolver: async () => startupOwner });
    const startup = await startupService.generate({ opportunityId: IDS.availableOpportunity });
    expect(startup.roadmapType).toBe("STARTUP");
    expect(startup.steps.map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(startup.generationContext.evidence.map(({ sourceReference }) => sourceReference))
      .toEqual(["reference-a", "reference-b"]);

    await expect(startupService.getForCurrentUser(startup.id)).resolves.toMatchObject({
      id: startup.id,
      roadmapType: "STARTUP",
      steps: expect.arrayContaining([expect.objectContaining({ sequence: 1 })]),
    });
    await expect(startupService.listForCurrentUser({ page: 1, pageSize: 10 }))
      .resolves.toMatchObject({ totalCount: 1, items: [expect.objectContaining({ id: startup.id })] });

    const otherOwnerService = new StartupRoadmapService({
      currentUserResolver: async () => createSafeUser(IDS.entrepreneurB, "ENTREPRENEUR"),
    });
    await expect(otherOwnerService.getForCurrentUser(startup.id)).resolves.toBeNull();
    await expect(otherOwnerService.listForCurrentUser({ page: 1, pageSize: 10 }))
      .resolves.toMatchObject({ totalCount: 0, items: [] });

    const growthService = new StartupRoadmapService({
      currentUserResolver: async () => createSafeUser(IDS.businessUser, "UMKM_EXISTING"),
    });
    const growth = await growthService.generate({ opportunityId: IDS.availableOpportunity });
    expect(growth.roadmapType).toBe("GROWTH");
    expect(growth.steps.map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4, 5]);
  });

  it("rolls back a Roadmap header when PostgreSQL rejects the step insert", async () => {
    const userId = parseUserId(IDS.entrepreneurA);
    const startupService = new StartupRoadmapService({
      currentUserResolver: async () => createSafeUser(IDS.entrepreneurA, "ENTREPRENEUR"),
    });
    const startup = await startupService.generate({ opportunityId: IDS.availableOpportunity });
    const beforeRows = await sequelize!.query<{ roadmaps: string; steps: string }>(
      `SELECT (SELECT count(*)::text FROM roadmaps) AS roadmaps,
              (SELECT count(*)::text FROM roadmap_steps) AS steps`,
      { type: QueryTypes.SELECT },
    );
    const before = requireRow(beforeRows[0]);
    const invalidSteps = startup.steps.map((step, index) => ({
      sequence: index === startup.steps.length - 1 ? startup.steps[0]!.sequence : step.sequence,
      stage: step.stage,
      action: step.action,
      objective: step.objective,
      timeline: step.timeline,
      expectedOutput: step.expectedOutput,
    }));

    await expect(sequelize!.transaction((transaction) => new RoadmapRepository().createWithSteps({
      userId,
      roadmapType: "STARTUP",
      opportunityId: IDS.availableOpportunity,
      analysisId: null,
      generationContext: startup.generationContext,
      steps: invalidSteps,
    }, transaction))).rejects.toBeInstanceOf(UniqueConstraintError);

    const afterRows = await sequelize!.query<{ roadmaps: string; steps: string }>(
      `SELECT (SELECT count(*)::text FROM roadmaps) AS roadmaps,
              (SELECT count(*)::text FROM roadmap_steps) AS steps`,
      { type: QueryTypes.SELECT },
    );
    expect(requireRow(afterRows[0])).toEqual(before);
  });

  it("persists saved relationships idempotently and removes only the current user's relationship", async () => {
    const ownerA = new SavedOpportunityService({
      currentUserResolver: async () => createSafeUser(IDS.entrepreneurA, "ENTREPRENEUR"),
    });
    const ownerB = new SavedOpportunityService({
      currentUserResolver: async () => createSafeUser(IDS.entrepreneurB, "ENTREPRENEUR"),
    });

    await expect(ownerA.saveForCurrentUser(IDS.availableOpportunity)).resolves.toEqual({ saved: true, created: true });
    await expect(ownerA.saveForCurrentUser(IDS.availableOpportunity)).resolves.toEqual({ saved: true, created: false });
    await expect(ownerB.saveForCurrentUser(IDS.availableOpportunity)).resolves.toEqual({ saved: true, created: true });
    await expect(ownerA.getSaveState(IDS.availableOpportunity)).resolves.toEqual({ status: "AVAILABLE", saved: true });

    await expect(ownerA.setSaved(IDS.availableOpportunity, false)).resolves.toBe(false);
    await expect(ownerA.getSaveState(IDS.availableOpportunity)).resolves.toEqual({ status: "AVAILABLE", saved: false });
    await expect(ownerB.getSaveState(IDS.availableOpportunity)).resolves.toEqual({ status: "AVAILABLE", saved: true });

    const businessOwner = new SavedOpportunityService({
      currentUserResolver: async () => createSafeUser(IDS.businessUser, "UMKM_EXISTING"),
    });
    await expect(businessOwner.saveForCurrentUser(IDS.entrepreneurOnlyOpportunity)).resolves.toBeNull();
  });

  it("compares persisted Opportunities with user-specific Fit Scores and null unavailable metrics", async () => {
    const opportunityIds = [IDS.availableOpportunity, IDS.insufficientOpportunity];
    const compareAs = (userId: string) => new OpportunityComparisonService({
      currentUserResolver: async () => createSafeUser(userId, "ENTREPRENEUR"),
    });
    const ownerA = await compareAs(IDS.entrepreneurA).compare({ opportunityIds });
    const ownerB = await compareAs(IDS.entrepreneurB).compare({ opportunityIds });
    const ownerAFit = ownerA.items.find(({ opportunityId }) => opportunityId === IDS.availableOpportunity)?.fitScore;
    const ownerBFit = ownerB.items.find(({ opportunityId }) => opportunityId === IDS.availableOpportunity)?.fitScore;
    const missingFit = ownerA.items.find(({ opportunityId }) => opportunityId === IDS.insufficientOpportunity)?.fitScore;

    expect(ownerAFit).toMatchObject({ status: "AVAILABLE", value: 100 });
    expect(ownerBFit).toMatchObject({ status: "AVAILABLE", value: 60 });
    expect(missingFit).toMatchObject({ status: "INSUFFICIENT_DATA", value: null });
    for (const item of ownerA.items) {
      expect(item.opportunityScore.value).toBeNull();
      expect(item.risk.value).toBeNull();
    }
  });

  it("stores and retrieves schema-valid synthetic AI analysis by owner and rejects invalid output without persistence", async () => {
    const analysis: OpportunityAnalysis = {
      summary: "Opportunity ini dapat diuji sebagai hipotesis awal untuk usaha F&B.",
      whyRelevant: "Kategori dan kanal yang tercatat pada profil berkaitan dengan Opportunity tersimpan.",
      targetConsumer: "Gunakan segmen pelanggan pada profil sebagai titik awal wawancara.",
      competition: "Katalog belum mencantumkan tingkat kompetisi untuk Opportunity ini.",
      potential: "Trend terpublikasi memberi konteks, tetapi belum membuktikan permintaan lokal.",
      risks: ["Evidence langsung untuk Opportunity ini terbatas; validasi pasar belum dilakukan."],
      nextAction: "Wawancarai calon pelanggan dan catat respons sebelum mengeluarkan biaya besar.",
    };
    const createAnalysisService = (userId: string, output: unknown) => new AIAnalysisService({
      currentUserResolver: async () => createSafeUser(userId, "ENTREPRENEUR"),
      providerFactory: () => ({
        provider: "synthetic-postgres-provider",
        model: "schema-valid-fixture-v1",
        generate: async () => output as OpportunityAnalysis,
      }),
      rateLimiter: new InMemoryOpportunityAnalysisRateLimiter(),
    });
    const ownerA = createAnalysisService(IDS.entrepreneurA, analysis);
    const created = await ownerA.generate(IDS.availableOpportunity, { consentConfirmed: true, forceRefresh: true });
    expect(created).toMatchObject({
      provider: "synthetic-postgres-provider",
      model: "schema-valid-fixture-v1",
      summary: analysis.summary,
    });
    await expect(ownerA.getLatest(IDS.availableOpportunity)).resolves.toMatchObject({
      analysisId: created.analysisId,
      nextAction: analysis.nextAction,
    });

    const otherOwner = createAnalysisService(IDS.entrepreneurB, analysis);
    await expect(otherOwner.getLatest(IDS.availableOpportunity)).resolves.toBeNull();

    const beforeRows = await sequelize!.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM user_opportunity_analyses`,
      { type: QueryTypes.SELECT },
    );
    const invalidOwner = createAnalysisService(IDS.entrepreneurA, { summary: "Incomplete provider output" });
    await expect(invalidOwner.generate(IDS.availableOpportunity, { consentConfirmed: true, forceRefresh: true }))
      .rejects.toBeInstanceOf(AIAnalysisResponseInvalidError);
    const afterRows = await sequelize!.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM user_opportunity_analyses`,
      { type: QueryTypes.SELECT },
    );
    expect(requireRow(afterRows[0]).count).toBe(requireRow(beforeRows[0]).count);
  });
});
