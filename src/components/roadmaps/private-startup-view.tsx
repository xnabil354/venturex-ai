import Link from "next/link";
import { JourneyProgress } from "./journey-progress";
import { startupRoadmapDisplayAction } from "@/roadmap/private-startup-text";
import { Card, PageContainer } from "@/components/ui";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";

export function PrivateStartupView({ item }: { readonly item: PrivateOpportunityIdeaDto }) {
  const roadmap = item.hypothesis.startupRoadmap;
  if (!roadmap) return null;
  return <PageContainer><div className="mx-auto grid max-w-[960px] gap-24 py-32 sm:py-48">
    <Link className="inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet" href="/roadmaps">Semua roadmap</Link>
    <header className="grid gap-12"><p className="text-caption text-royal-violet">Startup Roadmap</p><h1 className="wrap-anywhere text-heading-sm font-w460 sm:text-heading-lg">{item.hypothesis.title}</h1><p className="max-w-[70ch] text-body-sm leading-relaxed text-stone-gray">Enam langkah untuk menguji konsep. Sesuaikan dengan kapasitas Anda dan catat hasil aktual.</p></header>
    <ol className="grid gap-16">{roadmap.steps.map(step => <li key={step.sequence}><Card className="grid gap-12 p-20 sm:p-24"><div className="flex items-center gap-12"><span className="flex size-28 shrink-0 items-center justify-center rounded-full bg-midnight-wine text-caption text-paper-white">{step.sequence}</span><h2 className="text-body font-w540">{step.stage}</h2></div><p className="wrap-anywhere text-body-sm leading-relaxed">{startupRoadmapDisplayAction(item, step)}</p>{step.sequence === 3 && item.hypothesis.analysis?.requirements?.initialNeeds.length ? <details className="border-t border-soft-mist"><summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 focus-visible:outline-2 focus-visible:outline-royal-violet">Kebutuhan awal</summary><ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed text-stone-gray">{item.hypothesis.analysis.requirements.initialNeeds.map((need, index) => <li className="wrap-anywhere" key={index}>{need}</li>)}</ul></details> : null}<dl className="grid gap-12 rounded-small-buttons bg-warm-parchment p-16 text-body-sm sm:grid-cols-2"><div className="grid gap-4"><dt className="font-w540">Tujuan</dt><dd className="leading-relaxed text-stone-gray">{step.objective}</dd></div><div className="grid gap-4"><dt className="font-w540">Waktu</dt><dd className="leading-relaxed text-stone-gray">{step.timeline}</dd></div><div className="grid gap-4 sm:col-span-2"><dt className="font-w540">Hasil yang dicatat</dt><dd className="leading-relaxed text-stone-gray">{step.expectedOutput}</dd></div></dl></Card></li>)}</ol><JourneyProgress id={item.id} />
    <p className="text-caption leading-relaxed text-stone-gray">Roadmap berasal dari analisis tersimpan, bukan pembaruan kondisi pasar. Tidak menjamin hasil usaha. Keputusan lanjut, revisi, atau berhenti tetap milik Anda.</p>
    <Link href={`/opportunities/hypotheses/${item.id}`} className="inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet">Tinjau skor dan bukti sumber</Link>
  </div></PageContainer>;
}
