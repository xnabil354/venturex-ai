import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { QueryTypes, type Sequelize } from "sequelize";

import {
  fingerprintCatalogContentVersioned,
  type CatalogFingerprintV2Snapshot,
} from "../catalog-fingerprint";
import {
  CatalogAuditContractError,
  hashVersionedCatalogAuditEventPayload,
  verifyVersionedCatalogAuditLedger,
  type CatalogAuditEventV2,
  type VersionedCatalogAuditEvent,
} from "../catalog-audit-contract";
import { loadVersionedCatalogLifecycleSnapshot } from "../catalog-lifecycle-repository";

export type CatalogV2Decision = "APPROVED" | "REJECTED";

export type CatalogV2DecisionInput = {
  readonly manifestId: string;
  readonly manifestSha256: string;
  readonly trendId: string;
  readonly actorOsAccount: string;
  readonly decision: CatalogV2Decision;
  readonly rationale: string;
  readonly evidenceLimitations: readonly string[];
};

export type CatalogV2PublicationApprovalInput = CatalogV2DecisionInput & {
  readonly factualReviewEventId: string;
};

type HarnessOptions = {
  readonly sequelize: Sequelize;
  readonly ledgerPath: string;
  readonly clock?: () => Date;
  readonly newId?: () => string;
};

type AuditEventFactory = (
  priorEvents: readonly VersionedCatalogAuditEvent[],
) => VersionedCatalogAuditEvent | Promise<VersionedCatalogAuditEvent>;

function assertTemporaryPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CatalogAuditContractError("The isolated v2 harness ledger must be inside the operating-system temporary directory.");
  }
  return resolved;
}

function effectiveFingerprintVersion(event: VersionedCatalogAuditEvent): number {
  return event.schemaVersion === 1 ? 1 : event.fingerprintVersion;
}

export function assertCatalogV2LedgerReconciled(
  events: readonly VersionedCatalogAuditEvent[],
): void {
  const started = new Map<string, VersionedCatalogAuditEvent>();
  const seen = new Set<string>();

  for (const event of events) {
    if (!event.action.startsWith("TRANSITION_")) continue;
    const transition = event.transition;
    if (!transition) throw new CatalogAuditContractError("A transition event is missing its transition context.");

    if (event.action === "TRANSITION_STARTED") {
      if (seen.has(transition.id)) {
        throw new CatalogAuditContractError("A transition ID is duplicated or reused in the audit ledger.");
      }
      seen.add(transition.id);
      started.set(transition.id, event);
      continue;
    }

    const original = started.get(transition.id);
    if (!original || !original.transition) {
      throw new CatalogAuditContractError("A transition outcome has no matching start event.");
    }
    if (
      original.trendId !== event.trendId ||
      original.manifestId !== event.manifestId ||
      original.manifestSha256 !== event.manifestSha256 ||
      original.contentSha256 !== event.contentSha256 ||
      effectiveFingerprintVersion(original) !== effectiveFingerprintVersion(event) ||
      original.transition.from !== transition.from ||
      original.transition.to !== transition.to
    ) {
      throw new CatalogAuditContractError("A transition outcome does not match its start event context.");
    }
    started.delete(transition.id);
  }

  if (started.size > 0) {
    throw new CatalogAuditContractError("An earlier lifecycle transition has no audit outcome; manual reconciliation is required.");
  }
}

/**
 * Test/development-only composition boundary. It writes only to an explicitly
 * configured temp-directory JSONL ledger and never changes Trend lifecycle state.
 * Do not import this class from application runtime modules.
 */
export class CatalogLifecycleV2Harness {
  private readonly ledgerPath: string;
  private readonly clock: () => Date;
  private readonly newId: () => string;
  private appendQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: HarnessOptions) {
    this.ledgerPath = assertTemporaryPath(options.ledgerPath);
    this.clock = options.clock ?? (() => new Date());
    this.newId = options.newId ?? randomUUID;
  }

  async readVerifiedLedger(): Promise<readonly VersionedCatalogAuditEvent[]> {
    let contents: string;
    try {
      contents = await readFile(this.ledgerPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    if (!contents) return [];
    const lines = contents.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    const records = lines.map((line) => JSON.parse(line) as unknown);
    return verifyVersionedCatalogAuditLedger(records);
  }

  async appendSyntheticEvent<T extends VersionedCatalogAuditEvent>(factory: AuditEventFactory): Promise<T> {
    const priorAppend = this.appendQueue;
    let release!: () => void;
    this.appendQueue = new Promise<void>((resolve) => { release = resolve; });
    await priorAppend;
    try {
      return await this.appendUnderFileLock<T>(factory);
    } finally {
      release();
    }
  }

  private async appendUnderFileLock<T extends VersionedCatalogAuditEvent>(factory: AuditEventFactory): Promise<T> {
    const directory = path.dirname(this.ledgerPath);
    await mkdir(directory, { recursive: true, mode: 0o700 });

    let lock;
    try {
      lock = await open(`${this.ledgerPath}.lock`, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new CatalogAuditContractError("The temporary audit ledger is locked or has a stale lock; inspect before retrying.");
      }
      throw error;
    }

    try {
      const prior = await this.readVerifiedLedger();
      const event = await factory(prior);
      const verified = verifyVersionedCatalogAuditLedger([...prior, event]);
      const file = await open(this.ledgerPath, "a", 0o600);
      try {
        await file.writeFile(`${JSON.stringify(event)}\n`, "utf8");
        await file.sync();
      } finally {
        await file.close();
      }
      return verified.at(-1)! as T;
    } finally {
      await lock.close();
      await unlink(`${this.ledgerPath}.lock`).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }

  async recordFactualReview(input: CatalogV2DecisionInput): Promise<CatalogAuditEventV2> {
    return this.appendSyntheticEvent(async (prior) => {
      assertCatalogV2LedgerReconciled(prior);
      const current = await this.loadV2Snapshot(input.trendId);
      const fingerprint = this.fingerprint(current);
      const event = this.createDecisionEvent(prior, input, "FACTUAL_REVIEW", {
        actorRole: "FACTUAL_REVIEWER",
        fingerprint,
        evidenceLimitations: [...input.evidenceLimitations],
        factualReviewReference: null,
      });
      const immediatelyBeforeAppend = this.fingerprint(await this.loadV2Snapshot(input.trendId));
      if (immediatelyBeforeAppend.contentSha256 !== fingerprint.contentSha256) {
        throw new CatalogAuditContractError("Trend snapshot changed while the factual review event was being prepared.");
      }
      return event;
    });
  }

  async recordPublicationApproval(input: CatalogV2PublicationApprovalInput): Promise<CatalogAuditEventV2> {
    return this.appendSyntheticEvent(async (prior) => {
      assertCatalogV2LedgerReconciled(prior);
      const verifiedPrior = verifyVersionedCatalogAuditLedger(prior);
      const latestReview = [...verifiedPrior].reverse().find((event) =>
        event.action === "FACTUAL_REVIEW" &&
        event.manifestId === input.manifestId &&
        event.manifestSha256 === input.manifestSha256 &&
        event.trendId === input.trendId,
      );
      if (
        !latestReview ||
        latestReview.schemaVersion !== 2 ||
        latestReview.fingerprintVersion !== 2 ||
        latestReview.id !== input.factualReviewEventId ||
        latestReview.decision !== "APPROVED"
      ) {
        throw new CatalogAuditContractError("A current approved v2 factual review is required before publication approval.");
      }

      const current = await this.loadV2Snapshot(input.trendId);
      const fingerprint = this.fingerprint(current);
      this.assertReviewMatchesCurrentSnapshot(latestReview, input, fingerprint.contentSha256);
      const event = this.createDecisionEvent(prior, input, "PUBLICATION_APPROVAL", {
        actorRole: "PRODUCT_DATA_OWNER",
        fingerprint,
        evidenceLimitations: [...latestReview.evidenceLimitations],
        factualReviewReference: { eventId: latestReview.id, eventHash: latestReview.hash },
      });
      const immediatelyBeforeAppend = this.fingerprint(await this.loadV2Snapshot(input.trendId));
      if (immediatelyBeforeAppend.contentSha256 !== fingerprint.contentSha256) {
        throw new CatalogAuditContractError("Trend snapshot changed while the publication approval event was being prepared.");
      }
      return event;
    });
  }

  async assertCurrentSnapshotApproved(input: Pick<CatalogV2DecisionInput, "manifestId" | "manifestSha256" | "trendId">): Promise<string> {
    const events = await this.readVerifiedLedger();
    assertCatalogV2LedgerReconciled(events);
    const latestReview = [...events].reverse().find((event) =>
      event.action === "FACTUAL_REVIEW" &&
      event.manifestId === input.manifestId &&
      event.manifestSha256 === input.manifestSha256 &&
      event.trendId === input.trendId,
    );
    const latestApproval = [...events].reverse().find((event) =>
      event.action === "PUBLICATION_APPROVAL" &&
      event.manifestId === input.manifestId &&
      event.manifestSha256 === input.manifestSha256 &&
      event.trendId === input.trendId,
    );
    if (
      !latestReview || latestReview.schemaVersion !== 2 || latestReview.fingerprintVersion !== 2 || latestReview.decision !== "APPROVED" ||
      !latestApproval || latestApproval.schemaVersion !== 2 || latestApproval.fingerprintVersion !== 2 || latestApproval.decision !== "APPROVED" ||
      latestApproval.factualReviewReference?.eventId !== latestReview.id ||
      latestApproval.factualReviewReference.eventHash !== latestReview.hash
    ) {
      throw new CatalogAuditContractError("The latest review and publication approval do not form a valid v2 approval pair.");
    }

    const current = this.fingerprint(await this.loadV2Snapshot(input.trendId));
    this.assertReviewMatchesCurrentSnapshot(latestReview, input, current.contentSha256);
    this.assertReviewMatchesCurrentSnapshot(latestApproval, input, current.contentSha256);
    return current.contentSha256;
  }

  private async loadV2Snapshot(trendId: string): Promise<CatalogFingerprintV2Snapshot> {
    const loaded = await loadVersionedCatalogLifecycleSnapshot(this.options.sequelize, trendId, 2);
    if (!loaded || loaded.fingerprintVersion !== 2) {
      throw new CatalogAuditContractError("A validated fingerprint v2 Trend snapshot is unavailable.");
    }
    return loaded.snapshot;
  }

  private fingerprint(snapshot: CatalogFingerprintV2Snapshot) {
    return fingerprintCatalogContentVersioned({ fingerprintVersion: 2, snapshot });
  }

  private createDecisionEvent(
    prior: readonly VersionedCatalogAuditEvent[],
    input: CatalogV2DecisionInput,
    action: "FACTUAL_REVIEW" | "PUBLICATION_APPROVAL",
    options: {
      readonly actorRole: "FACTUAL_REVIEWER" | "PRODUCT_DATA_OWNER";
      readonly fingerprint: ReturnType<CatalogLifecycleV2Harness["fingerprint"]>;
      readonly evidenceLimitations: readonly string[];
      readonly factualReviewReference: CatalogAuditEventV2["factualReviewReference"];
    },
  ): CatalogAuditEventV2 {
    const { actorOsAccount, decision, rationale, ...context } = input;
    const payload = {
      schemaVersion: 2 as const,
      sequence: prior.length + 1,
      id: this.newId(),
      recordedAt: this.clock().toISOString(),
      action,
      manifestId: context.manifestId,
      manifestSha256: context.manifestSha256,
      trendId: context.trendId,
      fingerprintVersion: 2 as const,
      contentSha256: options.fingerprint.contentSha256,
      actor: {
        osAccount: actorOsAccount,
        role: options.actorRole,
        identityAssurance: "LOCAL_OS_ACCOUNT_WITH_SELF_ATTESTED_ROLE" as const,
      },
      decision,
      rationale,
      evidenceLimitations: [...options.evidenceLimitations],
      transition: null,
      factualReviewReference: options.factualReviewReference,
      previousHash: prior.at(-1)?.hash ?? null,
    };
    return {
      ...payload,
      hash: hashVersionedCatalogAuditEventPayload(payload),
    };
  }

  private assertReviewMatchesCurrentSnapshot(
    event: VersionedCatalogAuditEvent,
    input: Pick<CatalogV2DecisionInput, "manifestId" | "manifestSha256" | "trendId">,
    contentSha256: string,
  ): void {
    if (
      event.schemaVersion !== 2 ||
      event.fingerprintVersion !== 2 ||
      event.manifestId !== input.manifestId ||
      event.manifestSha256 !== input.manifestSha256 ||
      event.trendId !== input.trendId ||
      event.contentSha256 !== contentSha256
    ) {
      throw new CatalogAuditContractError("The v2 audit decision is stale or does not match the current Trend snapshot.");
    }
  }
}
