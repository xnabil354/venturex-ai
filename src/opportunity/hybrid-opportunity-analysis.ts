import "server-only";

import { z } from "zod";

import type { SafeUser } from "../auth/user-types";
import { materializeOpportunityEvidenceGap } from "./opportunity-evidence-availability";
import {
  opportunityFactCatalogSchema,
  proposedExperimentParameterSchema,
  resolveOpportunityEvidenceGaps,
  resolveOpportunityFactReferences,
  type OpportunityFact,
  type OpportunityFactCatalog,
  type OpportunityFactReference,
  type OpportunityEvidenceGap,
  type ProposedExperimentParameter,
} from "./opportunity-fact-catalog";
import {
  generatedOpportunityHypothesisSchema,
  OPPORTUNITY_HYPOTHESIS_LIMITS,
  opportunityTypeSchema,
  opportunityTypeSchemaForPersona,
  opportunityTypeValuesForPersona,
  type OpportunityPersona,
} from "./private-hypothesis";
import type { OpportunityAnalysisContext } from "./opportunity-analysis-context";
import { containsNumericMention, generatedOpportunityResultSchema, numericMentionValues, removeNumericSentences, type GeneratedOpportunityResult } from "./opportunity-analysis-validation";

export const HYBRID_OPPORTUNITY_ANALYSIS_VERSION = "hybrid-opportunity-analysis-v12" as const;

const text = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);

const factReferenceSchema = z.object({
  catalogId: z.string().regex(/^catalog_[a-f0-9]{24}$/u),
  factId: z.string().regex(/^fact_[a-f0-9]{24}$/u),
}).strict();

const evidenceGapReferenceSchema = z.object({
  catalogId: z.string().regex(/^catalog_[a-f0-9]{24}$/u),
  gapId: z.string().regex(/^(?:gapref_[a-f0-9]{24}|g[1-9]\d*)$/u),
}).strict();

const narrativeSchema = z.object({
  title: text(OPPORTUNITY_HYPOTHESIS_LIMITS.title.min, OPPORTUNITY_HYPOTHESIS_LIMITS.title.max),
  concept: text(OPPORTUNITY_HYPOTHESIS_LIMITS.concept.min, OPPORTUNITY_HYPOTHESIS_LIMITS.concept.max),
  targetCustomer: text(OPPORTUNITY_HYPOTHESIS_LIMITS.targetCustomer.min, OPPORTUNITY_HYPOTHESIS_LIMITS.targetCustomer.max),
}).strict();

const profileFitSchema = z.object({
  explanation: text(8, 240),
  profileFactRefs: z.array(factReferenceSchema).min(1).max(3),
}).strict();

const searchInterpretationSchema = z.object({
  explanation: text(12, 280),
  searchFactRefs: z.array(factReferenceSchema).min(1).max(3),
}).strict();

const experimentSchema = z.object({
  action: text(8, 220),
  parameters: z.array(proposedExperimentParameterSchema).min(1).max(4),
}).strict();

const hybridInsufficientEvidenceSchema = z.object({
  outcome: z.literal("INSUFFICIENT_EVIDENCE"),
  evidenceGapRefs: z.array(evidenceGapReferenceSchema)
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.minItems)
    .max(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.maxItems),
}).strict();

function hybridOpportunityResultSchemaForType<T extends z.ZodTypeAny>(typeSchema: T) {
  const ideaSchema = z.object({
    narrative: narrativeSchema,
    opportunityType: typeSchema,
    profileFit: z.array(profileFitSchema).min(1).max(OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.maxItems),
    evidenceInterpretation: z.array(searchInterpretationSchema).min(1).max(3),
    experiments: z.array(experimentSchema)
      .min(OPPORTUNITY_HYPOTHESIS_LIMITS.validationSteps.minItems)
      .max(OPPORTUNITY_HYPOTHESIS_LIMITS.validationSteps.maxItems),
    assumptions: z.array(text(OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions.itemMin, 300))
      .min(OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions.minItems)
      .max(OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions.maxItems),
    limitations: z.array(text(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMin, 300))
      .min(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.minItems)
      .max(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.maxItems),
    evidenceGapRefs: z.array(evidenceGapReferenceSchema)
      .min(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.minItems)
      .max(OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.maxItems),
  }).strict();

  return z.discriminatedUnion("outcome", [
    z.object({
      outcome: z.literal("HYPOTHESES"),
      ideas: z.array(ideaSchema).min(OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.maxItems),
    }).strict(),
    hybridInsufficientEvidenceSchema,
  ]);
}

export const hybridGeneratedOpportunityResultSchema = hybridOpportunityResultSchemaForType(opportunityTypeSchema);

export function hybridGeneratedOpportunityResultSchemaForPersona(persona: OpportunityPersona) {
  return hybridOpportunityResultSchemaForType(opportunityTypeSchemaForPersona(persona));
}

export type HybridGeneratedOpportunityResult = z.infer<typeof hybridGeneratedOpportunityResultSchema>;
export type HybridGeneratedIdea = Extract<HybridGeneratedOpportunityResult, { outcome: "HYPOTHESES" }>["ideas"][number];

export type HybridOpportunityFailureCode =
  | "SCHEMA_VALIDATION_FAILED"
  | "INVALID_FACT_REFERENCE"
  | "CROSS_CONTEXT_REFERENCE"
  | "DUPLICATE_FACT_REFERENCE"
  | "FACT_REFERENCE_MISMATCH"
  | "STALE_EVIDENCE_REFERENCE"
  | "INVALID_EVIDENCE_GAP_REFERENCE"
  | "UNSUPPORTED_NUMERIC_CLAIM"
  | "INVALID_EXPERIMENT_PARAMETER";

export class HybridOpportunityAnalysisError extends Error {
  override readonly name = "HybridOpportunityAnalysisError";

  constructor(readonly code: HybridOpportunityFailureCode, readonly fields: readonly string[] = []) {
    super("Generated opportunity analysis did not satisfy the typed grounding contract.");
  }
}

export const hybridOpportunityDiagnosticContract = {
  fields: [
    { path: "outcome", typeCategory: "enum", required: true, nullable: false, allowedValues: ["HYPOTHESES", "INSUFFICIENT_EVIDENCE"] },
    { path: "ideas", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: 3 },
    { path: "ideas[]", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].narrative", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].narrative.title", typeCategory: "string", required: true, nullable: false, minLength: 4, maxLength: 140 },
    { path: "ideas[].narrative.concept", typeCategory: "string", required: true, nullable: false, minLength: 20, maxLength: 1200 },
    { path: "ideas[].narrative.targetCustomer", typeCategory: "string", required: true, nullable: false, minLength: 8, maxLength: 500 },
    { path: "ideas[].opportunityType", typeCategory: "enum", required: true, nullable: false, allowedValues: opportunityTypeSchema.options },
    { path: "ideas[].profileFit", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: 5 },
    { path: "ideas[].profileFit[]", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].profileFit[].explanation", typeCategory: "string", required: true, nullable: false, minLength: 8, maxLength: 240 },
    { path: "ideas[].profileFit[].profileFactRefs", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: 3 },
    { path: "ideas[].profileFit[].profileFactRefs[]", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].profileFit[].profileFactRefs[].catalogId", typeCategory: "string", required: true, nullable: false, minLength: 32, maxLength: 32 },
    { path: "ideas[].profileFit[].profileFactRefs[].factId", typeCategory: "string", required: true, nullable: false, minLength: 29, maxLength: 29 },
    { path: "ideas[].evidenceInterpretation", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: 3 },
    { path: "ideas[].evidenceInterpretation[]", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].evidenceInterpretation[].explanation", typeCategory: "string", required: true, nullable: false, minLength: 12, maxLength: 280 },
    { path: "ideas[].evidenceInterpretation[].searchFactRefs", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: 3 },
    { path: "ideas[].evidenceInterpretation[].searchFactRefs[]", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].evidenceInterpretation[].searchFactRefs[].catalogId", typeCategory: "string", required: true, nullable: false, minLength: 32, maxLength: 32 },
    { path: "ideas[].evidenceInterpretation[].searchFactRefs[].factId", typeCategory: "string", required: true, nullable: false, minLength: 29, maxLength: 29 },
    { path: "ideas[].experiments", typeCategory: "array", required: true, nullable: false, minItems: 2, maxItems: 5 },
    { path: "ideas[].experiments[]", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].experiments[].action", typeCategory: "string", required: true, nullable: false, minLength: 8, maxLength: 220 },
    { path: "ideas[].experiments[].parameters", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: 4 },
    { path: "ideas[].experiments[].parameters[]", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].experiments[].parameters[].status", typeCategory: "enum", required: true, nullable: false, allowedValues: ["PROPOSED"] },
    { path: "ideas[].experiments[].parameters[].kind", typeCategory: "enum", required: true, nullable: false, allowedValues: ["SAMPLE_SIZE", "DURATION", "PRODUCT_VARIANT_COUNT", "INTERVIEW_COUNT", "PRICE_TEST"] },
    { path: "ideas[].experiments[].parameters[].value", typeCategory: "number", required: false, nullable: false },
    { path: "ideas[].experiments[].parameters[].min", typeCategory: "number", required: false, nullable: false },
    { path: "ideas[].experiments[].parameters[].max", typeCategory: "number", required: false, nullable: false },
    { path: "ideas[].experiments[].parameters[].unit", typeCategory: "enum", required: true, nullable: false, allowedValues: ["PEOPLE", "DAYS", "VARIANTS", "IDR"] },
    { path: "ideas[].experiments[].parameters[].sourceRef", typeCategory: "enum", required: true, nullable: true, allowedValues: ["null"] },
    { path: "ideas[].assumptions", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: 4 },
    { path: "ideas[].assumptions[]", typeCategory: "string", required: true, nullable: false, minLength: 8, maxLength: 300 },
    { path: "ideas[].limitations", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: 5 },
    { path: "ideas[].limitations[]", typeCategory: "string", required: true, nullable: false, minLength: 8, maxLength: 300 },
    { path: "ideas[].evidenceGapRefs", typeCategory: "array", required: true, nullable: false, minItems: OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.minItems, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.maxItems },
    { path: "ideas[].evidenceGapRefs[]", typeCategory: "object", required: true, nullable: false },
    { path: "ideas[].evidenceGapRefs[].catalogId", typeCategory: "string", required: true, nullable: false, minLength: 32, maxLength: 32 },
    { path: "ideas[].evidenceGapRefs[].gapId", typeCategory: "string", required: true, nullable: false, minLength: 2, maxLength: 31 },
    { path: "evidenceGapRefs", typeCategory: "array", required: true, nullable: false, minItems: OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.minItems, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds.maxItems },
    { path: "evidenceGapRefs[]", typeCategory: "object", required: true, nullable: false },
    { path: "evidenceGapRefs[].catalogId", typeCategory: "string", required: true, nullable: false, minLength: 32, maxLength: 32 },
    { path: "evidenceGapRefs[].gapId", typeCategory: "string", required: true, nullable: false, minLength: 2, maxLength: 31 },
  ],
} as const;

export function hybridOpportunityDiagnosticContractForPersona(persona: OpportunityPersona) {
  const allowedValues = opportunityTypeValuesForPersona(persona);
  return {
    ...hybridOpportunityDiagnosticContract,
    fields: hybridOpportunityDiagnosticContract.fields.map((field) => field.path === "ideas[].opportunityType"
      ? { ...field, allowedValues }
      : field),
  };
}

export function hybridOpportunityGenerationContext(
  catalogInput: OpportunityFactCatalog,
  context: OpportunityAnalysisContext,
): Readonly<Record<string, unknown>> {
  const catalog = opportunityFactCatalogSchema.parse(catalogInput);
  const compactValue = (value: OpportunityFact["value"]): unknown =>
    typeof value === "object" ? [value.min, value.max] : value;
  return {
    contractVersion: HYBRID_OPPORTUNITY_ANALYSIS_VERSION,
    catalogId: catalog.id,
    persona: catalog.persona,
    profileAvailability: {
      missing: context.dataAvailability.profileFieldsMissing,
    },
    selectedEvidence: {
      sourceType: context.evidence.sourceType,
      provider: context.evidence.provider,
      publisher: context.evidence.publisher,
      parentKeyword: context.evidence.parentKeyword,
      selectedQuery: context.evidence.selectedQuery,
      queryIntentCandidate: context.evidence.queryIntentCandidate,
      position: context.evidence.position,
      geographicScope: context.evidence.geographicScope,
      period: context.evidence.timeFilter,
      searchProperty: context.evidence.searchProperty,
      retrievedAt: context.evidence.retrievedAt,
      freshness: context.evidence.freshness,
      ownershipVerified: context.evidence.ownershipVerified,
    },
    // Fact groups imply ownership; tuple fields are [factId, metric, subjectLabel, value].
    // Units are determined by metric and catalog validation; no source/availability data is repeated.
    facts: {
      PROFILE: catalog.facts.filter((fact) => fact.sourceType === "PROFILE").map((fact) => [
        fact.id, fact.metric, fact.subject.label, compactValue(fact.value),
      ]),
      SEARCHAPI: catalog.facts.filter((fact) => fact.sourceType === "SEARCHAPI").map((fact) => [
        fact.id, fact.metric, fact.subject.label, compactValue(fact.value),
      ]),
    },
    // Tuple fields: [request-local gapKey, code, metric, subjectId]. The catalogId is shared at the root.
    eligibleEvidenceGaps: catalog.eligibleGaps.map(({ code, metric, subjectId }, index) => [`g${index + 1}`, code, metric, subjectId]),
    rules: [
      "facts.PROFILE/SEARCHAPI: [factId, metric, label, nilai]; gaps: [gapKey, code, metric, subjectId]. gapKey adalah kunci lokal g1, g2, dst.; kembalikan persis sebagai gapId. Server memetakan kunci itu ke gap katalog yang tepat. catalogId referensi = catalogId akar.",
      "facts = KNOWN; profileAvailability.missing dan gaps = UNKNOWN. Array nilai berarti rentang [min,max] IDR.",
      "SearchApi/Google Trends menunjukkan minat penelusuran, bukan penjualan, permintaan, pelanggan, omzet, atau profit.",
      "Top memakai indeks relatif 0-100; Rising memakai persentase sumber bila tersedia; Breakout tetap label tanpa persentase.",
      "Jangan samakan budget, harga produk, harga usulan, harga pesaing, biaya, omzet, margin, laba, dan volume.",
      "Jangan membuat klaim angka di teks bebas. Semua angka eksperimen harus muncul hanya sebagai parameter PROPOSED yang terstruktur.",
      "Eksperimen adalah rencana masa depan, bukan hasil yang sudah terjadi, sampel representatif, atau jaminan.",
    ],
  };
}

function failureFromCatalogError(error: unknown): HybridOpportunityFailureCode {
  if (!(error instanceof Error) || !("code" in error)) return "INVALID_FACT_REFERENCE";
  switch (String((error as { code: unknown }).code)) {
    case "CROSS_CONTEXT_REFERENCE": return "CROSS_CONTEXT_REFERENCE";
    case "DUPLICATE_REFERENCE": return "DUPLICATE_FACT_REFERENCE";
    case "REFERENCE_MISMATCH": return "FACT_REFERENCE_MISMATCH";
    case "STALE_REFERENCE": return "STALE_EVIDENCE_REFERENCE";
    default: return "INVALID_FACT_REFERENCE";
  }
}

function resolveFactRefs(
  catalog: OpportunityFactCatalog,
  references: readonly OpportunityFactReference[],
  ownerId: SafeUser["id"],
  now: Date,
  sourceType: OpportunityFact["sourceType"],
): readonly OpportunityFact[] {
  try {
    const facts = resolveOpportunityFactReferences(catalog, references, { ownerId, now, requireFresh: true });
    if (facts.some((fact) => fact.sourceType !== sourceType)) throw new HybridOpportunityAnalysisError("FACT_REFERENCE_MISMATCH");
    return facts;
  } catch (error) {
    if (error instanceof HybridOpportunityAnalysisError) throw error;
    throw new HybridOpportunityAnalysisError(failureFromCatalogError(error));
  }
}

function formatRupiah(value: number): string {
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 20 }).format(value)}`;
}

function formatRange(value: { min: number; max: number }): string {
  return `${formatRupiah(value.min)} sampai ${formatRupiah(value.max)}`;
}

function profileFactDescription(fact: OpportunityFact): string {
  if (fact.metric === "BUDGET_RANGE" && typeof fact.value === "object") {
    return `Budget yang dinyatakan pada profil adalah ${formatRange(fact.value)}.`;
  }
  if (fact.metric === "AVERAGE_BUSINESS_PRICE" && typeof fact.value === "object") {
    return `Rentang harga rata-rata usaha yang tercatat adalah ${formatRange(fact.value)}.`;
  }
  if (fact.metric === "PRODUCT_PRICE" && typeof fact.value === "number") {
    return `Produk ${fact.subject.label} tercatat dengan harga ${formatRupiah(fact.value)}.`;
  }
  if (fact.metric === "PROFILE_ATTRIBUTE" && typeof fact.value === "string") {
    return fact.subject.label.trim().toLocaleLowerCase("id-ID") === fact.value.trim().toLocaleLowerCase("id-ID")
      ? `Profil mencatat ${fact.value}.`
      : `Profil mencatat ${fact.subject.label.toLocaleLowerCase("id-ID")}: ${fact.value}.`;
  }
  throw new HybridOpportunityAnalysisError("FACT_REFERENCE_MISMATCH");
}

function searchFactDescription(fact: OpportunityFact, catalog: OpportunityFactCatalog): string {
  const source = catalog.sources.find((item) => item.id === fact.sourceRef);
  if (source?.sourceType !== "SEARCHAPI" || fact.subject.kind !== "QUERY") {
    throw new HybridOpportunityAnalysisError("FACT_REFERENCE_MISMATCH");
  }
  if (fact.metric === "RELATED_QUERY_INTEREST_INDEX" && typeof fact.value === "number") {
    return `Google Trends mencatat indeks minat relatif sebesar ${fact.value} untuk kueri terpilih; indeks ini bukan volume pencarian atau penjualan.`;
  }
  if (fact.metric === "RELATED_QUERY_GROWTH_PERCENT" && typeof fact.value === "number") {
    return `Google Trends mencatat pertumbuhan kueri terkait sebesar ${fact.value}% pada sinyal terpilih; ini bukan pertumbuhan penjualan atau pendapatan.`;
  }
  if (fact.metric === "RELATED_QUERY_BREAKOUT" && fact.value === "Breakout") {
    return "Google Trends memberi label Breakout pada sinyal terpilih; label ini tidak dikonversi menjadi persentase.";
  }
  if (fact.metric === "RELATED_QUERY_GROWTH_LABEL" && typeof fact.value === "string") {
    return containsNumericMention(fact.value)
      ? "Sumber menyertakan label pertumbuhan, tetapi nilai persentase terverifikasi tidak tersedia."
      : `Label pertumbuhan sumber pada sinyal terpilih adalah ${fact.value}.`;
  }
  throw new HybridOpportunityAnalysisError("FACT_REFERENCE_MISMATCH");
}

function legacyProfileReference(fact: OpportunityFact, catalog: OpportunityFactCatalog, context: OpportunityAnalysisContext) {
  const source = catalog.sources.find((item) => item.id === fact.sourceRef);
  if (source?.sourceType !== "PROFILE") throw new HybridOpportunityAnalysisError("FACT_REFERENCE_MISMATCH");
  const match = context.profileReferenceCatalog.find((item) => item.profileField === source.profileField
    && (source.profileField !== "profile.products[].price" || item.subjectId === source.subjectId));
  if (!match) throw new HybridOpportunityAnalysisError("FACT_REFERENCE_MISMATCH");
  return match;
}

function legacyGapId(gap: OpportunityEvidenceGap, context: OpportunityAnalysisContext): string {
  const compatible = context.financialEvidenceAvailability.eligibleGaps.find((candidate) => candidate.code === gap.code
    && candidate.metric === gap.metric && candidate.subjectScope === gap.subjectScope && candidate.subjectId === gap.subjectId);
  if (!compatible) throw new HybridOpportunityAnalysisError("INVALID_EVIDENCE_GAP_REFERENCE");
  return compatible.id;
}

function resolveCatalogGapId(catalog: OpportunityFactCatalog, gapId: string): string {
  const localKey = /^g([1-9]\d*)$/u.exec(gapId);
  if (!localKey) return gapId;
  const index = Number(localKey[1]) - 1;
  if (!Number.isSafeInteger(index) || index < 0) throw new HybridOpportunityAnalysisError("INVALID_EVIDENCE_GAP_REFERENCE");
  const gap = catalog.eligibleGaps[index];
  if (!gap) throw new HybridOpportunityAnalysisError("INVALID_EVIDENCE_GAP_REFERENCE");
  return gap.id;
}

function resolveGapRefs(
  catalog: OpportunityFactCatalog,
  references: readonly z.infer<typeof evidenceGapReferenceSchema>[],
  context: OpportunityAnalysisContext,
  ownerId: SafeUser["id"],
): readonly Readonly<{ catalogGap: OpportunityEvidenceGap; contextGap: OpportunityAnalysisContext["financialEvidenceAvailability"]["eligibleGaps"][number] }>[] {
  try {
    const catalogGaps = resolveOpportunityEvidenceGaps(catalog, references.map((reference) => {
      if (reference.catalogId !== catalog.id) throw new HybridOpportunityAnalysisError("INVALID_EVIDENCE_GAP_REFERENCE");
      return resolveCatalogGapId(catalog, reference.gapId);
    }), { ownerId });
    return catalogGaps.map((catalogGap) => {
      const compatibleId = legacyGapId(catalogGap, context);
      const contextGap = context.financialEvidenceAvailability.eligibleGaps.find((gap) => gap.id === compatibleId);
      if (!contextGap) throw new HybridOpportunityAnalysisError("INVALID_EVIDENCE_GAP_REFERENCE");
      return { catalogGap, contextGap };
    });
  } catch (error) {
    if (error instanceof HybridOpportunityAnalysisError) throw error;
    if (error instanceof Error && "code" in error
      && String((error as { code: unknown }).code) === "CROSS_CONTEXT_REFERENCE") {
      throw new HybridOpportunityAnalysisError("CROSS_CONTEXT_REFERENCE");
    }
    throw new HybridOpportunityAnalysisError("INVALID_EVIDENCE_GAP_REFERENCE");
  }
}

function materializeInsufficientEvidence(
  generated: Extract<HybridGeneratedOpportunityResult, { outcome: "INSUFFICIENT_EVIDENCE" }>,
  catalog: OpportunityFactCatalog,
  context: OpportunityAnalysisContext,
  ownerId: SafeUser["id"],
): GeneratedOpportunityResult {
  const gaps = resolveGapRefs(catalog, generated.evidenceGapRefs, context, ownerId);
  const limitations = gaps.map(({ contextGap }) => materializeOpportunityEvidenceGap(contextGap, context.profile, { includeSubjectName: false }));
  const result = generatedOpportunityResultSchema.safeParse({
    outcome: "INSUFFICIENT_EVIDENCE",
    reason: `Konteks saat ini belum cukup untuk menyusun hipotesis yang didukung: ${limitations[0]}`,
    limitations,
  });
  if (!result.success) throw new HybridOpportunityAnalysisError("INVALID_EVIDENCE_GAP_REFERENCE");
  return result.data;
}

function experimentParameterText(parameter: ProposedExperimentParameter): string {
  switch (parameter.kind) {
    case "SAMPLE_SIZE": return `Uji dengan target sampel ${parameter.value} calon pelanggan`;
    case "INTERVIEW_COUNT": return `Wawancarai ${parameter.value} calon pelanggan`;
    case "DURATION": return `Lakukan pengujian selama ${parameter.value} hari`;
    case "PRODUCT_VARIANT_COUNT": return `Bandingkan ${parameter.value} varian`;
    case "PRICE_TEST": return `uji rentang harga usulan ${formatRupiah(parameter.min)} sampai ${formatRupiah(parameter.max)}`;
  }
}

function actionNumberMatchesParameter(
  mention: ReturnType<typeof numericMentionValues>[number],
  parameter: ProposedExperimentParameter,
): boolean {
  const value = Number(mention.value);
  if (!Number.isSafeInteger(value)) return false;

  if (mention.kind === "COUNT") {
    const unit = mention.unit?.toLocaleLowerCase("id-ID") ?? "";
    const peopleUnit = /^(?:calon\s+(?:pelanggan|konsumen|pembeli)|orang|pelanggan|konsumen|pembeli|pelajar|mahasiswa|siswa|warga|pengunjung|sampel|responden|peserta)$/iu.test(unit);
    const variantUnit = /^(?:varian|menu|pilihan|opsi|alternatif)$/iu.test(unit);
    return (peopleUnit && (parameter.kind === "SAMPLE_SIZE" || parameter.kind === "INTERVIEW_COUNT") && value === parameter.value)
      || (variantUnit && parameter.kind === "PRODUCT_VARIANT_COUNT" && value === parameter.value);
  }

  if (mention.kind === "TIME_RANGE") {
    return parameter.kind === "DURATION" && mention.unit === "DAY" && value === parameter.value;
  }

  if (mention.kind === "CURRENCY" || mention.kind === "PROFILE_AMOUNT") {
    return parameter.kind === "PRICE_TEST" && (value === parameter.min || value === parameter.max);
  }

  return false;
}

function validateProspectiveText(result: HybridGeneratedOpportunityResult): void {
  if (result.outcome === "INSUFFICIENT_EVIDENCE") return;
  for (const [ideaIndex, idea] of result.ideas.entries()) {
    for (const [experimentIndex, experiment] of idea.experiments.entries()) {
      const mentions = numericMentionValues(experiment.action);
      if (mentions.some((mention) => !experiment.parameters.some((parameter) => actionNumberMatchesParameter(mention, parameter)))) {
        throw new HybridOpportunityAnalysisError("UNSUPPORTED_NUMERIC_CLAIM", [`ideas[${ideaIndex}].experiments[${experimentIndex}].action`]);
      }
      for (const parameter of experiment.parameters) {
        if (!proposedExperimentParameterSchema.safeParse(parameter).success) {
          throw new HybridOpportunityAnalysisError("INVALID_EXPERIMENT_PARAMETER", [`ideas[${ideaIndex}].experiments[${experimentIndex}].parameters`]);
        }
      }
    }
  }
}

function normalizeProspectiveActions(result: HybridGeneratedOpportunityResult): HybridGeneratedOpportunityResult {
  if (result.outcome === "INSUFFICIENT_EVIDENCE") return result;
  let changed = false;
  const ideas = result.ideas.map((idea) => ({
    ...idea,
    experiments: idea.experiments.map((experiment) => {
      const mentions = numericMentionValues(experiment.action);
      const rejectedSpanIndexes = mentions.flatMap((mention, spanIndex) =>
        experiment.parameters.some((parameter) => actionNumberMatchesParameter(mention, parameter)) ? [] : [spanIndex]);
      if (rejectedSpanIndexes.length === 0) return experiment;
      const cleaned = removeNumericSentences(experiment.action, rejectedSpanIndexes);
      const action = cleaned.length >= 8 ? cleaned : "Validasi penawaran kepada calon pelanggan";
      changed = true;
      return { ...experiment, action };
    }),
  }));
  return changed ? { ...result, ideas } : result;
}

export function materializeHybridOpportunityResult(
  generatedInput: HybridGeneratedOpportunityResult,
  catalogInput: OpportunityFactCatalog,
  context: OpportunityAnalysisContext,
  ownerId: SafeUser["id"],
  now: Date,
): GeneratedOpportunityResult {
  const parsedGenerated = hybridGeneratedOpportunityResultSchema.safeParse(generatedInput);
  if (!parsedGenerated.success) throw new HybridOpportunityAnalysisError("SCHEMA_VALIDATION_FAILED");
  const generated = normalizeProspectiveActions(parsedGenerated.data);
  validateProspectiveText(generated);

  const catalog = opportunityFactCatalogSchema.parse(catalogInput);
  const searchSources = catalog.sources.filter((source) => source.sourceType === "SEARCHAPI");
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  if (searchSources.length !== 1
    || searchSources[0]?.query !== context.evidence.selectedQuery
    || searchSources[0]?.queryType !== context.evidence.sourceType
    || searchSources[0]?.geography !== context.evidence.geographicCode) {
    throw new HybridOpportunityAnalysisError("FACT_REFERENCE_MISMATCH");
  }
  const evidenceExpiresAt = Date.parse(searchSources[0].expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(evidenceExpiresAt) || evidenceExpiresAt <= nowMs) {
    throw new HybridOpportunityAnalysisError("STALE_EVIDENCE_REFERENCE");
  }
  if (generated.outcome === "INSUFFICIENT_EVIDENCE") {
    return materializeInsufficientEvidence(generated, catalog, context, ownerId);
  }

  const ideas = generated.ideas.map((idea): z.infer<typeof generatedOpportunityHypothesisSchema> => {
    const profileAlignment = idea.profileFit.map((claim) => {
      const facts = resolveFactRefs(catalog, claim.profileFactRefs, ownerId, now, "PROFILE");
      const profileRefs = facts.map((fact) => legacyProfileReference(fact, catalog, context));
      // Granular facts can share one legacy field reference (for example, multiple categories).
      const supportingProfileRefs = [...new Set(profileRefs.map(({ id }) => id))];
      const profileReferences = [...new Set(profileRefs.map(({ profileField }) => profileField))];
      const explanation = numericMentionValues(claim.explanation).length > 0 ? "" : claim.explanation.trim();
      const rationale = [explanation, ...facts.map(profileFactDescription)].filter(Boolean).join(" ");
      return { rationale, supportingProfileRefs, profileReferences };
    });

    const searchFacts = idea.evidenceInterpretation.map((claim) => resolveFactRefs(catalog, claim.searchFactRefs, ownerId, now, "SEARCHAPI"));
    if (searchFacts.some((facts) => facts.some((fact) => {
      if (context.evidence.sourceType === "RELATED_QUERY_TOP") return fact.metric !== "RELATED_QUERY_INTEREST_INDEX";
      return fact.metric === "RELATED_QUERY_INTEREST_INDEX";
    }))) throw new HybridOpportunityAnalysisError("FACT_REFERENCE_MISMATCH");
    const evidenceInterpretation = idea.evidenceInterpretation.map((claim, index) => {
      const explanation = numericMentionValues(claim.explanation).length > 0 ? "" : claim.explanation.trim();
      const verifiedFacts = searchFacts[index]?.map((fact) => searchFactDescription(fact, catalog)).join(" ") ?? "";
      return [explanation, verifiedFacts].filter(Boolean).join(" ");
    }).join(" ");

    const gaps = resolveGapRefs(catalog, idea.evidenceGapRefs, context, ownerId);

    const profileReferences = [...new Set(profileAlignment.flatMap((claim) => claim.profileReferences))];
    return {
      title: idea.narrative.title,
      opportunityType: idea.opportunityType,
      concept: idea.narrative.concept,
      targetCustomer: idea.narrative.targetCustomer,
      validationSteps: idea.experiments.map((experiment) => {
        const action = experiment.action.replace(/[.!?]+\s*$/u, "");
        const parameters = experiment.parameters.map(experimentParameterText).join(". ");
        return `${action}. ${parameters}.`;
      }),
      assumptions: [...idea.assumptions],
      profileAlignment: profileAlignment.map(({ rationale, supportingProfileRefs }) => ({ rationale, supportingProfileRefs })),
      profileReferences,
      evidenceInterpretation,
      evidenceReferences: [context.evidence.sourceId],
      evidenceGapIds: gaps.map(({ catalogGap }) => legacyGapId(catalogGap, context)),
      limitations: [...idea.limitations],
    };
  });

  const parsed = generatedOpportunityResultSchema.safeParse({ outcome: "HYPOTHESES", ideas });
  if (!parsed.success) throw new HybridOpportunityAnalysisError("INVALID_FACT_REFERENCE");
  return parsed.data;
}
