import type { EntrepreneurAnalysis } from "@/opportunity/entrepreneur-analysis-contract";
import { assessEntrepreneurRisk } from "@/scoring/entrepreneur-risk";

export function EntrepreneurRiskView({ analysis }: { readonly analysis: EntrepreneurAnalysis }) {
  const risk = assessEntrepreneurRisk(analysis);
  const labels = { LOW: "Rendah", MEDIUM: "Sedang", HIGH: "Tinggi" };
  return <div className="grid gap-8 rounded-small-buttons border border-soft-mist bg-warm-parchment p-16">
    <p className="text-body-sm font-w540">Risiko persiapan awal: {risk.level ? labels[risk.level] : "Belum cukup data"}</p>
    <ul className="grid gap-4 text-caption leading-relaxed text-stone-gray">{risk.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
    <details><summary className="min-h-button cursor-pointer py-12 text-caption focus-visible:outline-2 focus-visible:outline-royal-violet">Dasar penilaian risiko</summary><p className="text-caption leading-relaxed text-stone-gray">Cakupan {risk.coverage}%. Penilaian ini bersifat awal. Data yang belum tersedia tidak dianggap aman.</p></details>
  </div>;
}
