import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  APPROVED_CATALOG_MANIFEST_SHA256,
  CatalogLifecycleError,
  CatalogLifecycleService,
  defaultCatalogAuditPath,
  fingerprintCatalogContent,
  JsonlCatalogAuditLedger,
  verifyApprovedManifest,
  type CatalogLifecycleSnapshot,
} from "./catalog-lifecycle";
import { parseCuratedCatalogManifest } from "./catalog-manifest";
import { assertTrendTransition } from "../trend/domain";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const manifestBytes = await readFile(path.join(root, "data/catalog/curated-fnb-2025-candidates.v1.json"));
const manifestSha256 = createHash("sha256").update(manifestBytes).digest("hex").toUpperCase();
const manifest = parseCuratedCatalogManifest(JSON.parse(manifestBytes.toString("utf8")));
const temporaryDirectories: string[] = [];

describe("private catalog audit location", () => {
  it("resolves the ledger under the operator profile and ignores the legacy LocalAppData location", () => {
    const userProfile = path.join(os.tmpdir(), "venturex-private-audit-profile");
    const legacyLocation = path.join(os.tmpdir(), "venturex-legacy-audit");

    expect(defaultCatalogAuditPath({ USERPROFILE: userProfile, LOCALAPPDATA: legacyLocation })).toBe(
      path.join(userProfile, "VENTUREX-private-audit", "catalog-lifecycle-audit.jsonl"),
    );
  });

  it("rejects a missing or relative operator profile", () => {
    expect(() => defaultCatalogAuditPath({})).toThrow(/absolute USERPROFILE/);
    expect(() => defaultCatalogAuditPath({ USERPROFILE: "relative-profile" })).toThrow(/absolute USERPROFILE/);
  });

  it("rejects an audit path override outside the private per-user location", () => {
    const userProfile = path.join(os.tmpdir(), "venturex-private-audit-profile");
    expect(() => defaultCatalogAuditPath({
      USERPROFILE: userProfile,
      VENTUREX_CATALOG_AUDIT_PATH: path.join(os.tmpdir(), "wrong-audit", "catalog-lifecycle-audit.jsonl"),
    })).toThrow(/must match the private per-user catalog audit location/);
  });

  it("accepts an explicit path only when it exactly matches the private per-user location", () => {
    const userProfile = path.join(os.tmpdir(), "venturex-private-audit-profile");
    const privatePath = path.join(userProfile, "VENTUREX-private-audit", "catalog-lifecycle-audit.jsonl");

    expect(defaultCatalogAuditPath({ USERPROFILE: userProfile, VENTUREX_CATALOG_AUDIT_PATH: privatePath })).toBe(privatePath);
    expect(new JsonlCatalogAuditLedger(privatePath).filePath).toBe(privatePath);
  });

  it("uses the private location for the lifecycle CLI's default ledger instance", () => {
    const userProfile = path.join(os.tmpdir(), "venturex-cli-audit-profile");
    const originalUserProfile = process.env.USERPROFILE;
    const originalAuditPath = process.env.VENTUREX_CATALOG_AUDIT_PATH;
    try {
      process.env.USERPROFILE = userProfile;
      delete process.env.VENTUREX_CATALOG_AUDIT_PATH;
      expect(new JsonlCatalogAuditLedger().filePath).toBe(
        path.join(userProfile, "VENTUREX-private-audit", "catalog-lifecycle-audit.jsonl"),
      );
    } finally {
      if (originalUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = originalUserProfile;
      if (originalAuditPath === undefined) delete process.env.VENTUREX_CATALOG_AUDIT_PATH;
      else process.env.VENTUREX_CATALOG_AUDIT_PATH = originalAuditPath;
    }
  });
});

function createSnapshot(trendId: string, lifecycleState: CatalogLifecycleSnapshot["trend"]["lifecycleState"] = "DRAFT"): CatalogLifecycleSnapshot {
  const trend = manifest.trends.find((item) => item.id === trendId);
  if (!trend) throw new Error("Test Trend is missing from the manifest.");
  return {
    trend: {
      id: trend.id,
      title: trend.title,
      categoryCode: trend.categoryCode,
      subjectAreaCode: trend.subjectAreaCode,
      signalSummary: trend.signal.summary,
      signalDescription: trend.signal.description,
      direction: trend.signal.direction,
      periodStart: trend.signal.periodStart,
      periodEnd: trend.signal.periodEnd,
      businessRelevanceExplanation: trend.businessRelevanceExplanation,
      affectedUserTypes: [...trend.affectedUserTypes],
      lifecycleState,
      evidence: trend.evidence.map((item) => ({ ...item })),
    },
    opportunities: manifest.opportunities.filter((item) => item.relatedTrendId === trendId).map((item) => ({
      id: item.id,
      relatedTrendId: item.relatedTrendId,
      fnbCategoryCode: item.fnbCategoryCode,
      name: item.name,
      description: item.description,
      opportunityType: item.opportunityType,
      targetConsumerSummary: item.targetConsumerSummary,
      competitionLevel: item.competitionLevel,
      competitionSummary: item.competitionSummary,
      executionFeasibility: null,
      marketSustainability: null,
      additionalAttributes: {},
    })),
  };
}

async function createFixture(trendId: string) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "venturex-catalog-lifecycle-"));
  temporaryDirectories.push(directory);
  const ledger = new JsonlCatalogAuditLedger(path.join(directory, "audit.jsonl"));
  let snapshot = createSnapshot(trendId);
  const transitions: string[] = [];
  const service = new CatalogLifecycleService(
    manifest,
    manifestSha256,
    ledger,
    {
      loadSnapshot: async (id) => id === snapshot.trend.id ? snapshot : null,
      assertTransition: assertTrendTransition,
      validateTrend: async (id) => {
        if (id !== snapshot.trend.id || snapshot.trend.lifecycleState !== "DRAFT") throw new Error("Invalid database transition");
        snapshot = { ...snapshot, trend: { ...snapshot.trend, lifecycleState: "VALIDATED" } };
        transitions.push("VALIDATED");
      },
      publishTrend: async (id) => {
        if (id !== snapshot.trend.id || snapshot.trend.lifecycleState !== "VALIDATED") throw new Error("Invalid database transition");
        snapshot = { ...snapshot, trend: { ...snapshot.trend, lifecycleState: "PUBLISHED" } };
        transitions.push("PUBLISHED");
      },
    },
    { osAccount: "venturex-test-account" },
    () => new Date("2026-10-12T03:00:00.000Z"),
    (() => {
      let id = 0;
      return () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}`;
    })(),
  );
  return {
    directory,
    ledger,
    service,
    transitions,
    get snapshot() { return snapshot; },
    set snapshot(next: CatalogLifecycleSnapshot) { snapshot = next; },
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("curated catalog lifecycle", () => {
  const trendId = manifest.trends[0]!.id;
  const approvedManifestSha256 = manifestSha256;
  const limitations = [
    "Year in Search rank is relative growth, not total search volume or purchasing demand.",
    "The historical list does not establish current 2026 interest or commercial viability.",
  ];

  it("accepts only the approved manifest checksum", () => {
    expect(manifestSha256).toBe(APPROVED_CATALOG_MANIFEST_SHA256);
    expect(() => verifyApprovedManifest(manifest, "0".repeat(64))).toThrow(CatalogLifecycleError);
  });

  it("rejects review actions without a usable local operator identity or explicit decision", async () => {
    const fixture = await createFixture(trendId);
    expect(() => new CatalogLifecycleService(
      manifest,
      manifestSha256,
      fixture.ledger,
      { loadSnapshot: async () => fixture.snapshot, assertTransition: assertTrendTransition, validateTrend: async () => undefined, publishTrend: async () => undefined },
      { osAccount: "  " },
    )).toThrow(/operating-system account/);
    await expect(fixture.service.recordFactualReview({
      trendId,
      decision: "INVALID" as never,
      rationale: "This decision was not explicitly selected.",
      evidenceLimitations: limitations,
    })).rejects.toThrow(/explicit APPROVED or REJECTED decision/);
    await expect(fixture.ledger.readVerified()).resolves.toEqual([]);
  });

  it("rejects validation and publication when review or owner approval is absent", async () => {
    const fixture = await createFixture(trendId);
    await expect(fixture.service.validate({ trendId, confirmation: `VALIDATE ${trendId}` }))
      .rejects.toThrow(/FACTUAL_REVIEW is missing/);
    await expect(fixture.service.publish({ trendId, confirmation: `PUBLISH ${trendId}` }))
      .rejects.toThrow(/must be VALIDATED/);
    await fixture.service.recordFactualReview({
      trendId,
      decision: "APPROVED",
      rationale: "Factual review recorded for the historical source scope.",
      evidenceLimitations: limitations,
    });
    await fixture.service.validate({ trendId, confirmation: `VALIDATE ${trendId}` });
    await expect(fixture.service.publish({ trendId, confirmation: `PUBLISH ${trendId}` }))
      .rejects.toThrow(/PUBLICATION_APPROVAL is missing/);
    expect(fixture.transitions).toEqual(["VALIDATED"]);
  });

  it("rejects a Product/Data Owner approval when no approved factual review exists", async () => {
    const fixture = await createFixture(trendId);
    fixture.snapshot = createSnapshot(trendId, "VALIDATED");
    await expect(fixture.service.recordPublicationApproval({
      trendId,
      decision: "APPROVED",
      rationale: "This approval lacks its required factual review record.",
    })).rejects.toThrow(/FACTUAL_REVIEW is missing, rejected/);
    expect(await fixture.ledger.readVerified()).toEqual([]);
  });

  it("requires owner approval after an approved factual review and records both distinct decisions", async () => {
    const fixture = await createFixture(trendId);
    await fixture.service.recordFactualReview({
      trendId,
      decision: "APPROVED",
      rationale: "The source scope and evidence limits were reviewed.",
      evidenceLimitations: limitations,
    });
    await fixture.service.validate({ trendId, confirmation: `VALIDATE ${trendId}` });
    await expect(fixture.service.recordPublicationApproval({
      trendId,
      decision: "APPROVED",
      rationale: "Publication approval requires a prior factual review.",
    })).resolves.toMatchObject({
      action: "PUBLICATION_APPROVAL",
      actor: { role: "PRODUCT_DATA_OWNER", osAccount: "venturex-test-account" },
      evidenceLimitations: limitations,
    });
    await fixture.service.publish({ trendId, confirmation: `PUBLISH ${trendId}` });

    expect(fixture.transitions).toEqual(["VALIDATED", "PUBLISHED"]);
    const events = await fixture.ledger.readVerified();
    expect(events.map(({ action }) => action)).toEqual([
      "FACTUAL_REVIEW",
      "TRANSITION_STARTED",
      "TRANSITION_SUCCEEDED",
      "PUBLICATION_APPROVAL",
      "TRANSITION_STARTED",
      "TRANSITION_SUCCEEDED",
    ]);
    expect(events.every(({ manifestSha256, trendId: eventTrendId, contentSha256 }) =>
      manifestSha256 === approvedManifestSha256 && eventTrendId === trendId && /^[A-F0-9]{64}$/.test(contentSha256),
    )).toBe(true);
    expect(events[0]?.actor.role).toBe("FACTUAL_REVIEWER");
    expect(events[3]?.actor.role).toBe("PRODUCT_DATA_OWNER");
    expect(events.every(({ actor }) => actor.identityAssurance === "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE")).toBe(true);
    expect(events.at(-1)?.previousHash).toBe(events.at(-2)?.hash);
  });

  it("does not allow a rejection or changed manifest content to advance the Trend", async () => {
    const rejected = await createFixture(trendId);
    await rejected.service.recordFactualReview({
      trendId,
      decision: "REJECTED",
      rationale: "Source interpretation needs more factual review.",
      evidenceLimitations: limitations,
    });
    await expect(rejected.service.validate({ trendId, confirmation: `VALIDATE ${trendId}` }))
      .rejects.toThrow(/FACTUAL_REVIEW is missing, rejected/);
    expect(rejected.transitions).toEqual([]);

    const changed = await createFixture(trendId);
    await changed.service.recordFactualReview({
      trendId,
      decision: "APPROVED",
      rationale: "Reviewed current manifest-bound evidence and limits.",
      evidenceLimitations: limitations,
    });
    changed.snapshot = {
      ...changed.snapshot,
      trend: { ...changed.snapshot.trend, signalSummary: "Changed content after the review." },
    };
    await expect(changed.service.validate({ trendId, confirmation: `VALIDATE ${trendId}` }))
      .rejects.toThrow(/differs from the approved manifest/);
    expect(changed.transitions).toEqual([]);
  });

  it("rejects an invalid lifecycle step and incorrect confirmation", async () => {
    const fixture = await createFixture(trendId);
    await fixture.service.recordFactualReview({
      trendId,
      decision: "APPROVED",
      rationale: "Reviewed the factual scope and evidence caveats.",
      evidenceLimitations: limitations,
    });
    await expect(fixture.service.validate({ trendId, confirmation: "VALIDATE something-else" }))
      .rejects.toThrow(/exact confirmation/);
    expect(fixture.transitions).toEqual([]);
  });

  it("detects modifications to the hash-chained audit ledger", async () => {
    const fixture = await createFixture(trendId);
    await fixture.service.recordFactualReview({
      trendId,
      decision: "APPROVED",
      rationale: "Recorded a synthetic factual review for integrity testing.",
      evidenceLimitations: limitations,
    });
    const filePath = path.join(fixture.directory, "audit.jsonl");
    const original = await readFile(filePath, "utf8");
    await writeFile(filePath, original.replace("APPROVED", "REJECTED"), "utf8");
    await expect(fixture.ledger.readVerified()).rejects.toThrow(/hash chain failed/);
  });

  it("binds the content fingerprint to all evidence and Opportunity content", () => {
    const original = createSnapshot(trendId);
    const changed = {
      ...original,
      opportunities: original.opportunities.map((item, index) => index === 0 ? { ...item, description: `${item.description} changed` } : item),
    };
    expect(fingerprintCatalogContent(changed)).not.toBe(fingerprintCatalogContent(original));
  });
});
