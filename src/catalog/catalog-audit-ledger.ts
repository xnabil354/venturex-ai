import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { canonicalJson } from "../lib/canonical-json";
import {
  CatalogLifecycleError,
  catalogLifecycleAuditEventSchema,
  type CatalogLifecycleAuditEvent,
} from "./catalog-lifecycle-contract";

export interface CatalogAuditPathEnvironment {
  [key: string]: string | undefined;
  USERPROFILE?: string;
  VENTUREX_CATALOG_AUDIT_PATH?: string;
  LOCALAPPDATA?: string;
}

function auditHash(eventWithoutHash: Omit<CatalogLifecycleAuditEvent, "hash">): string {
  return createHash("sha256").update(canonicalJson(eventWithoutHash), "utf8").digest("hex").toUpperCase();
}

function ledgerPathFromEnvironment(env: CatalogAuditPathEnvironment = process.env): string {
  const userProfile = env.USERPROFILE?.trim();
  if (!userProfile || !path.isAbsolute(userProfile)) {
    throw new CatalogLifecycleError("An absolute USERPROFILE is required for the private local catalog audit ledger.");
  }
  const expectedPath = path.resolve(userProfile, "VENTUREX-private-audit", "catalog-lifecycle-audit.jsonl");
  const configuredPath = env.VENTUREX_CATALOG_AUDIT_PATH?.trim();
  if (configuredPath) {
    if (!path.isAbsolute(configuredPath)) {
      throw new CatalogLifecycleError("VENTUREX_CATALOG_AUDIT_PATH must be an absolute path to the private catalog audit ledger.");
    }
    const normalizeForComparison = (value: string) => {
      const resolved = path.resolve(value);
      return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
    };
    if (normalizeForComparison(configuredPath) !== normalizeForComparison(expectedPath)) {
      throw new CatalogLifecycleError("VENTUREX_CATALOG_AUDIT_PATH must match the private per-user catalog audit location.");
    }
  }
  return expectedPath;
}

export class JsonlCatalogAuditLedger {
  constructor(
    readonly filePath: string = ledgerPathFromEnvironment(),
    private readonly clock: () => Date = () => new Date(),
    private readonly newId: () => string = randomUUID,
  ) {}

  async readVerified(): Promise<readonly CatalogLifecycleAuditEvent[]> {
    let content: string;
    try {
      content = await readFile(this.filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    if (content.length > 8_000_000) throw new CatalogLifecycleError("Audit ledger exceeds the supported size; manual review is required.");
    if (content !== "" && !content.endsWith("\n")) throw new CatalogLifecycleError("Audit ledger has an incomplete final record.");
    const lines = content.split("\n").filter((line) => line.length > 0);
    const events: CatalogLifecycleAuditEvent[] = [];
    let previousHash: string | null = null;
    for (let index = 0; index < lines.length; index += 1) {
      let parsed: unknown;
      try { parsed = JSON.parse(lines[index]!); } catch {
        throw new CatalogLifecycleError(`Audit ledger record ${index + 1} is not valid JSON.`);
      }
      const result = catalogLifecycleAuditEventSchema.safeParse(parsed);
      if (!result.success) throw new CatalogLifecycleError(`Audit ledger record ${index + 1} does not match the supported schema.`);
      const event = result.data;
      const { hash, ...withoutHash } = event;
      if (event.sequence !== index + 1 || event.previousHash !== previousHash || auditHash(withoutHash) !== hash) {
        throw new CatalogLifecycleError(`Audit ledger hash chain failed at record ${index + 1}.`);
      }
      events.push(event);
      previousHash = hash;
    }
    return events;
  }

  async append(input: Omit<CatalogLifecycleAuditEvent, "schemaVersion" | "sequence" | "id" | "recordedAt" | "previousHash" | "hash">): Promise<CatalogLifecycleAuditEvent> {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const lockPath = `${this.filePath}.lock`;
    let lock;
    try { lock = await open(lockPath, "wx", 0o600); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new CatalogLifecycleError("Audit ledger is locked or has a stale lock; inspect before retrying.");
      }
      throw error;
    }
    try {
      await lock.writeFile(`${this.newId()}\n`, "utf8");
      const existing = await this.readVerified();
      const withoutHash = {
        schemaVersion: 1 as const,
        sequence: existing.length + 1,
        id: this.newId(),
        recordedAt: this.clock().toISOString(),
        ...input,
        previousHash: existing.at(-1)?.hash ?? null,
      };
      const event = catalogLifecycleAuditEventSchema.parse({ ...withoutHash, hash: auditHash(withoutHash) });
      const output = await open(this.filePath, "a", 0o600);
      try {
        await output.writeFile(`${JSON.stringify(event)}\n`, "utf8");
        await output.sync();
      } finally { await output.close(); }
      return event;
    } finally {
      await lock.close();
      await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
}

export function defaultCatalogAuditPath(env: CatalogAuditPathEnvironment = process.env): string {
  return ledgerPathFromEnvironment(env);
}
