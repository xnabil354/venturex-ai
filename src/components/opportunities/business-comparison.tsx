import Link from "next/link";
import { Card, PageContainer, StatusNotice } from "@/components/ui";
import { hasVerifiedBusinessConcept, type BusinessAnalysis } from "@/opportunity/business-analysis-contract";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const value = (n: number | null | undefined) => n == null ? "Belum tersedia" : `${number.format(n)} / 100`;
const complexity = { SIMPLE: "Sederhana", STANDARD: "Standar", COMPLEX: "Kompleks" };
function trendText(a: BusinessAnalysis) {
  const t = a.trend;
  if (!t) return "Data tren belum tersedia.";
  const context = `${t.query} · 1 tahun · ${t.geo === "ID" ? "Indonesia" : t.geo || "Seluruh dunia"}`;
  if (t.spanDays < 150 || t.recentMean === null || t.previousMean === null || t.recentMean + t.previousMean === 0) return `${context}. Data belum cukup untuk membandingkan arah pencarian.`;
  const direction = t.recentMean > t.previousMean ? "Meningkat" : t.recentMean < t.previousMean ? "Menurun" : "Tetap";
  const stability = a.opportunity.factors.find(f => f.key === "marketSustainability")?.value;
  return `${context}. ${direction}: rata-rata indeks terbaru ${number.format(t.recentMean)}, sebelumnya ${number.format(t.previousMean)}. Kestabilan indeks: ${value(stability)}. Bukan pertumbuhan penjualan.`;
}

export function BusinessComparison({ items, removedCount, from = "finder" }: {
  items: readonly PrivateOpportunityIdeaDto[]; removedCount: number; from?: "finder" | "saved";
}) {
  const contexts = new Set(items.map(item => JSON.stringify([item.hypothesis.businessAnalysis?.trend?.query, item.hypothesis.businessAnalysis?.trend?.geo])));
  return <PageContainer><div className="grid gap-24 py-32 sm:py-48">
    <Link href={from === "saved" ? "/saved" : "/opportunities"} className="inline-flex min-h-button items-center text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet">{from === "saved" ? "Kembali ke peluang tersimpan" : "Kembali ke peluang"}</Link>
    <header className="grid gap-12"><h1 className="text-heading-sm font-w460 sm:text-heading-lg">Bandingkan pengembangan bisnis</h1><p className="max-w-[72ch] text-body-sm leading-relaxed text-stone-gray">Gunakan skor, risiko, dan bukti ini sebagai bahan pertimbangan.</p></header>
    {removedCount ? <StatusNotice tone="info">{removedCount} pilihan perlu dianalisis ulang atau tidak tersedia. {items.length < 2 ? "Pilih minimal dua peluang dengan analisis terbaru." : "Tinjau pilihan yang tersedia."}</StatusNotice> : null}
    {contexts.size > 1 ? <p className="text-body-sm text-stone-gray">Konteks pencarian berbeda. Bandingkan periode dan wilayah sebelum menarik kesimpulan.</p> : null}
    <div className={`grid min-w-0 gap-20 ${items.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
      {items.map(item => {
        const a = item.hypothesis.businessAnalysis;
        if (!hasVerifiedBusinessConcept(a)) return null;
        const execution = a.opportunity.factors.find(f => f.key === "executionFeasibility");
        const level = a.requirements?.complexity;
        const fields = [
          ["Opportunity Score", `${value(a.opportunity.score)} · cakupan ${number.format(a.opportunity.coverage)}%`],
          ["Business Fit", `${value(a.fit.score)} · cakupan ${number.format(a.fit.coverage)}%`],
          ["Tren", trendText(a)], ["Kompetisi", a.competition],
          ["Risiko awal", a.risk.level === "UNKNOWN" ? "Belum ditentukan" : a.risk.level],
          ["Target konsumen", a.targetConsumer],
          ["Kelayakan pelaksanaan", level && execution?.value != null ? `${complexity[level]} · ${value(execution.value)}. Kebutuhan yang perlu diuji: ${a.requirements?.initialNeeds.slice(0, 2).join(" ")}` : "Belum tersedia. Kebutuhan pelaksanaan perlu ditinjau."],
        ];
        return <Card key={item.id} className="grid min-w-0 content-start gap-16 p-20">
          <h2 className="wrap-anywhere text-subheading font-w460">{item.hypothesis.title}</h2>
          <dl className="grid gap-16 text-body-sm">{fields.map(([label, text]) => <div key={label} className="grid gap-6 border-t border-soft-mist pt-12"><dt className="font-w540">{label}</dt><dd className="wrap-anywhere leading-relaxed text-stone-gray">{text}</dd></div>)}</dl>
          <details className="min-w-0 border-t border-soft-mist"><summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 focus-visible:outline-2 focus-visible:outline-royal-violet">Rincian faktor</summary><dl className="grid gap-12">{[...a.opportunity.factors, ...a.fit.factors].map(f => <div key={f.key} className="grid gap-4 text-caption"><dt className="flex flex-wrap justify-between gap-8"><span>{f.label}</span><span>{value(f.value)}</span></dt><dd className="leading-relaxed text-stone-gray">{f.reason}</dd></div>)}</dl></details>
          <ul className="grid list-disc gap-8 pl-20 text-caption leading-relaxed text-stone-gray">{a.risk.reasons.map(v => <li key={v}>{v}</li>)}</ul>
          <a href={item.source.url} rel="noreferrer" target="_blank" className="inline-flex min-h-button items-center text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet">Evidence sumber</a>
          <Link href={`/opportunities/hypotheses/${item.id}`} className="inline-flex min-h-button items-center text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet">Lihat detail</Link>
        </Card>;
      })}
    </div>
  </div></PageContainer>;
}
