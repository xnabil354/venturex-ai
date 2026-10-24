import { z } from "zod";

import type { OpportunityAnalysisContext } from "./opportunity-analysis-context";
import {
  generatedOpportunityResultSchema,
  removeNumericSentences,
  type OpportunityGroundingFailure,
} from "./opportunity-analysis-validation";

const normalizedUnsupportedAssumption = "Minat dan keputusan pembelian segmen sasaran belum diketahui; validasi melalui wawancara dan uji penawaran sebelum peluncuran.";
const normalizableAssumptionRejections = new Set<OpportunityGroundingFailure["rejectedRule"]>([
  "UNSUPPORTED_NUMBER",
  "UNSUPPORTED_FINANCIAL_CLAIM",
  "UNSUPPORTED_METRIC_CLAIM",
  "UNSUPPORTED_GUARANTEE",
]);

export function normalizeRejectedAssumptions(
  result: z.infer<typeof generatedOpportunityResultSchema>,
  failure: OpportunityGroundingFailure,
): Readonly<{ result: z.infer<typeof generatedOpportunityResultSchema>; normalizedCount: number }> | null {
  if (result.outcome !== "HYPOTHESES"
    || !normalizableAssumptionRejections.has(failure.rejectedRule)
    || failure.fields.length === 0) return null;

  const affectedAssumptions = new Map<number, Set<number>>();
  for (const field of failure.fields) {
    const match = /^ideas\[(\d+)\]\.assumptions\[(\d+)\]$/u.exec(field);
    if (!match) return null;
    const ideaIndex = Number(match[1]);
    const assumptionIndex = Number(match[2]);
    const idea = result.ideas[ideaIndex];
    if (!idea || !idea.assumptions[assumptionIndex]) return null;
    const indices = affectedAssumptions.get(ideaIndex) ?? new Set<number>();
    indices.add(assumptionIndex);
    affectedAssumptions.set(ideaIndex, indices);
  }

  const normalizedCount = [...affectedAssumptions.values()].reduce((total, indices) => total + indices.size, 0);
  const ideas = result.ideas.map((idea, ideaIndex) => {
    const indices = affectedAssumptions.get(ideaIndex);
    if (!indices) return idea;
    return {
      ...idea,
      assumptions: idea.assumptions.map((assumption, index) => indices.has(index) ? normalizedUnsupportedAssumption : assumption),
    };
  });
  const parsed = generatedOpportunityResultSchema.safeParse({ ...result, ideas });
  return parsed.success ? { result: parsed.data, normalizedCount } : null;
}

export function normalizeRejectedNumericSentences(
  result: z.infer<typeof generatedOpportunityResultSchema>,
  failure: OpportunityGroundingFailure,
  context: OpportunityAnalysisContext,
): Readonly<{ result: z.infer<typeof generatedOpportunityResultSchema>; normalizedFieldCount: number }> | null {
  if (result.outcome !== "HYPOTHESES" || failure.rejectedRule !== "UNSUPPORTED_NUMBER" || !failure.numericDiagnostics?.length) return null;

  const rejectedSpansByField = new Map<string, Set<number>>();
  for (const diagnostic of failure.numericDiagnostics) {
    if (diagnostic.rejectedRule !== "UNSUPPORTED_NUMBER") continue;
    const spans = rejectedSpansByField.get(diagnostic.fieldPath) ?? new Set<number>();
    spans.add(diagnostic.spanIndex);
    rejectedSpansByField.set(diagnostic.fieldPath, spans);
  }
  if (rejectedSpansByField.size === 0) return null;

  const queryWords = context.evidence.selectedQuery
    .normalize("NFKC")
    .replace(/\p{N}+/gu, " ")
    .replace(/[^\p{L}\p{M}\s-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const fallbackTitle = `Peluang ${queryWords || "kuliner lokal"}`.slice(0, 140);
  let normalizedFieldCount = 0;
  const normalizeText = (field: string, value: string, minimumLength: number, fallback: string): string => {
    const spans = rejectedSpansByField.get(field);
    if (!spans) return value;
    const cleaned = removeNumericSentences(value, [...spans]);
    normalizedFieldCount += 1;
    return cleaned.length >= minimumLength ? cleaned : fallback;
  };

  const ideas = result.ideas.map((idea, ideaIndex) => ({
    ...idea,
    title: normalizeText(`ideas[${ideaIndex}].title`, idea.title, 4, fallbackTitle),
    concept: normalizeText(`ideas[${ideaIndex}].concept`, idea.concept, 20,
      "Uji penawaran produk pada segmen sasaran yang tercatat di profil."),
    targetCustomer: normalizeText(`ideas[${ideaIndex}].targetCustomer`, idea.targetCustomer, 8,
      "Segmen pelanggan yang tercatat pada profil dan perlu diuji langsung."),
    evidenceInterpretation: normalizeText(`ideas[${ideaIndex}].evidenceInterpretation`, idea.evidenceInterpretation, 12,
      "Sinyal pencarian memberi arah pengujian, tetapi belum membuktikan pembelian."),
    profileAlignment: idea.profileAlignment.map((alignment, alignmentIndex) => ({
      ...alignment,
      rationale: normalizeText(`ideas[${ideaIndex}].profileAlignment[${alignmentIndex}]`, alignment.rationale, 8,
        "Kecocokan ini dirumuskan dari fakta profil yang diverifikasi server."),
    })),
    validationSteps: idea.validationSteps.map((step, stepIndex) => normalizeText(
      `ideas[${ideaIndex}].validationSteps[${stepIndex}]`, step, 8, "Uji penawaran kepada calon pelanggan.",
    )),
    assumptions: idea.assumptions.map((assumption, assumptionIndex) => normalizeText(
      `ideas[${ideaIndex}].assumptions[${assumptionIndex}]`, assumption, 8, normalizedUnsupportedAssumption,
    )),
    limitations: idea.limitations.map((limitation, limitationIndex) => normalizeText(
      `ideas[${ideaIndex}].limitations[${limitationIndex}]`, limitation, 8,
      "Data minat pencarian belum membuktikan pembelian atau kelayakan usaha.",
    )),
  }));
  const parsed = generatedOpportunityResultSchema.safeParse({ ...result, ideas });
  return parsed.success ? { result: parsed.data, normalizedFieldCount } : null;
}

