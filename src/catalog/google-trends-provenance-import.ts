import { canonicalJson } from "../lib/canonical-json";
import type { TrendEvidenceProvenanceInput } from "../trend/trend-evidence-provenance.schema";
import {
  genericTrendManifestPreparationSchema,
  type GenericTrendManifestPreparationInput,
} from "./generic-trend-manifest";
import { mapGoogleTrendsManifestToProvenanceDryRun } from "./google-trends-provenance-dry-run";
export { SequelizeGoogleTrendsProvenanceImportRepository } from "./google-trends-provenance-import-repository";

export type GoogleTrendsProvenanceImportRecord = Readonly<{
  id: string;
  title: string;
  categoryCode: string;
  subjectAreaCode: string | null;
  signalSummary: string;
  signalDescription: string;
  direction: "RISING" | "STABLE" | "DECLINING" | null;
  periodStart: string | null;
  periodEnd: string | null;
  businessRelevanceExplanation: string | null;
  affectedUserTypes: readonly string[];
  evidence: readonly Readonly<{
    id: string;
    sourceName: string;
    sourceReference: string;
    supportingDetail: string;
    limitations: string;
    provenance: TrendEvidenceProvenanceInput;
  }>[];
}>;

export type PreparedGoogleTrendsProvenanceImport = Readonly<{
  manifestId: string;
  records: readonly GoogleTrendsProvenanceImportRecord[];
}>;

export type GoogleTrendsProvenanceImportPlan = Readonly<{
  action: "CREATE" | "NO_OP";
  trendCount: number;
  evidenceCount: number;
  provenanceCount: number;
  databaseWrites: number;
}>;

export type GoogleTrendsProvenanceImportSnapshot = Readonly<{
  categories: readonly Readonly<{ id: string; code: string; isActive: boolean }>[];
  trends: readonly Readonly<{
    id: string;
    title: string;
    categoryCode: string;
    subjectAreaId: string | null;
    signalSummary: string;
    signalDescription: string;
    direction: string | null;
    periodStart: string | null;
    periodEnd: string | null;
    businessRelevanceExplanation: string | null;
    affectedUserTypes: readonly string[];
    lifecycleState: string;
    archivedReason: string | null;
  }>[];
  evidences: readonly Readonly<{
    id: string;
    trendId: string;
    sourceName: string;
    sourceReference: string;
    supportingDetail: string;
    sourceDate: Date | string | null;
    limitations: string | null;
  }>[];
  provenances: readonly TrendEvidenceProvenanceInput[];
}>;

export class GoogleTrendsProvenanceImportError extends Error {
  override readonly name = "GoogleTrendsProvenanceImportError";

  constructor(
    readonly code:
      | "INVALID_MANIFEST"
      | "UNSUPPORTED_SOURCE"
      | "TARGET_REJECTED"
      | "IDENTITY_MISMATCH"
      | "CATALOG_CONFLICT"
      | "PARTIAL_IMPORT"
      | "CONCURRENT_CONFLICT"
      | "PERSISTENCE_FAILED",
    message: string,
  ) {
    super(message);
  }
}

export function prepareGoogleTrendsProvenanceImport(
  input: unknown,
): PreparedGoogleTrendsProvenanceImport {
  const parsed = genericTrendManifestPreparationSchema.safeParse(input);
  if (!parsed.success) {
    throw new GoogleTrendsProvenanceImportError(
      "INVALID_MANIFEST",
      "Google Trends provenance manifest failed strict validation.",
    );
  }
  if (parsed.data.evidenceMode !== "EXTERNAL_SOURCE_CLAIM") {
    throw new GoogleTrendsProvenanceImportError(
      "UNSUPPORTED_SOURCE",
      "Synthetic fixtures cannot enter the external-source import adapter.",
    );
  }

  const mapped = mapGoogleTrendsManifestToProvenanceDryRun(parsed.data);
  if (mapped.status !== "MAPPED") {
    throw new GoogleTrendsProvenanceImportError(
      "UNSUPPORTED_SOURCE",
      "Manifest does not match the supported Google Trends and Bright Data provenance contract.",
    );
  }

  const evidenceById = new Map(mapped.records.map((record) => [record.evidenceId, record]));
  const records = parsed.data.trends.map((trend): GoogleTrendsProvenanceImportRecord => ({
    id: trend.id,
    title: trend.title,
    categoryCode: trend.categoryCode,
    subjectAreaCode: trend.subjectAreaCode,
    signalSummary: trend.signal.summary,
    signalDescription: trend.signal.description,
    direction: trend.signal.direction,
    periodStart: trend.signal.observationPeriod.start,
    periodEnd: trend.signal.observationPeriod.end,
    businessRelevanceExplanation: trend.businessRelevanceExplanation,
    affectedUserTypes: trend.affectedUserTypes,
    evidence: trend.evidence.map((evidence) => {
      const mappedEvidence = evidenceById.get(evidence.id);
      if (!mappedEvidence) {
        throw new GoogleTrendsProvenanceImportError(
          "UNSUPPORTED_SOURCE",
          "Every imported Trend Evidence record requires supported Google Trends provenance.",
        );
      }
      const unavailableTrendFields = trend.signal.unavailableFields.map(
        (field) => `- Trend field ${field} is unavailable.`,
      );
      return {
        id: evidence.id,
        sourceName: evidence.sourceName,
        sourceReference: evidence.sourceReference,
        supportingDetail: evidence.supportingDetail,
        limitations: [
          mappedEvidence.evidenceRecordPreview.limitationsText,
          ...unavailableTrendFields,
          "- Source date is unavailable for Google Trends Trending Now; retrieval time is recorded separately.",
        ].filter(Boolean).join("\n"),
        provenance: mappedEvidence.provenanceRecordPreview,
      };
    }),
  }));

  return { manifestId: parsed.data.manifestId, records };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameTrend(
  actual: GoogleTrendsProvenanceImportSnapshot["trends"][number],
  expected: GoogleTrendsProvenanceImportRecord,
  expectedSubjectAreaId: string | null,
): boolean {
  return actual.id === expected.id &&
    actual.title === expected.title &&
    actual.categoryCode === expected.categoryCode &&
    actual.subjectAreaId === expectedSubjectAreaId &&
    actual.signalSummary === expected.signalSummary &&
    actual.signalDescription === expected.signalDescription &&
    actual.direction === expected.direction &&
    actual.periodStart === expected.periodStart &&
    actual.periodEnd === expected.periodEnd &&
    actual.businessRelevanceExplanation === expected.businessRelevanceExplanation &&
    sameStrings(actual.affectedUserTypes, expected.affectedUserTypes) &&
    actual.lifecycleState === "DRAFT" &&
    actual.archivedReason === null;
}

function sameEvidence(
  actual: GoogleTrendsProvenanceImportSnapshot["evidences"][number],
  expected: GoogleTrendsProvenanceImportRecord["evidence"][number],
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

function sameProvenance(
  actual: TrendEvidenceProvenanceInput,
  expected: TrendEvidenceProvenanceInput,
): boolean {
  return canonicalJson({ ...actual, retrievedAt: actual.retrievedAt?.toISOString() ?? null }) ===
    canonicalJson({ ...expected, retrievedAt: expected.retrievedAt?.toISOString() ?? null });
}

export function planGoogleTrendsProvenanceImport(
  prepared: PreparedGoogleTrendsProvenanceImport,
  snapshot: GoogleTrendsProvenanceImportSnapshot,
): GoogleTrendsProvenanceImportPlan {
  const expectedTrendIds = new Set(prepared.records.map(({ id }) => id));
  const expectedTitles = new Set(prepared.records.map(({ title }) => title));
  const evidence = prepared.records.flatMap((trend) => trend.evidence.map((item) => ({ trendId: trend.id, item })));
  const expectedEvidenceIds = new Set(evidence.map(({ item }) => item.id));

  if (new Set(expectedTitles).size !== prepared.records.length) {
    throw new GoogleTrendsProvenanceImportError("INVALID_MANIFEST", "Manifest contains duplicate Trend titles.");
  }
  if (snapshot.trends.some((trend) => expectedTitles.has(trend.title) && !expectedTrendIds.has(trend.id))) {
    throw new GoogleTrendsProvenanceImportError("CATALOG_CONFLICT", "A Trend title already exists under a different identifier.");
  }
  if (snapshot.evidences.some((item) => expectedTrendIds.has(item.trendId) && !expectedEvidenceIds.has(item.id))) {
    throw new GoogleTrendsProvenanceImportError("CATALOG_CONFLICT", "An imported Trend already has Evidence outside this manifest.");
  }

  const categories = new Map(snapshot.categories.map((category) => [category.code, category]));
  const expectedTrends = new Map<string, GoogleTrendsProvenanceImportRecord>();
  for (const trend of prepared.records) {
    expectedTrends.set(trend.id, trend);
    if (trend.subjectAreaCode !== null && !categories.get(trend.subjectAreaCode)?.isActive) {
      throw new GoogleTrendsProvenanceImportError("CATALOG_CONFLICT", "A required active F&B category is unavailable.");
    }
  }

  const actualTrends = new Map(snapshot.trends.map((trend) => [trend.id, trend]));
  const actualEvidence = new Map(snapshot.evidences.map((item) => [item.id, item]));
  const actualProvenance = new Map(snapshot.provenances.map((item) => [item.trendEvidenceId, item]));
  let existingCount = 0;
  let expectedCount = prepared.records.length + evidence.length * 2;

  for (const trend of prepared.records) {
    const actual = actualTrends.get(trend.id);
    if (!actual) continue;
    existingCount += 1;
    const subjectAreaId = trend.subjectAreaCode === null ? null : categories.get(trend.subjectAreaCode)?.id ?? null;
    if (!sameTrend(actual, trend, subjectAreaId)) {
      throw new GoogleTrendsProvenanceImportError("CATALOG_CONFLICT", "An existing Trend conflicts with the manifest content or is not DRAFT.");
    }
  }

  for (const { trendId, item } of evidence) {
    const actual = actualEvidence.get(item.id);
    if (!actual) continue;
    existingCount += 1;
    if (!sameEvidence(actual, item, trendId)) {
      throw new GoogleTrendsProvenanceImportError("CATALOG_CONFLICT", "An existing Trend Evidence record conflicts with the manifest.");
    }
  }

  for (const { item } of evidence) {
    const actual = actualProvenance.get(item.id);
    if (!actual) continue;
    existingCount += 1;
    if (!sameProvenance(actual, item.provenance)) {
      throw new GoogleTrendsProvenanceImportError("CATALOG_CONFLICT", "Existing provenance conflicts with the manifest.");
    }
  }

  if (existingCount === 0) {
    return {
      action: "CREATE",
      trendCount: prepared.records.length,
      evidenceCount: evidence.length,
      provenanceCount: evidence.length,
      databaseWrites: expectedCount,
    };
  }
  if (existingCount !== expectedCount) {
    throw new GoogleTrendsProvenanceImportError("PARTIAL_IMPORT", "A partial prior import was found; no records were changed.");
  }
  return {
    action: "NO_OP",
    trendCount: prepared.records.length,
    evidenceCount: evidence.length,
    provenanceCount: evidence.length,
    databaseWrites: 0,
  };
}

export type DisposableImportTarget = Readonly<{
  host: string;
  port: number;
  database: string;
  user: string;
}>;

export function assertDisposableGoogleTrendsImportTarget(
  databaseUrl: string,
  nodeEnv?: string,
): DisposableImportTarget {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new GoogleTrendsProvenanceImportError("TARGET_REJECTED", "Disposable PostgreSQL target is missing or invalid.");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new GoogleTrendsProvenanceImportError("TARGET_REJECTED", "Import requires a disposable PostgreSQL target.");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(parsed.username);
  const match = database.match(/^venturex_catalog_import_test_([a-f0-9]{8})$/u);
  const expectedUser = match ? `venturex_catalog_test_${match[1]}` : "";
  if (
    nodeEnv?.toLowerCase() === "production" ||
    parsed.hostname !== "127.0.0.1" ||
    !parsed.port ||
    Number(parsed.port) === 5432 ||
    database.toLowerCase() === "venturex_dev" ||
    !match ||
    user !== expectedUser ||
    parsed.password.length === 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new GoogleTrendsProvenanceImportError("TARGET_REJECTED", "Import target is not the approved disposable PostgreSQL shape.");
  }
  return { host: parsed.hostname, port: Number(parsed.port), database, user };
}


export type GenericTrendManifestForImport = GenericTrendManifestPreparationInput;
