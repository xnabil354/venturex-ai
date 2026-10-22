import Link from "next/link";
import { JourneyProgress } from "./journey-progress";
import { Card, PageContainer, StatusNotice } from "@/components/ui";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";

export function PrivateGrowthView({ item }: { item: PrivateOpportunityIdeaDto }) {
  const plan = item.hypothesis.growthRoadmap;
  if (!plan) return null;
  return <PageContainer><div className="mx-auto grid max-w-[960px] gap-24 py-32 sm:py-48"><Link href={`/opportunities/hypotheses/${item.id}`} className="inline-flex min-h-button items-center text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet">Kembali ke analisis bisnis</Link><header className="grid gap-12"><h1 className="text-heading-sm font-w460 sm:text-heading-lg">Growth Roadmap</h1><p className="wrap-anywhere text-subheading">{item.hypothesis.title}</p><p className="text-body-sm leading-relaxed text-stone-gray">Lima tahap pengembangan bisnis untuk membantu Anda menguji peluang.</p></header>{plan.sourceFingerprint !== item.hypothesis.businessAnalysis?.inputFingerprint ? <StatusNotice tone="info">Analisis telah berubah. Roadmap lama dipertahankan untuk konteks historis dan belum mengikuti analisis terbaru.</StatusNotice> : null}<ol className="grid gap-20">{plan.steps.map((step, index) => <li key={step.stage}><Card className="grid gap-16 p-20 sm:p-32"><h2 className="text-subheading font-w460">{index + 1}. {step.stage}</h2><p className="max-w-[72ch] wrap-anywhere text-body-sm leading-relaxed">{step.action}</p><dl className="grid gap-12 text-body-sm sm:grid-cols-3">{[["Tujuan", step.objective], ["Waktu", step.timeline], ["Hasil yang dicatat", step.expectedOutput]].map(([label, value]) => <div key={label} className="grid content-start gap-6"><dt className="font-w540">{label}</dt><dd className="leading-relaxed text-stone-gray">{value}</dd></div>)}</dl></Card></li>)}</ol><JourneyProgress id={item.id} /></div></PageContainer>;
}
