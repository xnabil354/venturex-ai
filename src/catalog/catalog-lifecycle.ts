import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { canonicalJson } from "../lib/canonical-json";
import type { TrendLifecycleState } from "../trend/domain";
import type { CuratedCatalogManifest } from "./catalog-manifest";
import { JsonlCatalogAuditLedger } from "./catalog-audit-ledger";
import {
  CatalogLifecycleError,
  type CatalogDecision,
  type CatalogLifecycleAuditEvent,
  type CatalogLifecycleSnapshot,
} from "./catalog-lifecycle-contract";

export { defaultCatalogAuditPath, JsonlCatalogAuditLedger, type CatalogAuditPathEnvironment } from "./catalog-audit-ledger";
export * from "./catalog-lifecycle-contract";

export const APPROVED_CATALOG_MANIFEST_ID = "venturex-curated-fnb-google-yis-2025-v1";
export const APPROVED_CATALOG_MANIFEST_SHA256 = "EBFADE3A6371DD95D5A78C10327EE8C9EFE1A86093650924EE9ADE135E077A85";


function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").toUpperCase();
}

export function verifyApprovedManifest(manifest: CuratedCatalogManifest, actualSha256: string): void {
  if (
    manifest.manifestId !== APPROVED_CATALOG_MANIFEST_ID ||
    actualSha256.toUpperCase() !== APPROVED_CATALOG_MANIFEST_SHA256
  ) {
    throw new CatalogLifecycleError("The catalog manifest does not match the approved identifier and checksum.");
  }
}

function normalizeSnapshot(snapshot: CatalogLifecycleSnapshot) {
  const trend = snapshot.trend;
  return {
    trend: {
      id: trend.id,
      title: trend.title,
      categoryCode: trend.categoryCode,
      subjectAreaCode: trend.subjectAreaCode,
      signalSummary: trend.signalSummary,
      signalDescription: trend.signalDescription,
      direction: trend.direction,
      periodStart: trend.periodStart,
      periodEnd: trend.periodEnd,
      businessRelevanceExplanation: trend.businessRelevanceExplanation,
      affectedUserTypes: [...trend.affectedUserTypes],
      evidence: [...trend.evidence].sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({ ...item })),
    },
    opportunities: [...snapshot.opportunities].sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({
      ...item,
      additionalAttributes: item.additionalAttributes ?? {},
    })),
  };
}

function expectedManifestContent(manifest: CuratedCatalogManifest, trendId: string) {
  const trend = manifest.trends.find((item) => item.id === trendId);
  if (!trend) throw new CatalogLifecycleError("Trend ID is not part of the approved manifest.");
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
      evidence: trend.evidence.map((item) => ({
        id: item.id,
        sourceName: item.sourceName,
        sourceReference: item.sourceReference,
        supportingDetail: item.supportingDetail,
        sourceDate: item.sourceDate,
        limitations: item.limitations,
      })).sort((a, b) => a.id.localeCompare(b.id)),
    },
    opportunities: manifest.opportunities.filter((item) => item.relatedTrendId === trendId)
      .map((item) => ({
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
      })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function assertManifestContentMatches(
  manifest: CuratedCatalogManifest,
  trendId: string,
  snapshot: CatalogLifecycleSnapshot,
): void {
  const actual = normalizeSnapshot(snapshot);
  const expected = expectedManifestContent(manifest, trendId);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new CatalogLifecycleError("Stored Trend, evidence, or Opportunity content differs from the approved manifest.");
  }
}

export function fingerprintCatalogContent(snapshot: CatalogLifecycleSnapshot): string {
  return sha256(canonicalJson(normalizeSnapshot(snapshot)));
}

export type CatalogLifecyclePort = {
  readonly loadSnapshot: (trendId: string) => Promise<CatalogLifecycleSnapshot | null>;
  readonly assertTransition: (from: TrendLifecycleState, to: TrendLifecycleState) => void;
  readonly validateTrend: (trendId: string, expectedContentSha256: string) => Promise<unknown>;
  readonly publishTrend: (trendId: string, expectedContentSha256: string) => Promise<unknown>;
};

export type CatalogLifecycleActor = {
  readonly osAccount: string;
};

export class CatalogLifecycleService {
  constructor(
    private readonly manifest: CuratedCatalogManifest,
    private readonly manifestSha256: string,
    private readonly audit: JsonlCatalogAuditLedger,
    private readonly port: CatalogLifecyclePort,
    private readonly actor: CatalogLifecycleActor,
    private readonly clock: () => Date = () => new Date(),
    private readonly newId: () => string = randomUUID,
  ) {
    verifyApprovedManifest(manifest, manifestSha256);
    if (!actor.osAccount.trim()) throw new CatalogLifecycleError("A local operating-system account is required for audit attribution.");
  }

  async recordFactualReview(input: {
    readonly trendId: string;
    readonly decision: CatalogDecision;
    readonly rationale: string;
    readonly evidenceLimitations: readonly string[];
  }): Promise<CatalogLifecycleAuditEvent> {
    return this.withTrendLock(input.trendId, async () => {
      const snapshot = await this.requireSnapshot(input.trendId, "DRAFT");
      this.requireNoPendingTransitions(await this.audit.readVerified(), input.trendId);
      this.requireDecision(input.decision, input.rationale, input.evidenceLimitations);
      return this.appendDecision("FACTUAL_REVIEW", input.trendId, snapshot, "FACTUAL_REVIEWER", input.decision, input.rationale, input.evidenceLimitations);
    });
  }

  async validate(input: { readonly trendId: string; readonly confirmation: string }): Promise<void> {
    await this.withTrendLock(input.trendId, async () => {
      const snapshot = await this.requireSnapshot(input.trendId, "DRAFT");
      const events = await this.audit.readVerified();
      this.requireNoPendingTransitions(events, input.trendId);
      const contentSha256 = fingerprintCatalogContent(snapshot);
      const review = this.requireLatestApproved(events, "FACTUAL_REVIEW", input.trendId, contentSha256);
      const confirmation = `VALIDATE ${input.trendId}`;
      if (input.confirmation !== confirmation) throw new CatalogLifecycleError(`Validation requires the exact confirmation text: ${confirmation}.`);
      this.port.assertTransition("DRAFT", "VALIDATED");
      await this.performTransition("TRANSITION_STARTED", "TRANSITION_SUCCEEDED", "TRANSITION_FAILED", input.trendId, snapshot, "DRAFT", "VALIDATED", review.evidenceLimitations, "Factual review recorded; existing Trend lifecycle requirements will be checked.", () => this.port.validateTrend(input.trendId, contentSha256));
    });
  }

  async recordPublicationApproval(input: {
    readonly trendId: string;
    readonly decision: CatalogDecision;
    readonly rationale: string;
  }): Promise<CatalogLifecycleAuditEvent> {
    return this.withTrendLock(input.trendId, async () => {
      const snapshot = await this.requireSnapshot(input.trendId, "VALIDATED");
      const events = await this.audit.readVerified();
      this.requireNoPendingTransitions(events, input.trendId);
      const review = this.requireLatestApproved(events, "FACTUAL_REVIEW", input.trendId, fingerprintCatalogContent(snapshot));
      this.requireDecision(input.decision, input.rationale, review.evidenceLimitations);
      return this.appendDecision("PUBLICATION_APPROVAL", input.trendId, snapshot, "PRODUCT_DATA_OWNER", input.decision, input.rationale, review.evidenceLimitations);
    });
  }

  async publish(input: { readonly trendId: string; readonly confirmation: string }): Promise<void> {
    await this.withTrendLock(input.trendId, async () => {
      const snapshot = await this.requireSnapshot(input.trendId, "VALIDATED");
      const events = await this.audit.readVerified();
      this.requireNoPendingTransitions(events, input.trendId);
      const contentSha256 = fingerprintCatalogContent(snapshot);
      this.requireLatestApproved(events, "FACTUAL_REVIEW", input.trendId, contentSha256);
      const approval = this.requireLatestApproved(events, "PUBLICATION_APPROVAL", input.trendId, contentSha256);
      const confirmation = `PUBLISH ${input.trendId}`;
      if (input.confirmation !== confirmation) throw new CatalogLifecycleError(`Publication requires the exact confirmation text: ${confirmation}.`);
      this.port.assertTransition("VALIDATED", "PUBLISHED");
      await this.performTransition("TRANSITION_STARTED", "TRANSITION_SUCCEEDED", "TRANSITION_FAILED", input.trendId, snapshot, "VALIDATED", "PUBLISHED", approval.evidenceLimitations, "Recorded Product/Data Owner approval; existing Trend lifecycle requirements will be checked.", () => this.port.publishTrend(input.trendId, contentSha256));
    });
  }

  private async withTrendLock<T>(trendId: string, operation: () => Promise<T>): Promise<T> {
    const directory = path.dirname(this.audit.filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const lockPath = path.join(directory, `.catalog-lifecycle-${sha256(trendId)}.workflow.lock`);
    let lock;
    try {
      lock = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new CatalogLifecycleError("A lifecycle action is already running or left a stale workflow lock; inspect before retrying.");
      }
      throw error;
    }
    try {
      await lock.writeFile(`${this.actor.osAccount.trim()}\n`, "utf8");
      return await operation();
    } finally {
      await lock.close();
      await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }

  private async requireSnapshot(trendId: string, state: TrendLifecycleState): Promise<CatalogLifecycleSnapshot> {
    const trendManifestItem = this.manifest.trends.find((item) => item.id === trendId);
    if (!trendManifestItem) throw new CatalogLifecycleError("Trend ID is not included in the approved catalog manifest.");
    const snapshot = await this.port.loadSnapshot(trendId);
    if (!snapshot) throw new CatalogLifecycleError("Approved Trend was not found in the database.");
    assertManifestContentMatches(this.manifest, trendId, snapshot);
    if (snapshot.trend.lifecycleState !== state) {
      throw new CatalogLifecycleError(`Trend must be ${state} for this action; current state is ${snapshot.trend.lifecycleState}.`);
    }
    return snapshot;
  }

  private requireDecision(decision: CatalogDecision, rationale: string, limitations: readonly string[]): void {
    if (decision !== "APPROVED" && decision !== "REJECTED") throw new CatalogLifecycleError("An explicit APPROVED or REJECTED decision is required.");
    if (rationale.trim().length < 10 || rationale.trim().length > 2000) throw new CatalogLifecycleError("An audit rationale of 10 to 2000 characters is required.");
    if (limitations.length < 1 || limitations.length > 12 || limitations.some((item) => !item.trim() || item.trim().length > 2000)) {
      throw new CatalogLifecycleError("One to twelve concrete evidence limitations are required.");
    }
  }

  private async appendDecision(
    action: "FACTUAL_REVIEW" | "PUBLICATION_APPROVAL",
    trendId: string,
    snapshot: CatalogLifecycleSnapshot,
    role: "FACTUAL_REVIEWER" | "PRODUCT_DATA_OWNER",
    decision: CatalogDecision,
    rationale: string,
    evidenceLimitations: readonly string[],
  ): Promise<CatalogLifecycleAuditEvent> {
    return this.audit.append({
      action,
      manifestId: this.manifest.manifestId,
      manifestSha256: this.manifestSha256.toUpperCase(),
      trendId,
      contentSha256: fingerprintCatalogContent(snapshot),
      actor: { osAccount: this.actor.osAccount.trim(), role, identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE" },
      decision,
      rationale: rationale.trim(),
      evidenceLimitations: evidenceLimitations.map((item) => item.trim()),
      transition: null,
    });
  }

  private latestDecision(
    events: readonly CatalogLifecycleAuditEvent[],
    action: "FACTUAL_REVIEW" | "PUBLICATION_APPROVAL",
    trendId: string,
  ): CatalogLifecycleAuditEvent | undefined {
    return [...events].reverse().find((event) =>
      event.action === action &&
      event.manifestId === this.manifest.manifestId &&
      event.manifestSha256 === this.manifestSha256.toUpperCase() &&
      event.trendId === trendId,
    );
  }

  private requireLatestApproved(
    events: readonly CatalogLifecycleAuditEvent[],
    action: "FACTUAL_REVIEW" | "PUBLICATION_APPROVAL",
    trendId: string,
    contentSha256: string,
  ): CatalogLifecycleAuditEvent {
    const latest = this.latestDecision(events, action, trendId);
    if (!latest || latest.decision !== "APPROVED" || latest.contentSha256 !== contentSha256) {
      throw new CatalogLifecycleError(`${action} is missing, rejected, or bound to different catalog content.`);
    }
    return latest;
  }

  private requireNoPendingTransitions(events: readonly CatalogLifecycleAuditEvent[], trendId: string): void {
    const started = new Set(events.filter((event) => event.trendId === trendId && event.action === "TRANSITION_STARTED")
      .map((event) => event.transition?.id).filter((id): id is string => Boolean(id)));
    for (const event of events) {
      if (
        event.trendId === trendId &&
        (event.action === "TRANSITION_SUCCEEDED" || event.action === "TRANSITION_FAILED") &&
        event.transition
      ) started.delete(event.transition.id);
    }
    if (started.size > 0) throw new CatalogLifecycleError("An earlier lifecycle transition has no audit outcome; manual reconciliation is required.");
  }

  private async performTransition(
    startAction: "TRANSITION_STARTED",
    successAction: "TRANSITION_SUCCEEDED",
    failureAction: "TRANSITION_FAILED",
    trendId: string,
    snapshot: CatalogLifecycleSnapshot,
    from: TrendLifecycleState,
    to: TrendLifecycleState,
    evidenceLimitations: readonly string[],
    rationale: string,
    transition: () => Promise<unknown>,
  ): Promise<void> {
    const transitionId = this.newId();
    const common = {
      manifestId: this.manifest.manifestId,
      manifestSha256: this.manifestSha256.toUpperCase(),
      trendId,
      contentSha256: fingerprintCatalogContent(snapshot),
      actor: { osAccount: this.actor.osAccount.trim(), role: "OPERATOR" as const, identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE" as const },
      decision: "NOT_APPLICABLE" as const,
      evidenceLimitations: [...evidenceLimitations],
      transition: { id: transitionId, from, to },
    };
    await this.audit.append({ action: startAction, ...common, rationale });
    try {
      await transition();
    } catch (error) {
      await this.audit.append({
        action: failureAction,
        ...common,
        rationale: `Lifecycle transition failed with ${error instanceof Error ? error.name : "unknown error"}.`,
      });
      throw error;
    }
    await this.audit.append({
      action: successAction,
      ...common,
      rationale: `Trend lifecycle changed from ${from} to ${to} through the guarded local lifecycle command.`,
    });
  }
}
