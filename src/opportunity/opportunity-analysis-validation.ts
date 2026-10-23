import { z } from "zod";

import {
  ENTREPRENEUR_OPPORTUNITY_TYPES,
  generatedOpportunityHypothesisSchema,
  OPPORTUNITY_HYPOTHESIS_LIMITS,
  opportunityTypeSchema,
  UMKM_EXISTING_OPPORTUNITY_TYPES,
} from "./private-hypothesis";
import type {
  OpportunityAnalysisContext,
  OpportunityProfileField,
  OpportunityProfileReference,
} from "./opportunity-analysis-context";

const insufficientEvidenceSchema = z.object({
  outcome: z.literal("INSUFFICIENT_EVIDENCE"),
  reason: z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.insufficientReason.min).max(OPPORTUNITY_HYPOTHESIS_LIMITS.insufficientReason.max),
  limitations: z.array(z.string().trim().min(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMin).max(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.itemMax))
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.maxItems),
}).strict();

const hypothesesSchema = z.object({
  outcome: z.literal("HYPOTHESES"),
  ideas: z.array(generatedOpportunityHypothesisSchema)
    .min(OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.minItems).max(OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.maxItems),
}).strict();

export const generatedOpportunityResultSchema = z.discriminatedUnion("outcome", [
  hypothesesSchema,
  insufficientEvidenceSchema,
]);

export type GeneratedOpportunityResult = z.infer<typeof generatedOpportunityResultSchema>;

const diagnosticStringField = (path: string, minLength: number, maxLength: number) => ({
  path, typeCategory: "string" as const, required: true, nullable: false, minLength, maxLength,
});
const diagnosticStringArray = (path: string, bounds: Readonly<{ itemMin: number; itemMax: number; minItems: number; maxItems: number }>) => [
  { path, typeCategory: "array" as const, required: true, nullable: false, minItems: bounds.minItems, maxItems: bounds.maxItems },
  diagnosticStringField(path + "[]", bounds.itemMin, bounds.itemMax),
];

export const generatedOpportunityDiagnosticContract = {
  fields: [
    { path: "outcome", typeCategory: "enum", required: true, nullable: false, allowedValues: ["HYPOTHESES", "INSUFFICIENT_EVIDENCE"] },
    { path: "ideas", typeCategory: "array", required: true, nullable: false, minItems: OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.minItems, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.ideas.maxItems },
    { path: "ideas[]", typeCategory: "object", required: true, nullable: false },
    diagnosticStringField("ideas[].title", OPPORTUNITY_HYPOTHESIS_LIMITS.title.min, OPPORTUNITY_HYPOTHESIS_LIMITS.title.max),
    { path: "ideas[].opportunityType", typeCategory: "enum", required: true, nullable: false, allowedValues: opportunityTypeSchema.options },
    diagnosticStringField("ideas[].concept", OPPORTUNITY_HYPOTHESIS_LIMITS.concept.min, OPPORTUNITY_HYPOTHESIS_LIMITS.concept.max),
    diagnosticStringField("ideas[].targetCustomer", OPPORTUNITY_HYPOTHESIS_LIMITS.targetCustomer.min, OPPORTUNITY_HYPOTHESIS_LIMITS.targetCustomer.max),
    ...diagnosticStringArray("ideas[].validationSteps", OPPORTUNITY_HYPOTHESIS_LIMITS.validationSteps),
    ...diagnosticStringArray("ideas[].assumptions", OPPORTUNITY_HYPOTHESIS_LIMITS.assumptions),
    { path: "ideas[].profileAlignment", typeCategory: "array", required: true, nullable: false, minItems: OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.minItems, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.maxItems },
    { path: "ideas[].profileAlignment[]", typeCategory: "object", required: true, nullable: false },
    diagnosticStringField("ideas[].profileAlignment[].rationale", OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.itemMin, OPPORTUNITY_HYPOTHESIS_LIMITS.profileAlignment.itemMax),
    { path: "ideas[].profileAlignment[].supportingProfileRefs", typeCategory: "array", required: true, nullable: false, minItems: 1, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.maxItems },
    diagnosticStringField("ideas[].profileAlignment[].supportingProfileRefs[]", 1, OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences.itemMax),
    ...diagnosticStringArray("ideas[].profileReferences", OPPORTUNITY_HYPOTHESIS_LIMITS.profileReferences),
    diagnosticStringField("ideas[].evidenceInterpretation", OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceInterpretation.min, OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceInterpretation.max),
    ...diagnosticStringArray("ideas[].evidenceReferences", OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceReferences),
    ...diagnosticStringArray("ideas[].evidenceGapIds", OPPORTUNITY_HYPOTHESIS_LIMITS.evidenceGapIds),
    ...diagnosticStringArray("ideas[].limitations", OPPORTUNITY_HYPOTHESIS_LIMITS.limitations),
    diagnosticStringField("reason", OPPORTUNITY_HYPOTHESIS_LIMITS.insufficientReason.min, OPPORTUNITY_HYPOTHESIS_LIMITS.insufficientReason.max),
    { path: "limitations", typeCategory: "array", required: true, nullable: false, minItems: OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.minItems, maxItems: OPPORTUNITY_HYPOTHESIS_LIMITS.limitations.maxItems },
    ...diagnosticStringArray("limitations", OPPORTUNITY_HYPOTHESIS_LIMITS.limitations).slice(1),
  ],
} as const;

export type NumericProvenanceCategory =
  | "GOOGLE_TRENDS_INTEREST_INDEX"
  | "GOOGLE_TRENDS_GROWTH_PERCENT"
  | "GOOGLE_TRENDS_TIME_RANGE"
  | "GOOGLE_TRENDS_RETRIEVAL_DATE"
  | "GOOGLE_TRENDS_POSITION"
  | "PROFILE_BUDGET"
  | "PROFILE_PRODUCT_PRICE"
  | "PROFILE_AVERAGE_PRICE"
  | "UNSUPPORTED_BUSINESS_CLAIM"
  | "OTHER_CONTEXTUAL_NUMBER";

export const OPPORTUNITY_NUMERIC_GROUNDING_CONTRACT_VERSION = "numeric-grounding-v6" as const;

export type NumericSemanticCategory =
  | "VERIFIED_SOURCE_FACT"
  | "DECLARED_PROFILE_FACT"
  | "PROPOSED_EXPERIMENT_PARAMETER"
  | "DATA_COLLECTION_REQUIREMENT"
  | "ORDINAL_OR_PRODUCT_LABEL"
  | "MISSING_EVIDENCE_REQUIREMENT"
  | "DERIVED_VERIFIABLE_VALUE"
  | "UNSUPPORTED_EMPIRICAL_CLAIM"
  | "UNSUPPORTED_FINANCIAL_CLAIM"
  | "AMBIGUOUS_NUMERIC_STATEMENT";

export type NumericGroundingDiagnostic = Readonly<{
  fieldPath: string;
  rejectedRule: "UNSUPPORTED_NUMBER" | "UNSUPPORTED_FINANCIAL_CLAIM" | "UNSUPPORTED_METRIC_CLAIM";
  semanticCategory: NumericSemanticCategory;
  expectedMetricCategory: NumericProvenanceCategory;
  futureAction: boolean;
  verifiedSourceMatch: boolean;
  unitClassification: "DATE" | "CURRENCY" | "PERCENT" | "TIME_RANGE" | "COUNT" | "INTEREST_INDEX" | "POSITION" | "PROFILE_AMOUNT" | "ORDINAL" | "PRODUCT_LABEL" | "OTHER";
  spanIndex: number;
  reason: "FINANCIAL_CLAIM_WITHOUT_MATCHING_SOURCE" | "UNSUPPORTED_COUNT_CLAIM" | "UNSUPPORTED_FINANCIAL_ASSERTION" | "NO_SOURCE_OR_PROSPECTIVE_CONTEXT" | "AMBIGUOUS_NUMERIC_MEANING";
  subjectCategory?: "BUSINESS" | "PRODUCT_SET" | "EXISTING_PRODUCT" | "PROPOSED_PRODUCT" | "COMPETITOR" | "CUSTOMER" | "BUSINESS_OPERATIONS" | "PROFILE_FIELD";
  expectedSourceFieldExists?: boolean;
  matchingSourceReferenceExists?: boolean;
  validationResult?: "MATCHED_PROFILE_SOURCE" | "REJECTED_NO_MATCHING_PROFILE_SOURCE";
  correlationId?: string | null;
  analysisContextVersion?: string;
  promptVersion?: string;
  groundingContractVersion?: typeof OPPORTUNITY_NUMERIC_GROUNDING_CONTRACT_VERSION;
}>;

export type OpportunityGroundingFailure = Readonly<{
  rejectedRule:
    | "UNSUPPORTED_NUMBER"
    | "UNSUPPORTED_GUARANTEE"
    | "UNSUPPORTED_FINANCIAL_CLAIM"
    | "UNSUPPORTED_METRIC_CLAIM"
    | "PERSONA_MISMATCH"
    | "INVALID_PROFILE_REFERENCE"
    | "INVALID_EVIDENCE_REFERENCE"
    | "INVALID_EVIDENCE_GAP_REFERENCE"
    | "EXISTING_PRODUCT_AS_NEW_MENU";
  fields: readonly string[];
  semanticCategory?: NumericSemanticCategory;
  numericDiagnostics?: readonly NumericGroundingDiagnostic[];
  sourceCategory?: OpportunityAnalysisContext["evidence"]["sourceType"];
  sourceReference?: string;
  financialMetric?: FinancialMetric;
  financialEvidenceAvailable?: boolean;
  isMissingDataDescription?: boolean;
  claimClassification?: FinancialClaimClassification;
}>;

export type FinancialMetric =
  | "REVENUE"
  | "PROFIT"
  | "MARGIN"
  | "ROI"
  | "OPERATING_COST"
  | "UNIT_COST"
  | "PRODUCT_PRICE"
  | "BUDGET"
  | "TRANSACTION_COUNT"
  | "SALES_VOLUME"
  | "AVERAGE_BUSINESS_PRICE"
  | "PROPOSED_PRODUCT_PRICE"
  | "COMPETITOR_PRICE"
  | "CUSTOMER_WILLINGNESS_TO_PAY"
  | "PRODUCTION_COST"
  | "MARKET_METRIC";

export type FinancialClaimClassification =
  | "MISSING_FINANCIAL_DATA"
  | "PROPOSED_FINANCIAL_VALIDATION"
  | "UNSUPPORTED_FINANCIAL_ASSERTION"
  | "UNSUPPORTED_FINANCIAL_FORECAST"
  | "PROFILE_VALUE_MISSTATED_AS_MISSING";

const entrepreneurOpportunityTypes = new Set<z.infer<typeof opportunityTypeSchema>>(ENTREPRENEUR_OPPORTUNITY_TYPES);
const umkmOpportunityTypes = new Set<z.infer<typeof opportunityTypeSchema>>(UMKM_EXISTING_OPPORTUNITY_TYPES);

const guarantees = /\b(dijamin|pasti berhasil|pasti sukses|pasti laris|keuntungan pasti|akan untung|tanpa risiko|dipastikan berhasil|terbukti laris)\b/iu;
const numberWord = String.raw`(?:nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|seribu|sejuta|semiliar|setriliun)`;
const numberWordsPhrase = String.raw`${numberWord}(?:\s+(?:belas|puluh|ratus|ribu|juta|miliar|triliun|${numberWord}))*`;
const unsignedNumberPattern = String.raw`(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?|${numberWordsPhrase})`;
const signedNumberPattern = String.raw`(?<![\p{L}\d])[+-]${unsignedNumberPattern}`;
const numberExpression = new RegExp(String.raw`${signedNumberPattern}|${unsignedNumberPattern}`, "giu");
const financialMetrics = /\b(omzet|pendapatan|revenue|laba|profit|keuntungan|margin|roi|pangsa pasar|market share|penjualan|sales|pertumbuhan pasar|market growth)\b/iu;
const assertedFinancialResults = /\b(?:omzet|pendapatan|revenue|laba|profit|keuntungan|margin|roi|pangsa pasar|market share|penjualan|sales|pertumbuhan pasar|market growth)\b.{0,50}\b(?:naik|meningkat|bertumbuh|tumbuh|besar|tinggi|menghasilkan|mencapai|meraih|bertambah)\b|\b(?:menaikkan|meningkatkan|menghasilkan|meraih|menambah)\b.{0,35}\b(?:omzet|pendapatan|revenue|laba|profit|keuntungan|margin|roi|pangsa pasar|market share|penjualan|sales)\b/iu;
const financialMetricPatterns: readonly (readonly [FinancialMetric, RegExp])[] = [
  ["COMPETITOR_PRICE", /\b(?:harga\s+(?:produk\s+)?(?:pesaing|kompetitor)|harga\s+pasar|competitor\s+price)\b/iu],
  ["PROPOSED_PRODUCT_PRICE", /\b(?:harga\s+(?:(?:jual|produk|menu|varian)\s+){0,2}(?:usulan|baru)|harga\s+(?:menu|varian)\s+baru|proposed\s+price)\b/iu],
  ["AVERAGE_BUSINESS_PRICE", /\b(?:harga\s+rata-rata|average\s+(?:business\s+)?price)\b/iu],
  ["CUSTOMER_WILLINGNESS_TO_PAY", /\b(?:kesediaan\s+(?:pelanggan|konsumen)\s+(?:untuk\s+)?membayar|willingness\s+to\s+pay)\b/iu],
  ["PRODUCTION_COST", /\b(?:biaya\s+(?:produksi|bahan\s+baku|per\s+porsi)|harga\s+pokok|unit\s+cost|cost\s+per\s+unit)\b/iu],
  ["REVENUE", /\b(?:omzet|pendapatan|revenue)\b/iu],
  ["MARGIN", /\b(?:margin(?:\s+(?:keuntungan|laba|profit|kotor|bersih))?|gross margin|net margin)\b/iu],
  ["ROI", /\b(?:roi|return on investment|pengembalian investasi)\b/iu],
  ["PROFIT", /\b(?:laba|profit|keuntungan)\b/iu],
  ["OPERATING_COST", /\b(?:biaya operasional|operating expenses?|operating costs?)\b/iu],
  ["UNIT_COST", /\b(?:biaya bahan baku|biaya produksi|biaya per porsi|unit cost|cost per unit|harga(?:\s+pokok|\s+bahan baku))\b/iu],
  ["PRODUCT_PRICE", /\b(?:harga(?:\s+(?:produk|jual|rata-rata))?|price)\b/iu],
  ["BUDGET", /\b(?:modal|budget|anggaran|dana)\b/iu],
  ["TRANSACTION_COUNT", /\b(?:jumlah\s+transaksi|transaksi)\b/iu],
  ["SALES_VOLUME", /\b(?:volume\s+penjualan|penjualan|sales\s+volume|sales)\b/iu],
  ["MARKET_METRIC", /\b(?:pangsa pasar|market share|pertumbuhan pasar|market growth)\b/iu],
];
const missingFinancialData = /\b(?:belum tersedia|tidak tersedia|belum ada|tidak ada|belum dihitung|belum diketahui|tidak diketahui|belum tercatat|belum diberikan|belum diukur|belum diverifikasi|masih perlu diverifikasi|perlu diverifikasi|perlu divalidasi|belum divalidasi|belum dikonfirmasi|belum teridentifikasi|belum dikumpulkan|belum didokumentasikan|belum dicatat)\b/iu;
const proposedFinancialValidation = /\b(?:perlu|sebaiknya|harus|dapat)\s+(?:menghitung|mengukur|memverifikasi|memvalidasi|mencatat|mengumpulkan|membandingkan|mengonfirmasi|meninjau)\b|\b(?:perlu|sebaiknya|harus)\s+(?:dihitung|diukur|diverifikasi|divalidasi|dicatat|dikumpulkan|dikonfirmasi)\b/iu;
const financialForecast = /\b(?:akan|diperkirakan|berpotensi|diproyeksikan|diprediksi|proyeksi|perkiraan|target)\b/iu;
const financialNegation = /\b(?:tidak|belum|bukan|tanpa)\b/iu;
const countUnits = /^(?:calon\s+(?:pelanggan|konsumen|pembeli)|orang|pelanggan|konsumen|pembeli|pelajar|mahasiswa|siswa|warga|pengunjung|pesanan|transaksi|penjualan|pencarian|permintaan|pangsa pasar|market share|volume pasar|sampel|responden|peserta|alternatif|varian|menu|pilihan|opsi|porsi|unit|gerai|outlet|cabang)\b/iu;
const timeUnits: Readonly<Record<string, string>> = {
  jam: "HOUR", hari: "DAY", minggu: "WEEK", bulan: "MONTH", tahun: "YEAR",
};
const proposedExperimentActions = /\b(?:uji|lakukan|melakukan|wawancarai|mewawancarai|survei|bandingkan|membandingkan|kumpulkan|mengumpulkan|catat|mencatat|ukur|mengukur|validasi|memvalidasi|rekam|merekam|interview|survey|compare|test|pengujian|eksperimen|uji\s+coba)\b/iu;
const prospectivePricingExperiment = /\b(?:uji|bandingkan|membandingkan|validasi|memvalidasi|eksperimen|test|compare)\b.{0,60}\b(?:harga|rentang harga|titik harga|price)\b|\b(?:harga|rentang harga|titik harga|price)\b.{0,60}\b(?:uji|bandingkan|membandingkan|validasi|memvalidasi|eksperimen|test|compare)\b/iu;
const completedExperiment = /\b(?:sudah|telah|pernah|selesai)\s+(?:diuji|dicoba|diwawancarai|disurvei|dibandingkan|dikumpulkan|dicatat|diukur|divalidasi|dilakukan|dilaksanakan)\b|\b(?:uji|wawancara|wawancarai|survei|pengujian|eksperimen)\b.{0,48}\b(?:sudah|telah|selesai)\s+(?:diuji|dicoba|diwawancarai|disurvei|dibandingkan|dikumpulkan|dicatat|diukur|divalidasi|dilakukan|dilaksanakan)\b|\b(?:pengujian|eksperimen|wawancara|survei)\b.{0,32}\b(?:menunjukkan|membuktikan|menghasilkan|tercatat)\b|\b(?:kemarin|minggu\s+lalu|bulan\s+lalu|tahun\s+lalu)\b/iu;
const proposedCountUnits = /^(?:alternatif|varian|menu|pilihan|opsi|sampel|responden|peserta|orang|pelanggan|konsumen|pelajar|mahasiswa|siswa|warga|pengunjung|calon\s+(?:pelanggan|konsumen|pembeli))$/iu;
const commercialCountClaim = /\b(?:melayani|menjangkau|menarik|mendapatkan|memperoleh|menghasilkan|mencapai|menjual|terjual)\b/iu;
const dataCollectionActions = /\b(?:kumpulkan|mengumpulkan|catat|mencatat|ukur|mengukur|rekam|merekam|log|survey|survei|wawancarai|wawancara|interview)\b/iu;
const collectedDataContext = /\b(?:data|catatan|rekaman|log)\b.{0,48}\b(?:transaksi|pesanan|penjualan|pelanggan|tanggapan|respons|permintaan)\b/iu;

function financialMetricForText(text: string): FinancialMetric | undefined {
  const missing = missingFinancialData.exec(text);
  if (missing) return nearestFinancialMetricAt(text, missing.index, missing.index + missing[0].length);
  const metric = financialMetricPatterns.find(([, pattern]) => pattern.test(text));
  return metric?.[0];
}

function nearestFinancialMetricAt(text: string, startPosition: number, endPosition: number): FinancialMetric | undefined {
  const candidates: Array<{ metric: FinancialMetric; distance: number }> = [];
  for (const [metric, pattern] of financialMetricPatterns) {
    const expression = new RegExp(pattern.source, "giu");
    for (const match of text.matchAll(expression)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      candidates.push({ metric, distance: end <= startPosition ? startPosition - end : start >= endPosition ? start - endPosition : 0 });
    }
  }
  return candidates.sort((left, right) => left.distance - right.distance)[0]?.metric;
}

function nearestFinancialMetric(text: string, mention: NumericMention): FinancialMetric | undefined {
  const clause = clauseAtNumericMention(text, mention);
  if (clause !== text) return financialMetricForText(clause);
  return nearestFinancialMetricAt(text, mention.start, mention.end);
}

function normalizeSubjectText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("id-ID").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
}

function namedExistingProduct(context: OpportunityAnalysisContext, text: string) {
  if (context.profile.persona !== "UMKM_EXISTING") return undefined;
  const normalizedText = ` ${normalizeSubjectText(text)} `;
  return context.profile.products
    .map((product, index) => ({ product, index, normalizedName: normalizeSubjectText(product.name) }))
    .filter(({ normalizedName }) => normalizedName.length >= 3 && normalizedText.includes(` ${normalizedName} `))
    .sort((left, right) => right.normalizedName.length - left.normalizedName.length)[0];
}

function matchingFinancialAvailability(
  context: OpportunityAnalysisContext,
  metric: FinancialMetric | undefined,
  text: string,
) {
  const normalizedText = normalizeSubjectText(text);
  let inventoryMetric: string | undefined;
  let subjectScope: string | undefined;

  if (metric === "PRODUCT_PRICE") {
    if (/\b(?:pesaing|kompetitor|harga pasar|competitor|market)\b/iu.test(normalizedText)) {
      inventoryMetric = "COMPETITOR_PRICE";
      subjectScope = "COMPETITOR";
    } else if (/\b(?:usulan|baru|varian|menu baru|produk baru)\b/iu.test(normalizedText)) {
      inventoryMetric = "PROPOSED_PRODUCT_PRICE";
      subjectScope = "PROPOSED_PRODUCT";
    } else if (/\b(?:rata-rata|average)\b/iu.test(normalizedText)) {
      inventoryMetric = "AVERAGE_BUSINESS_PRICE";
      subjectScope = "BUSINESS";
    } else if (context.profile.persona === "UMKM_EXISTING") {
      const namedProduct = namedExistingProduct(context, text);
      if (namedProduct) {
        inventoryMetric = "PRODUCT_PRICE";
        subjectScope = "EXISTING_PRODUCT";
        const subjectId = `profile.products[${namedProduct.index}]`;
        return context.financialEvidenceAvailability.inventory.find((item) =>
          item.metric === inventoryMetric && item.subjectScope === subjectScope && item.subjectId === subjectId,
        );
      }
      return undefined;
    } else {
      return undefined;
    }
  } else {
    const metricMap: Partial<Record<FinancialMetric, string>> = {
      BUDGET: "BUDGET",
      REVENUE: "REVENUE",
      MARGIN: "MARGIN",
      OPERATING_COST: "OPERATING_COST",
      UNIT_COST: "PRODUCTION_COST",
      PRODUCTION_COST: "PRODUCTION_COST",
      SALES_VOLUME: "SALES_VOLUME",
      CUSTOMER_WILLINGNESS_TO_PAY: "CUSTOMER_WILLINGNESS_TO_PAY",
      AVERAGE_BUSINESS_PRICE: "AVERAGE_BUSINESS_PRICE",
      PROPOSED_PRODUCT_PRICE: "PROPOSED_PRODUCT_PRICE",
      COMPETITOR_PRICE: "COMPETITOR_PRICE",
    };
    inventoryMetric = metric ? metricMap[metric] : undefined;
  }

  return context.financialEvidenceAvailability.inventory.find((item) =>
    item.metric === inventoryMetric && (!subjectScope || item.subjectScope === subjectScope),
  );
}

function financialSourceDiagnostic(
  context: OpportunityAnalysisContext,
  mention: NumericMention,
  text: string,
  references: readonly string[],
  verifiedSourceMatch: boolean,
): NonNullable<NumericAssessment["financialSource"]> {
  const metric = nearestFinancialMetric(text, mention) ?? financialMetricForText(text);
  const availability = matchingFinancialAvailability(context, metric, text);
  const subjectCategory = availability?.subjectScope
    ?? (metric === "COMPETITOR_PRICE" ? "COMPETITOR"
      : metric === "PROPOSED_PRODUCT_PRICE" ? "PROPOSED_PRODUCT"
        : metric === "CUSTOMER_WILLINGNESS_TO_PAY" ? "CUSTOMER"
          : metric === "OPERATING_COST" ? "BUSINESS_OPERATIONS"
            : metric ? "BUSINESS" : "PROFILE_FIELD");
  const sourceField = availability?.relatedProfileField;
  let expectedSourceFieldExists = false;
  let referenceSubjectId: string | undefined;

  if (availability?.metric === "PRODUCT_PRICE" && context.profile.persona === "UMKM_EXISTING") {
    const productIndex = Number(/^profile\.products\[(\d+)\]$/u.exec(availability.subjectId)?.[1]);
    const product = context.profile.products[productIndex];
    expectedSourceFieldExists = Boolean(product && product.price !== null
      && context.dataAvailability.profileFieldsPresent.includes("profile.products[].price"));
    referenceSubjectId = availability.subjectId;
  } else if (sourceField) {
    expectedSourceFieldExists = context.dataAvailability.profileFieldsPresent.includes(sourceField)
      && availability.status !== "UNKNOWN";
    referenceSubjectId = availability.subjectId;
  }

  const matchingSourceReferenceExists = Boolean(sourceField && expectedSourceFieldExists
    && hasProfileReference(context, references, sourceField, referenceSubjectId));

  return {
    subjectCategory,
    expectedSourceFieldExists,
    matchingSourceReferenceExists,
    validationResult: verifiedSourceMatch ? "MATCHED_PROFILE_SOURCE" : "REJECTED_NO_MATCHING_PROFILE_SOURCE",
  };
}

function hasAffirmativeFinancialAssertion(text: string): boolean {
  const clauses = text.split(/[!?;\n]+|[.,](?!\d)|\b(?:dan|namun|tetapi|sedangkan|but|however)\b/iu);
  return clauses.some((clause) => {
    const match = assertedFinancialResults.exec(clause);
    if (!match) return false;
    const prefix = clause.slice(0, match.index).toLocaleLowerCase("id-ID");
    return !financialNegation.test(prefix);
  });
}

function financialDiagnosticMetadata(
  text: string,
  context: OpportunityAnalysisContext,
  containsNumericClaim: boolean,
  mention?: NumericMention,
): Pick<OpportunityGroundingFailure, "financialMetric" | "financialEvidenceAvailable" | "isMissingDataDescription" | "claimClassification"> {
  const metric = mention ? nearestFinancialMetric(text, mention) ?? financialMetricForText(text) : financialMetricForText(text);
  const matchingAvailability = matchingFinancialAvailability(context, metric, text);
  const evidenceAvailable = matchingAvailability?.status === "KNOWN";
  const isMissingDataDescription = missingFinancialData.test(text);
  const classification: FinancialClaimClassification = isMissingDataDescription && evidenceAvailable
    ? "PROFILE_VALUE_MISSTATED_AS_MISSING"
    : containsNumericClaim
      ? financialForecast.test(text) ? "UNSUPPORTED_FINANCIAL_FORECAST" : "UNSUPPORTED_FINANCIAL_ASSERTION"
      : isMissingDataDescription
        ? "MISSING_FINANCIAL_DATA"
        : proposedFinancialValidation.test(text)
          ? "PROPOSED_FINANCIAL_VALIDATION"
          : financialForecast.test(text)
            ? "UNSUPPORTED_FINANCIAL_FORECAST"
            : "UNSUPPORTED_FINANCIAL_ASSERTION";
  return {
    ...(metric ? { financialMetric: metric } : {}),
    financialEvidenceAvailable: evidenceAvailable,
    isMissingDataDescription,
    claimClassification: classification,
  };
}

type NumericMention = Readonly<{
  value: string;
  kind: "DATE" | "CURRENCY" | "PERCENT" | "TIME_RANGE" | "COUNT" | "INTEREST_INDEX" | "POSITION" | "PROFILE_AMOUNT" | "ORDINAL" | "PRODUCT_LABEL" | "OTHER";
  unit: string | null;
  start: number;
  end: number;
  spanIndex: number;
  isRange: boolean;
  rangeValues?: readonly [string, string];
  productLabelRange?: Readonly<{ start: number; end: number }>;
}>;

type NumericAssessment = Readonly<{
  semanticCategory: NumericSemanticCategory;
  futureAction: boolean;
  verifiedSourceMatch: boolean;
  unitClassification: NumericMention["kind"];
  rejection?: NumericGroundingDiagnostic["rejectedRule"];
  reason?: NumericGroundingDiagnostic["reason"];
  financialSource?: Pick<NumericGroundingDiagnostic, "subjectCategory" | "expectedSourceFieldExists" | "matchingSourceReferenceExists" | "validationResult">;
}>;

function clauseAtNumericMention(text: string, mention: NumericMention): string {
  const separators = /[!?;\n]+|[.,](?!\d)|\b(?:dan|namun|tetapi|karena|sehingga|sedangkan|but|however)\b/giu;
  let clauseStart = 0;
  let clauseEnd = text.length;
  for (const match of text.matchAll(separators)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (end <= mention.start) clauseStart = end;
    else if (start >= mention.end) {
      clauseEnd = start;
      break;
    }
  }
  return text.slice(clauseStart, clauseEnd);
}

function describesProspectiveAction(field: string, text: string, mention: NumericMention): boolean {
  const isProspectiveText = /^ideas\[\d+\]\.(?:concept|assumptions\[\d+\]|validationSteps\[\d+\])$/u.test(field);
  if (!isProspectiveText) return false;

  const clause = clauseAtNumericMention(text, mention);
  return proposedExperimentActions.test(clause) && !completedExperiment.test(clause);
}

function isProspectiveExperimentParameter(
  context: OpportunityAnalysisContext,
  field: string,
  text: string,
  mention: NumericMention,
): boolean {
  const isProspectiveText = /^ideas\[\d+\]\.(?:concept|assumptions\[\d+\]|validationSteps\[\d+\])$/u.test(field);
  if (!isProspectiveText || !describesProspectiveAction(field, text, mention)) return false;

  const clause = clauseAtNumericMention(text, mention);
  if ((mention.kind === "PROFILE_AMOUNT" || mention.kind === "CURRENCY")
    && prospectivePricingExperiment.test(clause)
    && !financialMetrics.test(clause)
    && !/\b(?:pesaing|kompetitor|harga pasar|competitor|market)\b/iu.test(clause)) {
    const explicitProposal = /\b(?:rentang harga|titik harga|harga usulan|harga baru|beberapa harga|harga alternatif|variasi harga|price point)\b/iu.test(clause);
    const namedExisting = context.profile.persona === "UMKM_EXISTING" && Boolean(namedExistingProduct(context, text));
    if (!namedExisting || explicitProposal) return true;
  }

  if (mention.kind === "COUNT") {
    const unit = mention.unit ?? "";
    return proposedCountUnits.test(unit) && !commercialCountClaim.test(clauseAtNumericMention(text, mention));
  }
  return mention.kind === "TIME_RANGE";
}

function isDataCollectionRequirement(text: string, mention: NumericMention): boolean {
  return (mention.kind === "TIME_RANGE" || mention.kind === "COUNT")
    && dataCollectionActions.test(clauseAtNumericMention(text, mention))
    && collectedDataContext.test(clauseAtNumericMention(text, mention));
}

function isSequentialOrdinal(field: string, mention: NumericMention): boolean {
  if (mention.kind !== "ORDINAL") return false;
  const stepIndex = /^ideas\[\d+\]\.validationSteps\[(\d+)\]$/u.exec(field)?.[1];
  return stepIndex !== undefined && normalizedNumber(mention.value) === String(Number(stepIndex) + 1);
}

function parseIndonesianNumberWords(value: string): number | null {
  const directValues: Readonly<Record<string, number>> = {
    nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8,
    sembilan: 9, sepuluh: 10, sebelas: 11, seratus: 100, seribu: 1_000, sejuta: 1_000_000,
    semiliar: 1_000_000_000, setriliun: 1_000_000_000_000,
  };
  const tokens = value.toLocaleLowerCase("id-ID").trim().split(/\s+/u);
  let total = 0;
  let hundredsAndUnits = 0;
  let pending = 0;
  for (const token of tokens) {
    if (Object.hasOwn(directValues, token)) {
      const direct = directValues[token] ?? 0;
      if (direct >= 100) hundredsAndUnits += direct;
      else pending += direct;
    } else if (token === "belas") {
      if (pending < 1 || pending > 9) return null;
      hundredsAndUnits += pending + 10;
      pending = 0;
    } else if (token === "puluh") {
      if (pending < 1 || pending > 9) return null;
      hundredsAndUnits += pending * 10;
      pending = 0;
    } else if (token === "ratus") {
      if (pending < 1 || pending > 9) return null;
      hundredsAndUnits += pending * 100;
      pending = 0;
    } else if (token === "ribu" || token === "juta" || token === "miliar" || token === "triliun") {
      const multiplier = token === "ribu" ? 1_000 : token === "juta" ? 1_000_000 : token === "miliar" ? 1_000_000_000 : 1_000_000_000_000;
      total += (hundredsAndUnits + pending || 1) * multiplier;
      hundredsAndUnits = 0;
      pending = 0;
    } else {
      return null;
    }
  }
  const result = total + hundredsAndUnits + pending;
  return Number.isSafeInteger(result) ? result : null;
}

function normalizedNumber(value: string | number): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? String(value).replace(/\.0+$/u, "") : null;
  }
  const trimmed = value.trim();
  const sign = trimmed.startsWith("-") ? -1 : 1;
  const unsigned = trimmed.replace(/^[+-]/u, "");
  if (!/^\d/u.test(unsigned)) {
    const parsedWords = parseIndonesianNumberWords(unsigned);
    return parsedWords === null ? null : String(sign * parsedWords);
  }
  const token = unsigned.replace(/[\s\u00a0]/gu, "");
  if (!token) return null;
  const separators = [...token.matchAll(/[.,]/gu)].map((match) => match.index ?? -1);
  if (separators.length === 0) return String(sign * Number(token));
  const lastSeparator = separators.at(-1) ?? -1;
  const decimalDigits = token.length - lastSeparator - 1;
  const hasBoth = token.includes(".") && token.includes(",");
  const repeatedThousands = !hasBoth && /^\d{1,3}(?:[.,]\d{3})+$/u.test(token);
  const ambiguousThousands = !hasBoth && decimalDigits === 3 && /^\d{1,3}[.,]\d{3}$/u.test(token);
  if (repeatedThousands || ambiguousThousands) return String(sign * Number(token.replace(/[.,]/gu, "")));

  const integerPart = token.slice(0, lastSeparator).replace(/[.,]/gu, "");
  const fractionPart = token.slice(lastSeparator + 1);
  if (!/^\d+$/u.test(integerPart) || !/^\d+$/u.test(fractionPart)) return null;
  const normalized = `${integerPart || "0"}.${fractionPart}`;
  const parsed = Number(normalized) * sign;
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function extractNumericMentions(text: string): readonly NumericMention[] {
  const dates: Omit<NumericMention, "spanIndex">[] = [];
  const occupied: Array<readonly [number, number]> = [];
  const datePattern = /\b(20\d{2})-(\d{2})-(\d{2})\b/gu;
  for (const match of text.matchAll(datePattern)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const timestamp = Date.parse(`${raw}T00:00:00.000Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== raw) continue;
    dates.push({ value: raw, kind: "DATE", unit: "ISO_DATE", start, end: start + raw.length, isRange: false });
    occupied.push([start, start + raw.length]);
  }

  const tokens: Array<{ value: string; raw: string; start: number; end: number }> = [];
  numberExpression.lastIndex = 0;
  for (const match of text.matchAll(numberExpression)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const end = start + raw.length;
    if (occupied.some(([left, right]) => start < right && end > left)) continue;
    const value = normalizedNumber(raw);
    if (value === null) continue;
    tokens.push({ value, raw, start, end });
  }

  const rangePairs = new Map<number, number>();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (rangePairs.has(index) || rangePairs.has(index + 1)) continue;
    const current = tokens[index];
    const next = tokens[index + 1];
    if (!current || !next) continue;
    const delimiter = text.slice(current.end, next.start);
    if (/^\s*(?:[-–—]|sampai|hingga|to)\s*$/iu.test(delimiter)) {
      rangePairs.set(index, index + 1);
    }
  }
  const rangeIndexes = new Set([...rangePairs.entries()].flatMap(([start, end]) => [start, end]));
  const productLabelRanges = [...text.matchAll(/\b\d+\s*-\s*in\s*-\s*\d+\b/giu)].map((match) => {
    const start = match.index ?? 0;
    return { start, end: start + match[0].length };
  });

  const mentions: Omit<NumericMention, "spanIndex">[] = [...dates];
  for (const [index, token] of tokens.entries()) {
    const rangeStartIndex = rangePairs.has(index)
      ? index
      : [...rangePairs.entries()].find(([, end]) => end === index)?.[0];
    const rangeEndIndex = rangeStartIndex === undefined ? undefined : rangePairs.get(rangeStartIndex);
    const rangeEnd = rangeEndIndex === undefined ? token.end : tokens[rangeEndIndex]?.end ?? token.end;
    const before = text.slice(Math.max(0, token.start - 42), token.start).toLocaleLowerCase("id-ID");
    const beforeContext = text.slice(Math.max(0, token.start - 140), token.start).toLocaleLowerCase("id-ID");
    const after = text.slice(rangeEnd, Math.min(text.length, rangeEnd + 32)).toLocaleLowerCase("id-ID");
    const around = `${before} ${after}`;
    const timeUnit = Object.keys(timeUnits).find((unit) => new RegExp(String.raw`^\s*${unit}\b`, "iu").test(after));
    const countMatch = after.trimStart().match(countUnits);
    const isCurrency = /\b(?:rp|idr)\s*$/iu.test(before) || /^\s*(?:idr|rupiah)\b/iu.test(after);
    const isPercent = /^\s*(?:%|persen\b)/iu.test(after);
    const isPosition = /\b(?:posisi|peringkat|urutan|rank)(?:\s+ke)?\s*$/iu.test(before)
      || /^\s*\b(?:di|ke)-?\s*(?:peringkat|posisi)\b/iu.test(after);
    const isOrdinal = /\b(?:langkah|tahap|step|fase)\s+(?:ke\s*)?[-–]?\s*$/iu.test(before);
    const productLabelRange = productLabelRanges.find((range) => token.start >= range.start && token.end <= range.end);
    const isInterestIndex = /\b(?:indeks(?:\s+minat)?|minat\s+pencarian)\b[^.!?;]{0,120}$/iu.test(beforeContext);
    const profileAmountKind = /\b(?:modal|budget|anggaran|dana)\b/iu.test(around)
      ? "PROFILE_BUDGET"
      : /\b(?:harga|biaya|price|cost)\b/iu.test(around) ? "PROFILE_PRICE" : null;
    const kind: NumericMention["kind"] = isOrdinal
      ? "ORDINAL"
      : productLabelRange
        ? "PRODUCT_LABEL"
        : isCurrency
          ? profileAmountKind ? "PROFILE_AMOUNT" : "CURRENCY"
          : isPercent ? "PERCENT"
            : timeUnit ? "TIME_RANGE"
              : countMatch ? "COUNT"
                : isPosition ? "POSITION"
                  : isInterestIndex ? "INTEREST_INDEX"
                    : profileAmountKind ? "PROFILE_AMOUNT" : "OTHER";
    const unit = kind === "ORDINAL" ? "ORDINAL"
      : kind === "PRODUCT_LABEL" ? "PRODUCT_LABEL"
        : isCurrency ? "IDR"
          : isPercent ? "PERCENT"
            : timeUnit ? timeUnits[timeUnit] ?? null
              : countMatch ? countMatch[0].trim().toLocaleLowerCase("id-ID")
                : isInterestIndex ? "INDEX"
                  : isPosition ? "POSITION" : null;
    mentions.push({
      value: token.value,
      kind,
      unit,
      start: token.start,
      end: token.end,
      isRange: rangeIndexes.has(index),
      ...(rangeStartIndex !== undefined && rangeEndIndex !== undefined
        ? { rangeValues: [tokens[rangeStartIndex]!.value, tokens[rangeEndIndex]!.value] as const }
        : {}),
      ...(productLabelRange ? { productLabelRange } : {}),
    });
  }
  return mentions.sort((left, right) => left.start - right.start).map((mention, spanIndex) => ({ ...mention, spanIndex }));
}

export function containsNumericMention(text: string): boolean {
  return extractNumericMentions(text).length > 0;
}

export function numericMentionValues(text: string): readonly Readonly<{
  value: string;
  kind: NumericMention["kind"];
  unit: string | null;
}>[] {
  return extractNumericMentions(text).map(({ value, kind, unit }) => ({ value, kind, unit }));
}

export function removeNumericSentences(text: string, rejectedSpanIndexes?: readonly number[]): string {
  const mentions = extractNumericMentions(text);
  const rejectedSpans = new Set(rejectedSpanIndexes ?? mentions.map(({ spanIndex }) => spanIndex));
  if (rejectedSpans.size === 0) return text.trim();

  const kept: string[] = [];
  const boundaries = /(?<=[.!?;])\s+|\r?\n+/gu;
  let start = 0;
  for (const match of text.matchAll(boundaries)) {
    const boundaryStart = match.index ?? start;
    const sentence = text.slice(start, boundaryStart);
    const end = boundaryStart;
    const containsRejectedNumber = mentions.some((mention) => rejectedSpans.has(mention.spanIndex)
      && mention.start >= start && mention.end <= end);
    if (sentence.trim() && !containsRejectedNumber) kept.push(sentence.trim());
    start = boundaryStart + match[0].length;
  }

  const remainder = text.slice(start);
  const containsRejectedNumber = mentions.some((mention) => rejectedSpans.has(mention.spanIndex)
    && mention.start >= start && mention.end <= text.length);
  if (remainder.trim() && !containsRejectedNumber) kept.push(remainder.trim());
  return kept.join(" ").replace(/\s+/gu, " ").trim();
}

function hasProfileReference(
  context: OpportunityAnalysisContext,
  references: readonly string[],
  field: OpportunityProfileField,
  subjectId?: string,
): boolean {
  if (!context.dataAvailability.profileFieldsPresent.includes(field)) return false;
  return references.some((reference) => {
    const issuedReference = context.profileReferenceCatalog.find((item) => item.id === reference);
    if (issuedReference) {
      return issuedReference.profileField === field && (!subjectId || issuedReference.subjectId === subjectId);
    }
    return reference === field
      || (field === "profile.products[].price" && reference === "profile.products");
  });
}

function matchesDeclaredProfileNumber(mention: NumericMention, allowedValues: readonly number[]): boolean {
  const normalizedValues = allowedValues.map((value) => normalizedNumber(value));
  if (mention.isRange) {
    return Boolean(mention.rangeValues
      && mention.rangeValues[0] === normalizedValues[0]
      && mention.rangeValues[1] === normalizedValues[1]);
  }
  return normalizedValues.includes(mention.value);
}

function profileNumericSources(context: OpportunityAnalysisContext, mention: NumericMention, text: string, references: readonly string[]): readonly NumericProvenanceCategory[] {
  const descriptor = clauseAtNumericMention(text, mention).toLocaleLowerCase("id-ID");
  const amountValue = mention.value;
  const metric = nearestFinancialMetric(text, mention);
  if ((mention.kind === "PROFILE_AMOUNT" || mention.kind === "CURRENCY")
    && metric === "BUDGET" && /\b(?:modal|budget|anggaran|dana)\b/iu.test(descriptor)
    && context.profile.persona === "ENTREPRENEUR"
    && context.dataAvailability.profileFieldsPresent.includes("profile.budget")
    && hasProfileReference(context, references, "profile.budget")
    && matchesDeclaredProfileNumber(mention, [context.profile.budget.min, context.profile.budget.max])) {
    return ["PROFILE_BUDGET"];
  }

  if ((mention.kind === "PROFILE_AMOUNT" || mention.kind === "CURRENCY")
    && metric === "AVERAGE_BUSINESS_PRICE"
    && /\b(?:harga|price)\b/iu.test(descriptor)
    && context.profile.persona === "UMKM_EXISTING"
    && context.dataAvailability.profileFieldsPresent.includes("profile.averagePrice")
    && hasProfileReference(context, references, "profile.averagePrice")
    && matchesDeclaredProfileNumber(mention, [context.profile.averagePrice.min, context.profile.averagePrice.max])) {
    return ["PROFILE_AVERAGE_PRICE"];
  }

  if (!mention.isRange && (mention.kind === "PROFILE_AMOUNT" || mention.kind === "CURRENCY")
    && metric === "PRODUCT_PRICE"
    && /\b(?:harga|price)\b/iu.test(descriptor)
    && context.profile.persona === "UMKM_EXISTING"
    && context.dataAvailability.profileFieldsPresent.includes("profile.products[].price")
  ) {
    const namedProduct = namedExistingProduct(context, text);
    if (!namedProduct || namedProduct.product.price === null
      || !hasProfileReference(context, references, "profile.products[].price", `profile.products[${namedProduct.index}]`)
      || normalizedNumber(namedProduct.product.price) !== amountValue) return [];
    return ["PROFILE_PRODUCT_PRICE"];
  }
  return [];
}

function profileTextValues(context: OpportunityAnalysisContext, field: OpportunityProfileField): readonly string[] {
  const profile = context.profile;
  switch (field) {
    case "profile.preferredProductType":
      return profile.persona === "ENTREPRENEUR" && profile.preferredProductType ? [profile.preferredProductType] : [];
    case "profile.categories":
      return profile.persona === "ENTREPRENEUR" ? profile.categories : [];
    case "profile.customerSegments":
      return profile.customerSegments;
    case "profile.salesChannels":
      return profile.salesChannels;
    case "profile.location":
      return profile.location ? [profile.location.text, profile.location.city, profile.location.province].filter((value): value is string => Boolean(value)) : [];
    case "profile.experienceLevel":
      return profile.persona === "ENTREPRENEUR" && profile.experienceLevel ? [profile.experienceLevel] : [];
    case "profile.timeCommitment":
      return profile.persona === "ENTREPRENEUR" && profile.timeCommitment ? [profile.timeCommitment] : [];
    case "profile.businessObjective":
      return profile.persona === "ENTREPRENEUR" && profile.businessObjective ? [profile.businessObjective] : [];
    case "profile.notes":
      return profile.notes ? [profile.notes] : [];
    case "profile.businessName":
      return profile.persona === "UMKM_EXISTING" ? [profile.businessName] : [];
    case "profile.businessCategory":
      return profile.persona === "UMKM_EXISTING" ? [profile.businessCategory] : [];
    case "profile.businessDescription":
      return profile.persona === "UMKM_EXISTING" && profile.businessDescription ? [profile.businessDescription] : [];
    case "profile.products":
      return profile.persona === "UMKM_EXISTING" ? profile.products.map(({ name }) => name) : [];
    case "profile.products[].category":
      return profile.persona === "UMKM_EXISTING"
        ? profile.products.flatMap(({ category }) => category ? [category] : [])
        : [];
    case "profile.budget":
    case "profile.averagePrice":
    case "profile.products[].price":
      return [];
  }
}

function referencedProfileTextValues(context: OpportunityAnalysisContext, references: readonly string[]): readonly string[] {
  return references.flatMap((reference) => {
    const issuedReference = context.profileReferenceCatalog.find((item) => item.id === reference);
    if (!issuedReference || issuedReference.metric !== null
      || !context.dataAvailability.profileFieldsPresent.includes(issuedReference.profileField)) return [];
    return profileTextValues(context, issuedReference.profileField);
  });
}

function matchesReferencedProfileNumber(
  context: OpportunityAnalysisContext,
  mention: NumericMention,
  references: readonly string[],
): boolean {
  if (mention.kind === "CURRENCY" || mention.kind === "PROFILE_AMOUNT") return false;
  return referencedProfileTextValues(context, references).some((sourceText) =>
    extractNumericMentions(sourceText).some((sourceMention) =>
      sourceMention.value === mention.value
      && sourceMention.kind === mention.kind
      && sourceMention.unit === mention.unit
      && sourceMention.isRange === mention.isRange
      && (!mention.isRange || (sourceMention.rangeValues?.[0] === mention.rangeValues?.[0]
        && sourceMention.rangeValues?.[1] === mention.rangeValues?.[1]))));
}

function declaredProductLabelSource(
  context: OpportunityAnalysisContext,
  mention: NumericMention,
  text: string,
  references: readonly string[],
): boolean {
  const productLabelRange = mention.productLabelRange;
  if (mention.kind !== "PRODUCT_LABEL" || !productLabelRange) return false;
  const candidates = context.profile.persona === "UMKM_EXISTING"
    ? context.dataAvailability.profileFieldsPresent.includes("profile.products")
      && references.includes("profile.products")
      ? context.profile.products.map((product) => product.name)
      : []
    : context.profile.preferredProductType
      && context.dataAvailability.profileFieldsPresent.includes("profile.preferredProductType")
      && references.includes("profile.preferredProductType")
      ? [context.profile.preferredProductType]
      : [];
  return candidates.some((candidate) => {
    const name = candidate.normalize("NFKC").trim().toLocaleLowerCase("id-ID");
    if (!name) return false;
    const normalizedText = text.normalize("NFKC").toLocaleLowerCase("id-ID");
    let matchStart = normalizedText.indexOf(name);
    while (matchStart >= 0) {
      const matchEnd = matchStart + name.length;
      if (productLabelRange.start >= matchStart && productLabelRange.end <= matchEnd) return true;
      matchStart = normalizedText.indexOf(name, matchStart + 1);
    }
    return false;
  });
}

function isMissingDocumentedTimeRange(text: string, mention: NumericMention, context: OpportunityAnalysisContext): boolean {
  if (mention.kind !== "TIME_RANGE") return false;
  const periodMentions = extractNumericMentions(context.evidence.timeFilter).filter((item) => item.kind === "TIME_RANGE");
  const samePeriod = periodMentions.some((item) => item.value === mention.value && item.unit === mention.unit);
  return samePeriod
    && /\b(?:periode|rentang|filter)\b/iu.test(text)
    && /\b(?:data|informasi|catatan)\b.{0,50}\b(?:belum tersedia|tidak tersedia|belum ada|tidak ada|belum diberikan|tidak diberikan)\b/iu.test(text);
}

function supportedEvidenceNumeric(
  mention: NumericMention,
  text: string,
  evidenceReferences: readonly string[],
  context: OpportunityAnalysisContext,
): NumericProvenanceCategory | null {
  if (mention.isRange) return null;
  const hasEvidenceReference = evidenceReferences.includes(context.evidence.sourceId);
  const evidence = context.evidence;
  const contextWindow = text.slice(Math.max(0, mention.start - 48), Math.min(text.length, mention.end + 40)).toLocaleLowerCase("id-ID");

  if (mention.kind === "INTEREST_INDEX" && hasEvidenceReference
    && evidence.sourceType === "RELATED_QUERY_TOP"
    && evidence.interestIndex !== null && normalizedNumber(evidence.interestIndex) === mention.value) {
    return "GOOGLE_TRENDS_INTEREST_INDEX";
  }
  if (mention.kind === "PERCENT" && hasEvidenceReference
    && evidence.sourceType === "RELATED_QUERY_RISING"
    && !evidence.isBreakout && evidence.growthPercent !== null
    && normalizedNumber(evidence.growthPercent) === mention.value
    && /\b(?:kueri|pencarian|rising|pertumbuhan|minat)\b/iu.test(contextWindow)
    && !financialMetrics.test(contextWindow)) {
    return "GOOGLE_TRENDS_GROWTH_PERCENT";
  }
  if (mention.kind === "TIME_RANGE") {
    const periodMentions = extractNumericMentions(evidence.timeFilter).filter((item) => item.kind === "TIME_RANGE");
    if (periodMentions.some((period) => period.value === mention.value && period.unit === mention.unit)
      && /\b(?:periode|rentang|filter|searchapi|google trends|kueri pencarian|dalam|selama|untuk|terakhir)\b/iu.test(contextWindow)
      && (hasEvidenceReference || isMissingDocumentedTimeRange(text, mention, context))) {
      return "GOOGLE_TRENDS_TIME_RANGE";
    }
  }
  if (mention.kind === "DATE" && hasEvidenceReference
    && mention.value === evidence.retrievedAt.slice(0, 10)
    && /\b(?:diambil|diperoleh|retrieval|tanggal sumber|tanggal bukti)\b/iu.test(contextWindow)) {
    return "GOOGLE_TRENDS_RETRIEVAL_DATE";
  }
  if (mention.kind === "POSITION" && hasEvidenceReference
    && evidence.position !== null && normalizedNumber(evidence.position) === mention.value) {
    return "GOOGLE_TRENDS_POSITION";
  }
  return null;
}

function expectedNumericMetricCategory(
  mention: NumericMention,
  text: string,
): NumericProvenanceCategory {
  const contextWindow = clauseAtNumericMention(text, mention).toLocaleLowerCase("id-ID");
  if (financialMetrics.test(contextWindow)) return "UNSUPPORTED_BUSINESS_CLAIM";
  if (mention.kind === "INTEREST_INDEX") return "GOOGLE_TRENDS_INTEREST_INDEX";
  if (mention.kind === "PERCENT") {
    return /\b(?:kueri|pencarian|rising|pertumbuhan|minat)\b/iu.test(contextWindow)
      ? "GOOGLE_TRENDS_GROWTH_PERCENT"
      : "OTHER_CONTEXTUAL_NUMBER";
  }
  if (mention.kind === "TIME_RANGE") return "GOOGLE_TRENDS_TIME_RANGE";
  if (mention.kind === "DATE") return "GOOGLE_TRENDS_RETRIEVAL_DATE";
  if (mention.kind === "POSITION") return "GOOGLE_TRENDS_POSITION";
  if (mention.kind === "PROFILE_AMOUNT" || mention.kind === "CURRENCY") {
    if (/\b(?:modal|budget|anggaran|dana)\b/iu.test(contextWindow)) return "PROFILE_BUDGET";
    if (/\b(?:harga\s+rata-rata|average\s+(?:business\s+)?price)\b/iu.test(contextWindow)) return "PROFILE_AVERAGE_PRICE";
    if (/\b(?:harga|price)\b/iu.test(contextWindow)) return "PROFILE_PRODUCT_PRICE";
    return "UNSUPPORTED_BUSINESS_CLAIM";
  }
  return "OTHER_CONTEXTUAL_NUMBER";
}

function validateNumericMention(
  field: string,
  mention: NumericMention,
  text: string,
  references: readonly string[],
  evidenceReferences: readonly string[],
  outcome: GeneratedOpportunityResult["outcome"],
  context: OpportunityAnalysisContext,
): NumericAssessment {
  const unitClassification = mention.kind;
  const futureAction = describesProspectiveAction(field, text, mention);
  const profileSources = profileNumericSources(context, mention, text, references);
  const accepted = (semanticCategory: NumericSemanticCategory, verifiedSourceMatch = false): NumericAssessment => ({
    semanticCategory,
    futureAction: futureAction || semanticCategory === "PROPOSED_EXPERIMENT_PARAMETER" || semanticCategory === "MISSING_EVIDENCE_REQUIREMENT",
    verifiedSourceMatch,
    unitClassification,
  });
  const rejected = (
    rejection: NumericGroundingDiagnostic["rejectedRule"],
    semanticCategory: NumericSemanticCategory,
    reason: NumericGroundingDiagnostic["reason"],
  ): NumericAssessment => ({
    semanticCategory,
    futureAction,
    verifiedSourceMatch: false,
    unitClassification,
    rejection,
    reason,
    ...(rejection === "UNSUPPORTED_FINANCIAL_CLAIM"
      ? { financialSource: financialSourceDiagnostic(context, mention, text, references, profileSources.length > 0) }
      : {}),
  });

  const timeGap = outcome === "INSUFFICIENT_EVIDENCE" && isMissingDocumentedTimeRange(text, mention, context);
  if (timeGap) return accepted("MISSING_EVIDENCE_REQUIREMENT", true);
  const semanticText = clauseAtNumericMention(text, mention).toLocaleLowerCase("id-ID");
  const financialAssertion = financialMetrics.test(semanticText);
  const financialAmountContext = /(?:\b(?:rp|idr)\b|\b(?:rupiah|modal|budget|anggaran|dana|harga|biaya|price|cost)\b)/iu.test(semanticText);
  if (isProspectiveExperimentParameter(context, field, text, mention)) {
    return accepted("PROPOSED_EXPERIMENT_PARAMETER");
  }
  if ((financialAssertion || financialAmountContext) && mention.kind !== "TIME_RANGE" && mention.kind !== "DATE") {
    const financialSourceAllowed = profileSources.length > 0 && /\b(?:harga|biaya|cost|price|modal|budget|anggaran|dana)\b/iu.test(semanticText);
    if (!financialSourceAllowed) return rejected("UNSUPPORTED_FINANCIAL_CLAIM", "UNSUPPORTED_FINANCIAL_CLAIM", "FINANCIAL_CLAIM_WITHOUT_MATCHING_SOURCE");
  }
  if (profileSources.length > 0) return accepted("DECLARED_PROFILE_FACT", true);
  if (/^ideas\[\d+\]\.profileAlignment\[\d+\]$/u.test(field)
    && !financialAssertion && !financialAmountContext && !financialMetricForText(semanticText)
    && matchesReferencedProfileNumber(context, mention, references)) {
    return accepted("DECLARED_PROFILE_FACT", true);
  }
  if (supportedEvidenceNumeric(mention, text, evidenceReferences, context)) return accepted("VERIFIED_SOURCE_FACT", true);
  if (isSequentialOrdinal(field, mention)) return accepted("ORDINAL_OR_PRODUCT_LABEL");
  if (declaredProductLabelSource(context, mention, text, references)) return accepted("ORDINAL_OR_PRODUCT_LABEL", true);
  if (futureAction && isDataCollectionRequirement(text, mention)) return accepted("DATA_COLLECTION_REQUIREMENT");
  if (mention.kind === "COUNT") return rejected("UNSUPPORTED_METRIC_CLAIM", "UNSUPPORTED_EMPIRICAL_CLAIM", "UNSUPPORTED_COUNT_CLAIM");
  if (hasAffirmativeFinancialAssertion(text) && mention.kind !== "TIME_RANGE" && mention.kind !== "DATE") {
    return rejected("UNSUPPORTED_FINANCIAL_CLAIM", "UNSUPPORTED_FINANCIAL_CLAIM", "UNSUPPORTED_FINANCIAL_ASSERTION");
  }
  if (mention.kind === "TIME_RANGE" || mention.kind === "DATE") {
    return rejected("UNSUPPORTED_NUMBER", "AMBIGUOUS_NUMERIC_STATEMENT", "NO_SOURCE_OR_PROSPECTIVE_CONTEXT");
  }
  return financialAssertion || financialAmountContext
    ? rejected("UNSUPPORTED_FINANCIAL_CLAIM", "UNSUPPORTED_FINANCIAL_CLAIM", "FINANCIAL_CLAIM_WITHOUT_MATCHING_SOURCE")
    : rejected("UNSUPPORTED_NUMBER", "AMBIGUOUS_NUMERIC_STATEMENT", "AMBIGUOUS_NUMERIC_MEANING");
}

function visibleTextFields(
  value: z.infer<typeof generatedOpportunityHypothesisSchema>,
  index: number,
): readonly (readonly [string, string, readonly string[]])[] {
  const profileReferences = value.profileReferences;
  return [
    [`ideas[${index}].title`, value.title, profileReferences],
    [`ideas[${index}].concept`, value.concept, profileReferences],
    [`ideas[${index}].targetCustomer`, value.targetCustomer, profileReferences],
    [`ideas[${index}].evidenceInterpretation`, value.evidenceInterpretation, profileReferences],
    ...value.profileAlignment.map((item, itemIndex) => [
      `ideas[${index}].profileAlignment[${itemIndex}]`, item.rationale, item.supportingProfileRefs,
    ] as const),
    ...value.limitations.map((text, itemIndex) => [`ideas[${index}].limitations[${itemIndex}]`, text, profileReferences] as const),
    ...value.validationSteps.map((text, itemIndex) => [`ideas[${index}].validationSteps[${itemIndex}]`, text, profileReferences] as const),
    ...value.assumptions.map((text, itemIndex) => [`ideas[${index}].assumptions[${itemIndex}]`, text, profileReferences] as const),
  ];
}

function profileProductReferenceExists(context: OpportunityAnalysisContext, reference: string): reference is OpportunityProfileField {
  return context.dataAvailability.profileFieldsPresent.some((field) => field === reference);
}

export function validateGeneratedOpportunityResult(
  generated: GeneratedOpportunityResult,
  context: OpportunityAnalysisContext,
): OpportunityGroundingFailure | null {
  const rejectedNumbers: Array<{
    field: string;
    semanticCategory: NumericSemanticCategory;
    rejection: "UNSUPPORTED_NUMBER" | "UNSUPPORTED_FINANCIAL_CLAIM" | "UNSUPPORTED_METRIC_CLAIM";
    numericDiagnostic?: NumericGroundingDiagnostic;
    financialMetric?: FinancialMetric;
    financialEvidenceAvailable?: boolean;
    isMissingDataDescription?: boolean;
    claimClassification?: FinancialClaimClassification;
  }> = [];
  const rejectedGuarantees: string[] = [];
  const invalidEvidenceGapReferences: string[] = [];
  const invalidProfileReferenceFields: string[] = [];
  const eligibleGapIds = new Set(context.financialEvidenceAvailability.eligibleGaps.map((item) => item.id));
  if (generated.outcome === "HYPOTHESES") {
    for (const [ideaIndex, idea] of generated.ideas.entries()) {
      if (new Set(idea.evidenceGapIds).size !== idea.evidenceGapIds.length
        || idea.evidenceGapIds.some((gapId) => !eligibleGapIds.has(gapId))) {
        invalidEvidenceGapReferences.push(`ideas[${ideaIndex}].evidenceGapIds`);
      }
    }
  }
  const allText: readonly (readonly [string, string, readonly string[]])[] = generated.outcome === "INSUFFICIENT_EVIDENCE"
    ? [["insufficientEvidence[0]", generated.reason, []], ...generated.limitations.map((text, index) => [`insufficientEvidence[${index + 1}]`, text, []] as const)]
    : generated.ideas.flatMap((idea, index) => visibleTextFields(idea, index));

  for (const [field, value, profileReferences] of allText) {
    if (guarantees.test(value)) rejectedGuarantees.push(field);
    const ideaIndex = /^ideas\[(\d+)\]/u.exec(field)?.[1];
    const idea = ideaIndex === undefined || generated.outcome === "INSUFFICIENT_EVIDENCE"
      ? null
      : generated.ideas[Number(ideaIndex)];
    const evidenceReferences = idea?.evidenceReferences ?? [];
    const mentions = extractNumericMentions(value);
    const financialMetadata = financialDiagnosticMetadata(value, context, mentions.length > 0);
    if (financialMetadata.isMissingDataDescription && financialMetadata.financialEvidenceAvailable) {
      rejectedNumbers.push({
        field,
        semanticCategory: "UNSUPPORTED_FINANCIAL_CLAIM",
        rejection: "UNSUPPORTED_FINANCIAL_CLAIM",
        ...financialMetadata,
        claimClassification: "PROFILE_VALUE_MISSTATED_AS_MISSING",
      });
    }
    for (const mention of mentions) {
      const assessment = validateNumericMention(field, mention, value, profileReferences, evidenceReferences, generated.outcome, context);
      if (assessment.rejection) rejectedNumbers.push({
        field,
        semanticCategory: assessment.semanticCategory,
        rejection: assessment.rejection,
        numericDiagnostic: {
          fieldPath: field,
          rejectedRule: assessment.rejection,
          semanticCategory: assessment.semanticCategory,
          expectedMetricCategory: expectedNumericMetricCategory(mention, value),
          futureAction: assessment.futureAction,
          verifiedSourceMatch: assessment.verifiedSourceMatch,
          unitClassification: assessment.unitClassification,
          spanIndex: mention.spanIndex,
          reason: assessment.reason ?? "AMBIGUOUS_NUMERIC_MEANING",
          ...(assessment.financialSource ?? {}),
        },
        ...(assessment.rejection === "UNSUPPORTED_FINANCIAL_CLAIM" ? financialDiagnosticMetadata(value, context, true, mention) : {}),
      });
    }
    if (hasAffirmativeFinancialAssertion(value)
      && !rejectedNumbers.some((item) => item.field === field && item.rejection === "UNSUPPORTED_FINANCIAL_CLAIM")) {
      rejectedNumbers.push({
        field,
        semanticCategory: "UNSUPPORTED_FINANCIAL_CLAIM",
        rejection: "UNSUPPORTED_FINANCIAL_CLAIM",
        ...financialDiagnosticMetadata(value, context, mentions.length > 0),
      });
    }
  }

  if (generated.outcome === "HYPOTHESES") {
    const issuedProfileReferenceIds = new Set(context.profileReferenceCatalog.map((item) => item.id));
    for (const [index, idea] of generated.ideas.entries()) {
      const invalidReferences = idea.profileAlignment.some((alignment) =>
        new Set(alignment.supportingProfileRefs).size !== alignment.supportingProfileRefs.length
        || alignment.supportingProfileRefs.some((reference) => !issuedProfileReferenceIds.has(reference)),
      );
      if (invalidReferences) invalidProfileReferenceFields.push(`ideas[${index}].profileAlignment`);
    }
  }

  if (rejectedGuarantees.length > 0) return { rejectedRule: "UNSUPPORTED_GUARANTEE", fields: rejectedGuarantees.slice(0, 12) };
  const firstFinancial = rejectedNumbers.find((item) => item.rejection === "UNSUPPORTED_FINANCIAL_CLAIM");
  if (firstFinancial) return {
    rejectedRule: "UNSUPPORTED_FINANCIAL_CLAIM",
    fields: [...new Set(rejectedNumbers.filter((item) => item.rejection === "UNSUPPORTED_FINANCIAL_CLAIM").map((item) => item.field))].slice(0, 12),
    semanticCategory: firstFinancial.semanticCategory,
    numericDiagnostics: rejectedNumbers.flatMap((item) => item.rejection === "UNSUPPORTED_FINANCIAL_CLAIM" && item.numericDiagnostic ? [item.numericDiagnostic] : []).slice(0, 12),
    sourceCategory: context.evidence.sourceType,
    sourceReference: context.evidence.sourceId,
    ...(firstFinancial.financialMetric ? { financialMetric: firstFinancial.financialMetric } : {}),
    ...(firstFinancial.financialEvidenceAvailable !== undefined ? { financialEvidenceAvailable: firstFinancial.financialEvidenceAvailable } : {}),
    ...(firstFinancial.isMissingDataDescription !== undefined ? { isMissingDataDescription: firstFinancial.isMissingDataDescription } : {}),
    ...(firstFinancial.claimClassification ? { claimClassification: firstFinancial.claimClassification } : {}),
  };
  const firstMetric = rejectedNumbers.find((item) => item.rejection === "UNSUPPORTED_METRIC_CLAIM");
  if (firstMetric) return {
    rejectedRule: "UNSUPPORTED_METRIC_CLAIM",
    fields: [...new Set(rejectedNumbers.filter((item) => item.rejection === "UNSUPPORTED_METRIC_CLAIM").map((item) => item.field))].slice(0, 12),
    semanticCategory: firstMetric.semanticCategory,
    numericDiagnostics: rejectedNumbers.flatMap((item) => item.rejection === "UNSUPPORTED_METRIC_CLAIM" && item.numericDiagnostic ? [item.numericDiagnostic] : []).slice(0, 12),
    sourceCategory: context.evidence.sourceType,
    sourceReference: context.evidence.sourceId,
  };
  const firstNumber = rejectedNumbers.find((item) => item.rejection === "UNSUPPORTED_NUMBER");
  if (firstNumber) return {
    rejectedRule: "UNSUPPORTED_NUMBER",
    fields: [...new Set(rejectedNumbers.filter((item) => item.rejection === "UNSUPPORTED_NUMBER").map((item) => item.field))].slice(0, 12),
    semanticCategory: firstNumber.semanticCategory,
    numericDiagnostics: rejectedNumbers.flatMap((item) => item.rejection === "UNSUPPORTED_NUMBER" && item.numericDiagnostic ? [item.numericDiagnostic] : []).slice(0, 12),
    sourceCategory: context.evidence.sourceType,
    sourceReference: context.evidence.sourceId,
  };
  if (invalidProfileReferenceFields.length > 0) {
    return { rejectedRule: "INVALID_PROFILE_REFERENCE", fields: invalidProfileReferenceFields.slice(0, 12) };
  }
  if (invalidEvidenceGapReferences.length > 0) {
    return { rejectedRule: "INVALID_EVIDENCE_GAP_REFERENCE", fields: invalidEvidenceGapReferences.slice(0, 12) };
  }
  if (generated.outcome === "INSUFFICIENT_EVIDENCE") return null;

  const allowedProfileFields = new Set(context.dataAvailability.profileFieldsPresent);
  for (const [index, idea] of generated.ideas.entries()) {
    const allowedTypes = context.profile.persona === "ENTREPRENEUR" ? entrepreneurOpportunityTypes : umkmOpportunityTypes;
    if (!allowedTypes.has(idea.opportunityType)) return { rejectedRule: "PERSONA_MISMATCH", fields: [`ideas[${index}].opportunityType`] };

    const invalidProfileReferences = idea.profileReferences.filter((reference) => !profileProductReferenceExists(context, reference) || !allowedProfileFields.has(reference));
    if (invalidProfileReferences.length > 0) return { rejectedRule: "INVALID_PROFILE_REFERENCE", fields: [`ideas[${index}].profileReferences`] };

    if (idea.evidenceReferences.length === 0 || idea.evidenceReferences.some((reference) => reference !== context.evidence.sourceId)) {
      return { rejectedRule: "INVALID_EVIDENCE_REFERENCE", fields: [`ideas[${index}].evidenceReferences`] };
    }

    if (context.profile.persona === "UMKM_EXISTING" && idea.opportunityType === "NEW_MENU") {
      const proposedText = `${idea.title} ${idea.concept}`.toLocaleLowerCase("id-ID");
      const repeatsProduct = context.profile.products.some((product) => {
        const name = product.name.toLocaleLowerCase("id-ID");
        return name.length > 2 && proposedText.includes(name);
      });
      if (repeatsProduct && !/\b(varian|kemasan|kanal|saluran|segmen|positioning|posisi produk|bundling|fulfillment|cara penyajian|jalur distribusi|penawaran)\b/iu.test(proposedText)) {
        return { rejectedRule: "EXISTING_PRODUCT_AS_NEW_MENU", fields: [`ideas[${index}].concept`] };
      }
    }
  }
  return null;
}
