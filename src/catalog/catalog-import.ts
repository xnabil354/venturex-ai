import type { CuratedCatalogManifest } from "./catalog-manifest";

export const LOCAL_CATALOG_TARGET = {
  database: "venturex_dev",
  user: "venturex",
  port: 5432,
  hosts: ["localhost", "127.0.0.1", "::1"],
} as const;

export type CatalogDatabaseTarget = {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly nodeEnv?: string;
};

export type CatalogCategorySnapshot = {
  readonly id: string;
  readonly code: string;
  readonly isActive: boolean;
};

export type CatalogTrendSnapshot = {
  readonly id: string;
  readonly title: string;
  readonly categoryCode: string;
  readonly subjectAreaId: string | null;
  readonly signalSummary: string;
  readonly signalDescription: string;
  readonly direction: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly businessRelevanceExplanation: string | null;
  readonly affectedUserTypes: readonly string[];
  readonly lifecycleState: string;
  readonly archivedReason: string | null;
};

export type CatalogEvidenceSnapshot = {
  readonly id: string;
  readonly trendId: string;
  readonly sourceName: string;
  readonly sourceReference: string;
  readonly supportingDetail: string;
  readonly sourceDate: Date | string | null;
  readonly limitations: string | null;
};

export type CatalogOpportunitySnapshot = {
  readonly id: string;
  readonly relatedTrendId: string;
  readonly fnbCategoryId: string;
  readonly name: string;
  readonly description: string;
  readonly opportunityType: string;
  readonly targetConsumerSummary: string | null;
  readonly competitionLevel: string | null;
  readonly competitionSummary: string | null;
  readonly executionFeasibility: string | number | null;
  readonly marketSustainability: string | number | null;
  readonly additionalAttributes: Record<string, unknown>;
};

export type CatalogSnapshot = {
  readonly categories: readonly CatalogCategorySnapshot[];
  readonly trends: readonly CatalogTrendSnapshot[];
  readonly evidences: readonly CatalogEvidenceSnapshot[];
  readonly opportunities: readonly CatalogOpportunitySnapshot[];
};

export type CatalogImportPlan = {
  readonly action: "CREATE" | "NO_OP";
  readonly trendCount: number;
  readonly evidenceCount: number;
  readonly opportunityCount: number;
  readonly databaseWrites: number;
};

export class CatalogImportError extends Error {
  override readonly name = "CatalogImportError";
}

export function targetFromDatabaseUrl(databaseUrl: string, nodeEnv?: string): CatalogDatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new CatalogImportError("Database target is not a valid URL.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new CatalogImportError("Catalog import requires a PostgreSQL target.");
  }

  return {
    host: parsed.hostname.toLowerCase().replace(/^\[|\]$/g, ""),
    port: parsed.port ? Number(parsed.port) : 5432,
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    user: decodeURIComponent(parsed.username),
    ...(nodeEnv ? { nodeEnv } : {}),
  };
}

export function assertSafeCatalogTarget(target: CatalogDatabaseTarget): void {
  if (target.nodeEnv?.toLowerCase() === "production") {
    throw new CatalogImportError("Catalog import is disabled when NODE_ENV is production.");
  }
  if (
    !LOCAL_CATALOG_TARGET.hosts.includes(target.host as (typeof LOCAL_CATALOG_TARGET.hosts)[number]) ||
    target.port !== LOCAL_CATALOG_TARGET.port ||
    target.database !== LOCAL_CATALOG_TARGET.database ||
    target.user !== LOCAL_CATALOG_TARGET.user
  ) {
    throw new CatalogImportError("Database target rejected; only the approved local development database is allowed.");
  }
}

export function assertDatabaseIdentity(
  target: CatalogDatabaseTarget,
  identity: { readonly database: string; readonly user: string },
): void {
  assertSafeCatalogTarget(target);
  if (identity.database !== target.database || identity.user !== target.user) {
    throw new CatalogImportError("Connected PostgreSQL identity does not match the approved local target.");
  }
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function mapById<T extends { readonly id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function isSameTrend(
  actual: CatalogTrendSnapshot,
  expected: CuratedCatalogManifest["trends"][number],
  expectedSubjectAreaId: string,
): boolean {
  return actual.id === expected.id &&
    actual.title === expected.title &&
    actual.categoryCode === expected.categoryCode &&
    actual.subjectAreaId === expectedSubjectAreaId &&
    actual.signalSummary === expected.signal.summary &&
    actual.signalDescription === expected.signal.description &&
    actual.direction === expected.signal.direction &&
    actual.periodStart === expected.signal.periodStart &&
    actual.periodEnd === expected.signal.periodEnd &&
    actual.businessRelevanceExplanation === expected.businessRelevanceExplanation &&
    sameArray(actual.affectedUserTypes, expected.affectedUserTypes) &&
    actual.lifecycleState === "DRAFT" &&
    actual.archivedReason === null;
}

function isSameEvidence(
  actual: CatalogEvidenceSnapshot,
  expected: CuratedCatalogManifest["trends"][number]["evidence"][number],
  trendId: string,
): boolean {
  return actual.id === expected.id &&
    actual.trendId === trendId &&
    actual.sourceName === expected.sourceName &&
    actual.sourceReference === expected.sourceReference &&
    actual.supportingDetail === expected.supportingDetail &&
    actual.sourceDate === null &&
    actual.limitations === expected.limitations;
}

function isSameOpportunity(
  actual: CatalogOpportunitySnapshot,
  expected: CuratedCatalogManifest["opportunities"][number],
  expectedCategoryId: string,
): boolean {
  return actual.id === expected.id &&
    actual.relatedTrendId === expected.relatedTrendId &&
    actual.fnbCategoryId === expectedCategoryId &&
    actual.name === expected.name &&
    actual.description === expected.description &&
    actual.opportunityType === expected.opportunityType &&
    actual.targetConsumerSummary === null &&
    actual.competitionLevel === null &&
    actual.competitionSummary === null &&
    actual.executionFeasibility === null &&
    actual.marketSustainability === null &&
    Object.keys(actual.additionalAttributes ?? {}).length === 0;
}

export function planCatalogImport(
  manifest: CuratedCatalogManifest,
  snapshot: CatalogSnapshot,
): CatalogImportPlan {
  const categoryByCode = new Map(snapshot.categories.map((category) => [category.code, category]));
  const requiredCodes = new Set([
    ...manifest.trends.map(({ subjectAreaCode }) => subjectAreaCode),
    ...manifest.opportunities.map(({ fnbCategoryCode }) => fnbCategoryCode),
  ]);
  const categoryByRequiredCode = new Map<string, CatalogCategorySnapshot>();
  for (const code of requiredCodes) {
    const category = categoryByCode.get(code);
    if (!category?.isActive) {
      throw new CatalogImportError(`Required active F&B category is unavailable: ${code}.`);
    }
    categoryByRequiredCode.set(code, category);
  }

  const expectedTrendIds = new Set(manifest.trends.map(({ id }) => id));
  const expectedEvidence = manifest.trends.flatMap((trend) =>
    trend.evidence.map((evidence) => ({ evidence, trendId: trend.id })),
  );
  const expectedEvidenceIds = new Set(expectedEvidence.map(({ evidence }) => evidence.id));
  const expectedEvidenceRefs = new Set(expectedEvidence.map(({ evidence }) => evidence.sourceReference));
  const expectedOpportunityIds = new Set(manifest.opportunities.map(({ id }) => id));
  const trendById = mapById(snapshot.trends);
  const evidenceById = mapById(snapshot.evidences);
  const opportunityById = mapById(snapshot.opportunities);

  const expectedTitles = new Set(manifest.trends.map(({ title }) => title));
  if (snapshot.trends.some((trend) => expectedTitles.has(trend.title) && !expectedTrendIds.has(trend.id))) {
    throw new CatalogImportError("A Trend with a manifest title already exists under a different identifier.");
  }
  if (snapshot.evidences.some((evidence) =>
    expectedEvidenceRefs.has(evidence.sourceReference) && !expectedEvidenceIds.has(evidence.id),
  )) {
    throw new CatalogImportError("A source reference already exists outside the manifest record identifiers.");
  }
  const expectedOpportunityKeys = new Set(manifest.opportunities.map(({ relatedTrendId, name }) => `${relatedTrendId}\u0000${name}`));
  if (snapshot.opportunities.some((opportunity) =>
    expectedOpportunityKeys.has(`${opportunity.relatedTrendId}\u0000${opportunity.name}`) &&
    !expectedOpportunityIds.has(opportunity.id),
  )) {
    throw new CatalogImportError("An Opportunity with a manifest Trend and name already exists under a different identifier.");
  }

  for (const trend of manifest.trends) {
    const existing = trendById.get(trend.id);
    if (existing && !isSameTrend(existing, trend, categoryByRequiredCode.get(trend.subjectAreaCode)!.id)) {
      throw new CatalogImportError(`Trend identifier conflicts with existing content: ${trend.id}.`);
    }
  }
  for (const { evidence, trendId } of expectedEvidence) {
    const existing = evidenceById.get(evidence.id);
    if (existing && !isSameEvidence(existing, evidence, trendId)) {
      throw new CatalogImportError(`Evidence identifier conflicts with existing content: ${evidence.id}.`);
    }
  }
  for (const opportunity of manifest.opportunities) {
    const existing = opportunityById.get(opportunity.id);
    if (existing && !isSameOpportunity(
      existing,
      opportunity,
      categoryByRequiredCode.get(opportunity.fnbCategoryCode)!.id,
    )) {
      throw new CatalogImportError(`Opportunity identifier conflicts with existing content: ${opportunity.id}.`);
    }
  }

  const existingCount = manifest.trends.filter(({ id }) => trendById.has(id)).length +
    expectedEvidence.filter(({ evidence }) => evidenceById.has(evidence.id)).length +
    manifest.opportunities.filter(({ id }) => opportunityById.has(id)).length;
  const expectedCount = manifest.trends.length + expectedEvidence.length + manifest.opportunities.length;
  if (existingCount !== 0 && existingCount !== expectedCount) {
    throw new CatalogImportError("Catalog contains a partial import; refusing to update or complete it automatically.");
  }

  return {
    action: existingCount === expectedCount ? "NO_OP" : "CREATE",
    trendCount: manifest.trends.length,
    evidenceCount: expectedEvidence.length,
    opportunityCount: manifest.opportunities.length,
    databaseWrites: existingCount === expectedCount ? 0 : expectedCount,
  };
}

export function assertApplyConfirmation(
  apply: boolean,
  confirmation: { readonly database?: string; readonly user?: string },
): void {
  if (!apply) return;
  if (
    confirmation.database !== LOCAL_CATALOG_TARGET.database ||
    confirmation.user !== LOCAL_CATALOG_TARGET.user
  ) {
    throw new CatalogImportError("Apply requires exact --confirm-db and --confirm-user values for the approved local target.");
  }
}
