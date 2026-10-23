import type { EntrepreneurAnalysis } from "@/opportunity/entrepreneur-analysis-contract";

export function assessEntrepreneurRisk(analysis: Pick<EntrepreneurAnalysis, "opportunity" | "fit">) {
  const policy = [
    ["budgetFit", .3], ["executionFeasibility", .2], ["competition", .2],
    ["marketSustainability", .15], ["experienceFit", .075], ["timeFit", .075],
  ] as const;
  const factors = [...analysis.opportunity.factors, ...analysis.fit.factors];
  const known = policy.flatMap(([key, weight]) => {
    const factor = factors.find(item => item.key === key);
    return factor?.value !== null && factor?.value !== undefined
      ? [{ key, weight, pressure: 100 - factor.value, label: factor.label }] : [];
  });
  const coverage = known.reduce((sum, factor) => sum + factor.weight, 0);
  const eligible = known.length >= 3 && coverage >= .6 - 1e-10 && known.some(f => f.key === "budgetFit") && known.some(f => f.key === "competition" || f.key === "marketSustainability");
  const pressure = coverage ? known.reduce((sum, factor) => sum + factor.pressure * factor.weight, 0) / coverage : 0;
  const level = !eligible || (pressure < 30 && coverage < 1 - 1e-10) ? null : pressure >= 60 ? "HIGH" as const : pressure >= 30 ? "MEDIUM" as const : "LOW" as const;
  const reasons = known.filter(f => f.pressure >= 30).map(f => `${f.label} masih memerlukan perhatian dalam uji awal.`);
  return { version: "entrepreneur-risk-v1" as const, level, coverage: Math.round(coverage * 100), reasons: level ? reasons.length ? reasons : ["Faktor persiapan yang tersedia belum menunjukkan tekanan tinggi; respons pembeli tetap perlu diuji."] : ["Lengkapi estimasi modal dan bukti pasar sebelum memberi tingkat risiko awal."] };
}
