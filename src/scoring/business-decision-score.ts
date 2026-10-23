import type { BusinessAnalysis, BusinessRequirements } from "../opportunity/business-analysis-contract";
import type { AnalysisFactor, CompetitorSample, TrendStatistics } from "../opportunity/entrepreneur-analysis-contract";
import { aggregateAnalysisScore } from "./entrepreneur-decision-score";

export type BusinessSelections = { categoryIds: readonly string[]; segmentIds: readonly string[]; channelIds: readonly string[]; averagePrice: { min: number; max: number } };
const overlap = (required: readonly string[], actual: readonly string[]) => required.length && actual.length ? 100 * required.filter(id => actual.includes(id)).length / required.length : null;
const factor = (key: string, label: string, weight: number, value: number | null, basis: AnalysisFactor["basis"], reason: string): AnalysisFactor => ({ key, label, weight, value: value === null ? null : Math.round(value * 100) / 100, basis: value === null ? "MISSING" : basis, reason });

export function calculateBusinessDecision(input: { selections: BusinessSelections; requirements: BusinessRequirements | null; proposedPrice: BusinessAnalysis["proposedPrice"]; trend: TrendStatistics | null; competitors: CompetitorSample | null; fallbackInterest: number | null }) {
  const { selections: s, requirements: r, trend: t, competitors: c } = input;
  const recent = t?.recentMean ?? null, prior = t?.previousMean ?? null;
  const consumer = r ? overlap(r.customerSegmentIds, s.segmentIds) : null;
  const execution = r?.complexity ? { SIMPLE: 100, STANDARD: 60, COMPLEX: 25 }[r.complexity] : null;
  const opportunity = aggregateAnalysisScore([
    factor("trendMomentum", "Momentum pencarian", .25, t && t.spanDays >= 150 && recent !== null && prior !== null && recent + prior > 0 ? 100 * recent / (recent + prior) : null, "MARKET", "Perbandingan dua jendela dalam satu seri; bukan pertumbuhan penjualan."),
    factor("demandSignal", "Minat pencarian relatif", .2, recent ?? input.fallbackInterest, "MARKET", "Indeks relatif histori atau Top historis; bukan ukuran pasar."),
    factor("competition", "Tekanan sampel kompetitor", .15, c && c.sampleCount > 0 ? 100 / (1 + c.sampleCount / 5) : null, "MARKET", "Sampel listing lokal terbatas; sampel nol tetap unknown."),
    factor("consumerRelevance", "Kesesuaian target konsumen", .15, consumer, "PROFILE_ALIGNMENT", "Proporsi segmen usulan yang ada di profil; bukan validasi pembeli."),
    factor("executionFeasibility", "Kemudahan pelaksanaan", .15, execution, "MODEL_ASSUMPTION", "Rubrik kompleksitas AI: SIMPLE 100, STANDARD 60, COMPLEX 25; perlu diuji."),
    factor("marketSustainability", "Kestabilan pencarian", .1, t && t.count >= 40 && t.observedMonths >= 10 && t.spanDays >= 270 && t.positiveFraction !== null && t.coefficientOfVariation !== null ? 100 * t.positiveFraction / (1 + t.coefficientOfVariation) : null, "MARKET", "Kestabilan indeks, bukan daya tahan usaha."),
  ]);
  const price = input.proposedPrice;
  const fit = aggregateAnalysisScore([
    factor("productFit", "Product Fit · proxy kategori", .25, r?.categoryId && s.categoryIds.length ? (s.categoryIds.includes(r.categoryId) ? 100 : 0) : null, "PROFILE_ALIGNMENT", "Kategori produk aktif atau kategori bisnis sebagai proxy; bukan evaluasi produk menyeluruh."),
    factor("customerFit", "Customer Fit", .25, consumer, "PROFILE_ALIGNMENT", "Proporsi segmen konsep yang cocok dengan pelanggan profil."),
    factor("channelFit", "Channel Fit", .2, r ? overlap(r.salesChannelIds, s.channelIds) : null, "PROFILE_ALIGNMENT", "Proporsi kanal konsep yang sudah tercatat pada bisnis."),
    factor("priceFit", "Price Fit", .3, price ? (price.max >= s.averagePrice.min && price.min <= s.averagePrice.max ? 100 : 0) : null, "USER_ESTIMATE", "Overlap rentang harga konsep yang Anda isi dengan rentang bisnis; bukan willingness to pay atau margin."),
  ]);
  const conflicts = fit.factors.filter(f => f.value !== null && f.value < 100);
  const complete = fit.factors.every(f => f.value !== null);
  const level: BusinessAnalysis["risk"]["level"] = r?.complexity === "COMPLEX" || conflicts.length >= 2 ? "HIGH" : conflicts.length ? "MEDIUM" : complete && r?.complexity === "SIMPLE" ? "LOW" : "UNKNOWN";
  const reasons = conflicts.map(f => `${f.label} belum sepenuhnya cocok dengan kondisi bisnis yang dicatat.`);
  if (r?.complexity === "COMPLEX") reasons.push("Pelaksanaan konsep diperkirakan kompleks; validasi kapasitas operasional terlebih dahulu.");
  if (!reasons.length) reasons.push(level === "LOW" ? "Empat faktor cocok dan konsep diperkirakan sederhana; risiko pasar serta finansial tetap belum terukur." : "Bukti belum cukup untuk menetapkan tingkat risiko pelaksanaan.");
  reasons.push("Operational Fit, Brand Fit, biaya, margin, dan respons pembeli belum dinilai; label bukan risiko usaha keseluruhan.");
  return { opportunity, fit, risk: { level, reasons: reasons.slice(0, 6) } };
}
