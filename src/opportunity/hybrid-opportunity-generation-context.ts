import "server-only";

import {
  opportunityFactCatalogSchema,
  type OpportunityFact,
  type OpportunityFactCatalog,
} from "./opportunity-fact-catalog";
import type { OpportunityAnalysisContext } from "./opportunity-analysis-context";

export const HYBRID_OPPORTUNITY_ANALYSIS_VERSION = "hybrid-opportunity-analysis-v12" as const;

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
    profileAvailability: { missing: context.dataAvailability.profileFieldsMissing },
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
    facts: {
      PROFILE: catalog.facts.filter((fact) => fact.sourceType === "PROFILE").map((fact) => [fact.id, fact.metric, fact.subject.label, compactValue(fact.value)]),
      SEARCHAPI: catalog.facts.filter((fact) => fact.sourceType === "SEARCHAPI").map((fact) => [fact.id, fact.metric, fact.subject.label, compactValue(fact.value)]),
    },
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
