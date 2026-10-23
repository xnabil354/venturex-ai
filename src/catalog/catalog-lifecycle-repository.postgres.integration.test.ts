import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { QueryTypes, Sequelize } from "sequelize";

import {
  fingerprintCatalogContentVersioned,
} from "./catalog-fingerprint";
import {
  hashVersionedCatalogAuditEventPayload,
  verifyVersionedCatalogAuditLedger,
  type VersionedCatalogAuditEvent,
} from "./catalog-audit-contract";
import type { CatalogLifecycleAuditEvent } from "./catalog-lifecycle";
import {
  loadCatalogLifecycleSnapshot,
  loadVersionedCatalogLifecycleSnapshot,
} from "./catalog-lifecycle-repository";
import {
  assertCatalogV2LedgerReconciled,
  CatalogLifecycleV2Harness,
  type CatalogV2DecisionInput,
} from "./test-support/catalog-lifecycle-v2-harness";

const enabled = process.env.VENTUREX_CATALOG_LIFECYCLE_V2_POSTGRES_INTEGRATION === "1";
const databaseUrl = process.env.VENTUREX_CATALOG_LIFECYCLE_V2_TEST_DATABASE_URL;
const expectedMigrations = [
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
];

let sequelize: Sequelize | undefined;
let fixture: {
  readonly categoryId: string;
  readonly trendId: string;
  readonly evidenceIds: readonly [string, string];
  readonly opportunityId: string;
} | undefined;
const sqlLog: string[] = [];
const auditDirectories: string[] = [];

function v2DecisionInput(trendId: string, overrides: Partial<CatalogV2DecisionInput> = {}): CatalogV2DecisionInput {
  return {
    manifestId: "synthetic-lifecycle-v2-manifest",
    manifestSha256: "A".repeat(64),
    trendId,
    actorOsAccount: "synthetic-reviewer",
    decision: "APPROVED",
    rationale: "Synthetic v2 review decision for disposable integration testing.",
    evidenceLimitations: ["Synthetic fixtures only; no factual or market review occurred."],
    ...overrides,
  };
}

async function createV2Harness() {
  if (!sequelize) throw new Error("Disposable PostgreSQL is not initialized.");
  const directory = await mkdtemp(path.join(os.tmpdir(), "venturex-catalog-v2-harness-"));
  auditDirectories.push(directory);
  return {
    directory,
    ledgerPath: path.join(directory, "synthetic-catalog-lifecycle-v2.jsonl"),
    harness: new CatalogLifecycleV2Harness({
      sequelize,
      ledgerPath: path.join(directory, "synthetic-catalog-lifecycle-v2.jsonl"),
      clock: () => new Date("2026-10-13T10:00:00.000Z"),
    }),
  };
}

function createSyntheticV1Review(
  prior: readonly VersionedCatalogAuditEvent[],
  trendId: string,
  contentSha256: string,
): CatalogLifecycleAuditEvent {
  const payload = {
    schemaVersion: 1 as const,
    sequence: prior.length + 1,
    id: randomUUID(),
    recordedAt: "2026-10-13T09:59:00.000Z",
    action: "FACTUAL_REVIEW" as const,
    manifestId: "synthetic-lifecycle-v2-manifest",
    manifestSha256: "A".repeat(64),
    trendId,
    contentSha256,
    actor: {
      osAccount: "synthetic-legacy-reviewer",
      role: "FACTUAL_REVIEWER" as const,
      identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE" as const,
    },
    decision: "APPROVED" as const,
    rationale: "Synthetic legacy review event for mixed-ledger verification.",
    evidenceLimitations: ["Synthetic fixture only; no factual review occurred."],
    transition: null,
    previousHash: prior.at(-1)?.hash ?? null,
  };
  return { ...payload, hash: hashVersionedCatalogAuditEventPayload(payload) };
}

function createSyntheticV2TransitionStart(
  prior: readonly VersionedCatalogAuditEvent[],
  input: CatalogV2DecisionInput,
  contentSha256: string,
): Extract<VersionedCatalogAuditEvent, { schemaVersion: 2 }> {
  const payload = {
    schemaVersion: 2 as const,
    sequence: prior.length + 1,
    id: randomUUID(),
    recordedAt: "2026-10-13T10:01:00.000Z",
    action: "TRANSITION_STARTED" as const,
    manifestId: input.manifestId,
    manifestSha256: input.manifestSha256,
    trendId: input.trendId,
    fingerprintVersion: 2 as const,
    contentSha256,
    actor: {
      osAccount: "synthetic-operator",
      role: "OPERATOR" as const,
      identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE" as const,
    },
    decision: "NOT_APPLICABLE" as const,
    rationale: "Synthetic interrupted transition marker; no database transition was attempted.",
    evidenceLimitations: ["Synthetic fixture only; no lifecycle transition occurred."],
    transition: { id: randomUUID(), from: "DRAFT" as const, to: "VALIDATED" as const },
    factualReviewReference: null,
    previousHash: prior.at(-1)?.hash ?? null,
  };
  return { ...payload, hash: hashVersionedCatalogAuditEventPayload(payload) };
}

function assertDisposableDatabaseUrl(value: string | undefined): asserts value is string {
  if (!value) throw new Error("Disposable v2 integration URL is required when the suite is enabled.");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (
    url.protocol !== "postgres:" && url.protocol !== "postgresql:"
  ) throw new Error("V2 integration tests require PostgreSQL.");
  if (database.toLowerCase() === "venturex_dev") {
    throw new Error("V2 integration tests refuse venturex_dev.");
  }
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "55433" ||
    database !== "venturex_trend_evidence_provenance_test" ||
    decodeURIComponent(url.username) !== "venturex" ||
    url.password !== ""
  ) {
    throw new Error("V2 integration tests refuse any target except the passwordless loopback disposable PostgreSQL target on port 55433.");
  }
}

async function seedSyntheticFixture() {
  if (!sequelize) throw new Error("Disposable PostgreSQL is not initialized.");

  const { randomUUID } = await import("node:crypto");
  const evidenceIds = [randomUUID(), randomUUID()].sort() as [string, string];
  const ids = {
    categoryId: randomUUID(),
    trendId: randomUUID(),
    evidenceIds,
    opportunityId: randomUUID(),
  };
  fixture = ids;

  await sequelize.transaction(async (transaction) => {
    await sequelize!.query(
      `INSERT INTO fnb_categories (id, code, name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
      { bind: [ids.categoryId, `SYNTHETIC_${ids.categoryId.slice(0, 8)}`, `Synthetic ${ids.categoryId.slice(0, 8)}`], transaction },
    );
    await sequelize!.query(
      `INSERT INTO trends
        (id, title, category_code, fnb_category_id, signal_summary, signal_description,
         direction, period_start, period_end, business_relevance_explanation,
         affected_user_types, lifecycle_state, archived_reason, created_at, updated_at)
       VALUES ($1, 'Synthetic v2 loader fixture', 'CONSUMER_BEHAVIOR', $2,
               'Synthetic summary only.', 'Synthetic fixture; no market claim.',
               'RISING', '2026-09-01', '2026-09-30', 'Synthetic context only.',
               ARRAY['ENTREPRENEUR', 'UMKM_EXISTING']::varchar(32)[], 'DRAFT', NULL, NOW(), NOW())`,
      { bind: [ids.trendId, ids.categoryId], transaction },
    );

    const evidenceRows = [
      { id: ids.evidenceIds[0], suffix: "first", detail: "Synthetic evidence fact one." },
      { id: ids.evidenceIds[1], suffix: "second", detail: "Synthetic evidence fact two." },
    ].sort((left, right) => left.id < right.id ? 1 : -1);
    for (const row of evidenceRows) {
      await sequelize!.query(
        `INSERT INTO trend_evidences
          (id, trend_id, source_name, source_reference, supporting_detail, source_date, limitations, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, '2026-09-15', $6, NOW(), NOW())`,
        {
          bind: [row.id, ids.trendId, "Synthetic test source", `https://example.test/${row.suffix}`, row.detail, "Synthetic fixture only."],
          transaction,
        },
      );
    }

    const evidenceWithProvenanceId = ids.evidenceIds[1]!;
    const metrics = [
      { name: "volume_change", availability: "AVAILABLE", value: 8, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
      { name: "volume", availability: "AVAILABLE", value: 300, semanticAvailability: "UNKNOWN", semantic: null, unitAvailability: "UNKNOWN", unit: null },
    ];
    await sequelize!.query(
      `INSERT INTO trend_evidence_provenances
        (trend_evidence_id, schema_version, source_id, original_publisher, transport_provider,
         source_product, collection_target_url, retrieved_at, observation_period_status,
         observation_period_start, observation_period_end, geography_code,
         metrics_availability, metrics, completeness, created_at, updated_at)
       VALUES ($1, 1, 'google_trends_trending_now_indonesia', 'GOOGLE', 'BRIGHTDATA_SERP_API',
               'GOOGLE_TRENDS_TRENDING_NOW',
               'https://trends.google.com/trending?geo=ID&hl=id&brd_json=1',
               '2026-10-01T10:00:00.000Z', 'NOT_PROVIDED', NULL, NULL, 'ID',
               'AVAILABLE', $2::jsonb, 'PARTIAL', NOW(), NOW())`,
      { bind: [evidenceWithProvenanceId, JSON.stringify(metrics)], transaction },
    );
    await sequelize!.query(
      `INSERT INTO opportunities
        (id, related_trend_id, fnb_category_id, name, description, opportunity_type,
         additional_attributes, created_at, updated_at)
       VALUES ($1, $2, $3, 'Synthetic opportunity only', 'Synthetic fixture; no business claim.',
               'PRODUCT_LINE', '{"fixture":"synthetic"}'::jsonb, NOW(), NOW())`,
      { bind: [ids.opportunityId, ids.trendId, ids.categoryId], transaction },
    );
  });

  return ids;
}

async function cleanupFixture() {
  if (!sequelize || !fixture) return;
  const current = fixture;
  await sequelize.transaction(async (transaction) => {
    await sequelize!.query("DELETE FROM opportunities WHERE id = $1", {
      bind: [current.opportunityId], transaction,
    });
    await sequelize!.query("DELETE FROM trends WHERE id = $1", {
      bind: [current.trendId], transaction,
    });
    await sequelize!.query("DELETE FROM fnb_categories WHERE id = $1", {
      bind: [current.categoryId], transaction,
    });
  });
  fixture = undefined;
}

beforeAll(async () => {
  if (!enabled) return;
  assertDisposableDatabaseUrl(databaseUrl);
  sequelize = new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: (sql) => sqlLog.push(sql),
  });
  await sequelize.authenticate();

  const identity = await sequelize.query<{
    database: string;
    user: string;
    versionNumber: string;
    port: number;
  }>(
    `SELECT current_database() AS database, current_user AS user,
            current_setting('server_version_num') AS "versionNumber", inet_server_port() AS port`,
    { type: QueryTypes.SELECT },
  );
  const row = identity[0];
  if (row?.database === "venturex_dev") {
    throw new Error("PostgreSQL v2 integration tests refuse venturex_dev.");
  }
  if (
    row?.database !== "venturex_trend_evidence_provenance_test" ||
    row.user !== "venturex" ||
    Number(row.versionNumber) < 180000 || Number(row.versionNumber) >= 190000 ||
    row.port !== 5432
  ) {
    throw new Error("PostgreSQL v2 integration identity does not match the disposable PostgreSQL 18 target.");
  }

  const migrations = await sequelize.query<{ name: string }>(
    'SELECT name FROM "SequelizeMeta" ORDER BY name',
    { type: QueryTypes.SELECT },
  );
  expect(migrations.map(({ name }) => name)).toEqual(expectedMigrations);
});

afterEach(async () => {
  await cleanupFixture();
  for (const directory of auditDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

afterAll(async () => {
  await cleanupFixture();
  for (const directory of auditDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
  if (sequelize) await sequelize.close();
});

describe.skipIf(!enabled)("provenance-aware lifecycle snapshot PostgreSQL integration", () => {
  it("keeps the actual v1 loader snapshot and Opportunity projection intact", async () => {
    const ids = await seedSyntheticFixture();
    const versioned = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 1);
    expect(versioned?.fingerprintVersion).toBe(1);
    if (!versioned || versioned.fingerprintVersion !== 1) throw new Error("Expected an actual v1 database snapshot.");

    const legacy = await loadCatalogLifecycleSnapshot(sequelize!, ids.trendId);
    expect(versioned.snapshot).toEqual(legacy);
    expect(legacy?.opportunities).toEqual([
      expect.objectContaining({
        id: ids.opportunityId,
        name: "Synthetic opportunity only",
        additionalAttributes: { fixture: "synthetic" },
      }),
    ]);
    expect(fingerprintCatalogContentVersioned({ snapshot: versioned.snapshot })).toEqual(
      fingerprintCatalogContentVersioned({ fingerprintVersion: 1, snapshot: versioned.snapshot }),
    );
    const lifecycle = await sequelize!.query<{ state: string }>(
      "SELECT lifecycle_state AS state FROM trends WHERE id = $1",
      { bind: [ids.trendId], type: QueryTypes.SELECT },
    );
    expect(lifecycle[0]?.state).toBe("DRAFT");
  });

  it("loads actual v2 Trend, Evidence and optional provenance through the SQL join without Opportunity data", async () => {
    const ids = await seedSyntheticFixture();
    sqlLog.length = 0;
    const loaded = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 2);
    expect(loaded?.fingerprintVersion).toBe(2);
    if (!loaded || loaded.fingerprintVersion !== 2) throw new Error("Expected an actual v2 database snapshot.");

    expect(loaded.snapshot).toMatchObject({
      id: ids.trendId,
      title: "Synthetic v2 loader fixture",
      categoryCode: "CONSUMER_BEHAVIOR",
      subjectAreaCode: expect.stringMatching(/^SYNTHETIC_/),
      signalSummary: "Synthetic summary only.",
      direction: "RISING",
    });
    expect(loaded.snapshot.evidence.map(({ id }) => id)).toEqual([...ids.evidenceIds].sort());
    expect(loaded.snapshot.evidence[0]?.provenance).toBeNull();
    expect(loaded.snapshot.evidence[1]?.provenance?.trendEvidenceId).toBe(ids.evidenceIds[1]);
    expect(loaded.snapshot.evidence[1]?.provenance?.metrics.map(({ name }) => name)).toEqual([
      "volume",
      "volume_change",
    ]);
    expect(loaded.snapshot).not.toHaveProperty("opportunities");
    expect(sqlLog.join("\n")).toMatch(/LEFT JOIN trend_evidence_provenances/i);
    expect(sqlLog.join("\n")).not.toMatch(/\bopportunities\b/i);
  });

  it("produces stable v2 hashes and detects provenance and Evidence fact changes", async () => {
    const ids = await seedSyntheticFixture();
    const first = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 2);
    const repeated = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 2);
    if (!first || first.fingerprintVersion !== 2 || !repeated || repeated.fingerprintVersion !== 2) {
      throw new Error("Expected repeated v2 snapshots from PostgreSQL.");
    }
    const firstHash = fingerprintCatalogContentVersioned(first);
    expect(fingerprintCatalogContentVersioned(repeated)).toEqual(firstHash);

    await sequelize!.query(
      "UPDATE trend_evidence_provenances SET retrieved_at = $2 WHERE trend_evidence_id = $1",
      { bind: [ids.evidenceIds[1], new Date("2026-10-02T10:00:00.000Z")] },
    );
    const changedProvenance = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 2);
    if (!changedProvenance || changedProvenance.fingerprintVersion !== 2) throw new Error("Expected changed provenance snapshot.");
    const provenanceHash = fingerprintCatalogContentVersioned(changedProvenance);
    expect(provenanceHash.contentSha256).not.toBe(firstHash.contentSha256);

    await sequelize!.query(
      "UPDATE trend_evidences SET supporting_detail = $2 WHERE id = $1",
      { bind: [ids.evidenceIds[1], "Changed synthetic evidence fact."] },
    );
    const changedEvidence = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 2);
    if (!changedEvidence || changedEvidence.fingerprintVersion !== 2) throw new Error("Expected changed Evidence snapshot.");
    expect(fingerprintCatalogContentVersioned(changedEvidence).contentSha256).not.toBe(provenanceHash.contentSha256);

    const lifecycle = await sequelize!.query<{ state: string }>(
      "SELECT lifecycle_state AS state FROM trends WHERE id = $1",
      { bind: [ids.trendId], type: QueryTypes.SELECT },
    );
    expect(lifecycle[0]?.state).toBe("DRAFT");
  });

  it("rejects mismatched and unknown fingerprint versions", async () => {
    const ids = await seedSyntheticFixture();
    const versioned = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 2);
    if (!versioned || versioned.fingerprintVersion !== 2) throw new Error("Expected a v2 snapshot.");
    expect(() => fingerprintCatalogContentVersioned({ fingerprintVersion: 1, snapshot: versioned.snapshot }))
      .toThrow("Version 1 requires the historical lifecycle snapshot shape.");
    expect(() => fingerprintCatalogContentVersioned({ fingerprintVersion: 3, snapshot: versioned.snapshot }))
      .toThrow("Versioned fingerprint input is invalid.");
  });

  it("records a synthetic v1-to-v2 review and approval chain against the current PostgreSQL snapshot", async () => {
    const ids = await seedSyntheticFixture();
    const input = v2DecisionInput(ids.trendId);
    const { harness, ledgerPath } = await createV2Harness();
    const legacy = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 1);
    if (!legacy || legacy.fingerprintVersion !== 1) throw new Error("Expected a current v1-compatible database snapshot.");

    await harness.appendSyntheticEvent((prior) => createSyntheticV1Review(
      prior,
      ids.trendId,
      fingerprintCatalogContentVersioned(legacy).contentSha256,
    ));
    const review = await harness.recordFactualReview(input);
    const approval = await harness.recordPublicationApproval({
      ...input,
      actorOsAccount: "synthetic-product-owner",
      factualReviewEventId: review.id,
    });
    const verified = await harness.readVerifiedLedger();

    expect(verified.map(({ schemaVersion }) => schemaVersion)).toEqual([1, 2, 2]);
    expect(verified[0]).not.toHaveProperty("fingerprintVersion");
    expect(approval).toMatchObject({
      schemaVersion: 2,
      fingerprintVersion: 2,
      action: "PUBLICATION_APPROVAL",
      factualReviewReference: { eventId: review.id, eventHash: review.hash },
    });
    expect(await harness.assertCurrentSnapshotApproved(input)).toBe(review.contentSha256);
    const serialized = await readFile(ledgerPath, "utf8");
    expect(serialized.trim().split(/\r?\n/)).toHaveLength(3);

    const state = await sequelize!.query<{ state: string }>(
      "SELECT lifecycle_state AS state FROM trends WHERE id = $1",
      { bind: [ids.trendId], type: QueryTypes.SELECT },
    );
    expect(state[0]?.state).toBe("DRAFT");
  });

  it.each(["trend", "evidence", "provenance"] as const)(
    "rejects a v2 approval when %s changes between readiness check and proposed transition",
    async (changedFact) => {
      const ids = await seedSyntheticFixture();
      const input = v2DecisionInput(ids.trendId);
      const { harness } = await createV2Harness();
      const review = await harness.recordFactualReview(input);
      await harness.recordPublicationApproval({
        ...input,
        actorOsAccount: "synthetic-product-owner",
        factualReviewEventId: review.id,
      });
      const approvedHash = await harness.assertCurrentSnapshotApproved(input);
      expect(approvedHash).toBe(review.contentSha256);

      if (changedFact === "trend") {
        await sequelize!.query("UPDATE trends SET signal_summary = $2 WHERE id = $1", {
          bind: [ids.trendId, "Changed synthetic Trend fact after review."],
        });
      } else if (changedFact === "evidence") {
        await sequelize!.query("UPDATE trend_evidences SET supporting_detail = $2 WHERE id = $1", {
          bind: [ids.evidenceIds[0], "Changed synthetic Evidence fact after review."],
        });
      } else {
        await sequelize!.query("UPDATE trend_evidence_provenances SET retrieved_at = $2 WHERE trend_evidence_id = $1", {
          bind: [ids.evidenceIds[1], new Date("2026-10-02T10:00:00.000Z")],
        });
      }

      await expect(harness.assertCurrentSnapshotApproved(input))
        .rejects.toThrow(/stale or does not match the current Trend snapshot/i);
      const state = await sequelize!.query<{ state: string }>(
        "SELECT lifecycle_state AS state FROM trends WHERE id = $1",
        { bind: [ids.trendId], type: QueryTypes.SELECT },
      );
      expect(state[0]?.state).toBe("DRAFT");
    },
  );

  it("allows only the current review to win concurrent approval attempts for conflicting snapshots", async () => {
    const ids = await seedSyntheticFixture();
    const input = v2DecisionInput(ids.trendId);
    const { harness } = await createV2Harness();
    const oldReview = await harness.recordFactualReview(input);
    await sequelize!.query("UPDATE trend_evidence_provenances SET retrieved_at = $2 WHERE trend_evidence_id = $1", {
      bind: [ids.evidenceIds[1], new Date("2026-10-02T10:00:00.000Z")],
    });
    const currentReview = await harness.recordFactualReview({
      ...input,
      actorOsAccount: "synthetic-reviewer-2",
      rationale: "A second synthetic review binds the changed current snapshot.",
    });

    const attempts = await Promise.allSettled([
      harness.recordPublicationApproval({
        ...input,
        actorOsAccount: "synthetic-owner-old",
        factualReviewEventId: oldReview.id,
      }),
      harness.recordPublicationApproval({
        ...input,
        actorOsAccount: "synthetic-owner-current",
        factualReviewEventId: currentReview.id,
      }),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    if (fulfilled[0]?.status !== "fulfilled") throw new Error("Expected the current snapshot approval attempt to succeed.");
    expect(fulfilled[0].value.factualReviewReference).toEqual({
      eventId: currentReview.id,
      eventHash: currentReview.hash,
    });
    await expect(harness.assertCurrentSnapshotApproved(input)).resolves.toBe(currentReview.contentSha256);
  });

  it("requires a new current approval after a later rejected review", async () => {
    const ids = await seedSyntheticFixture();
    const input = v2DecisionInput(ids.trendId);
    const { harness } = await createV2Harness();
    const approvedReview = await harness.recordFactualReview(input);
    await harness.recordPublicationApproval({
      ...input,
      actorOsAccount: "synthetic-product-owner",
      factualReviewEventId: approvedReview.id,
    });
    await harness.recordFactualReview({
      ...input,
      decision: "REJECTED",
      rationale: "A later synthetic rejection supersedes prior review approval.",
    });

    await expect(harness.assertCurrentSnapshotApproved(input))
      .rejects.toThrow(/latest review and publication approval/i);
  });

  it("fails closed on an interrupted transition and a tampered temporary audit ledger", async () => {
    const ids = await seedSyntheticFixture();
    const input = v2DecisionInput(ids.trendId);
    const { harness, ledgerPath } = await createV2Harness();
    const review = await harness.recordFactualReview(input);
    await harness.recordPublicationApproval({
      ...input,
      actorOsAccount: "synthetic-product-owner",
      factualReviewEventId: review.id,
    });
    const current = await loadVersionedCatalogLifecycleSnapshot(sequelize!, ids.trendId, 2);
    if (!current || current.fingerprintVersion !== 2) throw new Error("Expected a current v2 snapshot.");
    const contentSha256 = fingerprintCatalogContentVersioned(current).contentSha256;

    await harness.appendSyntheticEvent((prior) => createSyntheticV2TransitionStart(prior, input, contentSha256));
    const interruptedLedger = await harness.readVerifiedLedger();
    expect(() => assertCatalogV2LedgerReconciled(interruptedLedger)).toThrow(/manual reconciliation is required/i);
    await expect(harness.assertCurrentSnapshotApproved(input)).rejects.toThrow(/manual reconciliation is required/i);

    const state = await sequelize!.query<{ state: string }>(
      "SELECT lifecycle_state AS state FROM trends WHERE id = $1",
      { bind: [ids.trendId], type: QueryTypes.SELECT },
    );
    expect(state[0]?.state).toBe("DRAFT");

    const lines = (await readFile(ledgerPath, "utf8")).trim().split(/\r?\n/);
    const tampered = JSON.parse(lines[0]!) as Record<string, unknown>;
    tampered.rationale = "Tampered synthetic event; hash remains unchanged.";
    lines[0] = JSON.stringify(tampered);
    await writeFile(ledgerPath, `${lines.join("\n")}\n`, "utf8");
    await expect(harness.readVerifiedLedger()).rejects.toThrow(/hash verification failed/i);
  });
});
