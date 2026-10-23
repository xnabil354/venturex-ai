import type { EntrepreneurOpportunityProfileContext } from "../opportunity/opportunity-analysis-context";
import type { EntrepreneurRequirements, AnalysisFactor, AnalysisScore, TrendStatistics, CompetitorSample } from "../opportunity/entrepreneur-analysis-contract";
import type { TrendTimeSeries } from "../trend/trend-radar-interest-contract";

const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

export function summarizeTrend(series: TrendTimeSeries, geo: string, retrievedAt: string): TrendStatistics {
  const points = [...new Map(series.points.filter(point => point.interestIndex !== null && Number.isFinite(point.interestIndex) && point.interestIndex >= 0 && point.interestIndex <= 100).map(point => [point.timestamp, point])).values()].sort((a, b) => a.timestamp - b.timestamp);
  const end = points.at(-1)?.timestamp ?? 0;
  const quarter = 91 * 86_400;
  const recent = points.filter(point => point.timestamp > end - quarter).map(point => point.interestIndex!);
  const previous = points.filter(point => point.timestamp > end - 2 * quarter && point.timestamp <= end - quarter).map(point => point.interestIndex!);
  const values = points.map(point => point.interestIndex!);
  const average = values.length ? mean(values) : 0;
  return {
    query: series.query, geo, period: "1y", retrievedAt, count: points.length,
    observedMonths: new Set(points.map(point => { const day = new Date(point.timestamp * 1000); return day.getUTCFullYear() * 12 + day.getUTCMonth(); })).size,
    spanDays: points.length > 1 ? (end - points[0]!.timestamp) / 86_400 : 0,
    recentMean: recent.length >= 4 ? mean(recent) : null,
    previousMean: previous.length >= 4 ? mean(previous) : null,
    positiveFraction: values.length ? values.filter(value => value > 0).length / values.length : null,
    coefficientOfVariation: average > 0 ? Math.sqrt(mean(values.map(value => (value - average) ** 2))) / average : null,
  };
}

export function aggregateAnalysisScore(factors: readonly AnalysisFactor[]): AnalysisScore {
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  if (Math.abs(totalWeight - 1) > 1e-10 || factors.some(factor => !Number.isFinite(factor.weight) || factor.weight < 0 || (factor.value !== null && (!Number.isFinite(factor.value) || factor.value < 0 || factor.value > 100)))) throw new Error("INVALID_ANALYSIS_FACTORS");
  const known = factors.filter(factor => factor.value !== null);
  const coverage = known.reduce((sum, factor) => sum + factor.weight, 0);
  // A single perfect search index must never become a perfect overall score.
  const enough = coverage >= 0.6 - 1e-10 && known.length >= 3;
  return {
    score: enough ? rounded(known.reduce((sum, factor) => sum + factor.value! * factor.weight, 0) / coverage) : null,
    coverage: rounded(coverage * 100), status: enough ? "PRELIMINARY" : "INSUFFICIENT_DATA", factors: [...factors],
  };
}

type ProfileSelections = { categoryIds: readonly string[]; segmentIds: readonly string[]; channelIds: readonly string[] };
const overlap = (required: readonly string[], available: readonly string[]) => required.length && available.length ? 100 * required.filter(id => available.includes(id)).length / required.length : null;
const ordinal = (available: string | null, required: string | null, levels: readonly string[]) => {
  if (!available || !required || !levels.includes(available) || !levels.includes(required)) return null;
  return Math.max(0, 100 - Math.max(0, levels.indexOf(required) - levels.indexOf(available)) * 50);
};
function factor(key: string, label: string, weight: number, value: number | null, basis: AnalysisFactor["basis"], reason: string): AnalysisFactor {
  return { key, label, weight, value: value === null ? null : rounded(value), basis: value === null ? "MISSING" : basis, reason };
}

export function calculateEntrepreneurDecision(input: {
  profile: EntrepreneurOpportunityProfileContext; selections: ProfileSelections;
  requirements: EntrepreneurRequirements | null; capitalMin: number | null;
  trend: TrendStatistics | null; competitors: CompetitorSample | null; fallbackInterest: number | null;
}): { opportunity: AnalysisScore; fit: AnalysisScore; risks: string[] } {
  const { profile, selections, requirements: req, trend, competitors, capitalMin } = input;
  const recent = trend?.recentMean ?? null;
  const previous = trend?.previousMean ?? null;
  const momentum = recent !== null && previous !== null && trend && trend.spanDays >= 150 && recent + previous > 0 ? 100 * recent / (recent + previous) : null;
  const demand = recent ?? (input.fallbackInterest !== null && input.fallbackInterest >= 0 && input.fallbackInterest <= 100 ? input.fallbackInterest : null);
  const sustainability = trend && trend.count >= 40 && trend.observedMonths >= 10 && trend.spanDays >= 270 && trend.positiveFraction !== null && trend.coefficientOfVariation !== null ? 100 * trend.positiveFraction / (1 + trend.coefficientOfVariation) : null;
  const consumer = req ? overlap(req.customerSegmentIds, selections.segmentIds) : null;
  const execution = req?.complexity ? { SIMPLE: 100, STANDARD: 60, COMPLEX: 25 }[req.complexity] : null;
  const competition = competitors && competitors.sampleCount > 0 ? 100 / (1 + competitors.sampleCount / 5) : null;
  const opportunity = aggregateAnalysisScore([
    factor("trendMomentum", "Arah pertumbuhan pencarian", 0.25, momentum, "MARKET", "Perbandingan rata-rata indeks dua periode berurutan pada satu seri; stabil bernilai 50."),
    factor("demandSignal", "Minat pencarian relatif", 0.2, demand, "MARKET", recent !== null ? "Rata-rata indeks periode terkini dalam histori yang sama; bukan volume pembelian." : "Indeks kueri pilihan saat hipotesis dibuat; belum diperbarui bila histori tidak tersedia."),
    factor("competition", "Tekanan sampel kompetitor", 0.15, competition, "MARKET", "Proxy dari jumlah listing dalam sampel lokal yang cocok dengan kota profil; bukan sensus atau pangsa pasar. Sampel kosong tetap tidak diketahui."),
    factor("consumerRelevance", "Kesesuaian target konsumen", 0.15, consumer, "PROFILE_ALIGNMENT", "Proporsi segmen usulan yang cocok dengan segmen profil; bukan respons pembeli yang terukur."),
    factor("executionFeasibility", "Kemudahan pelaksanaan awal", 0.15, execution, "MODEL_ASSUMPTION", "Rubrik kompleksitas konsep: sederhana 100, standar 60, kompleks 25. Klasifikasi AI masih perlu dikonfirmasi."),
    factor("marketSustainability", "Kestabilan minat pencarian", 0.1, sustainability, "MARKET", "Proporsi pengamatan positif dibagi satu ditambah koefisien variasi; perlu histori panjang dan tidak membuktikan ketahanan usaha."),
  ]);
  const budget = capitalMin !== null && capitalMin >= 0 ? (capitalMin === 0 ? 100 : Math.min(100, 100 * profile.budget.max / capitalMin)) : null;
  const interest = req?.categoryId && selections.categoryIds.length ? (selections.categoryIds.includes(req.categoryId) ? 100 : 0) : null;
  const channel = req ? overlap(req.salesChannelIds, selections.channelIds) : null;
  const experience = ordinal(profile.experienceLevel, req?.requiredExperience ?? null, ["BEGINNER", "SOME_EXPERIENCE", "EXPERIENCED"]);
  const time = ordinal(profile.timeCommitment, req?.requiredTime ?? null, ["LIMITED", "PART_TIME", "FULL_TIME"]);
  const fit = aggregateAnalysisScore([
    factor("budgetFit", "Kecocokan modal", 0.3, budget, "USER_ESTIMATE", "Budget maksimum profil dibanding estimasi modal minimum yang Anda konfirmasi. Tanpa estimasi, faktor ini tetap kosong."),
    factor("interestFit", "Kategori minat", 0.2, interest, "PROFILE_ALIGNMENT", "Kategori konsep dibanding ID kategori aktif dalam profil."),
    factor("channelFit", "Kanal penjualan", 0.2, channel, "PROFILE_ALIGNMENT", "Proporsi kanal usulan yang tersedia dalam preferensi profil."),
    factor("experienceFit", "Pengalaman", 0.15, experience, "MODEL_ASSUMPTION", "Pengalaman profil dibanding kebutuhan konsep yang diperkirakan AI; selisih satu tingkat mengurangi 50 poin."),
    factor("timeFit", "Komitmen waktu", 0.15, time, "MODEL_ASSUMPTION", "Waktu profil dibanding kebutuhan konsep yang diperkirakan AI; selisih satu tingkat mengurangi 50 poin."),
  ]);
  const risks: string[] = [];
  if (budget !== null && budget < 100) risks.push("Estimasi modal melebihi budget maksimum yang tercatat di profil.");
  if (experience !== null && experience < 100) risks.push("Kebutuhan pengalaman konsep diperkirakan melebihi pengalaman profil; mulai dari uji kecil atau pendampingan.");
  if (time !== null && time < 100) risks.push("Kebutuhan waktu konsep diperkirakan lebih besar dari komitmen waktu profil.");
  if (req?.complexity === "COMPLEX") risks.push("Konsep diperkirakan memiliki operasional kompleks; validasi proses dan kebutuhan awal terlebih dahulu.");
  if (capitalMin === null) risks.push("Kebutuhan modal belum dikonfirmasi; biaya, margin, dan kemampuan pendanaan belum dapat disimpulkan.");
  risks.push("Hasil ini penilaian awal; penerimaan pembeli dan tingkat risiko usaha keseluruhan masih perlu diuji.");
  return { opportunity, fit, risks: risks.slice(0, 6) };
}
