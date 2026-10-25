import Link from "next/link";

import { JourneyProgress } from "./journey-progress";
import { startupRoadmapDisplayAction } from "@/roadmap/private-startup-text";
import { Card } from "@/components/ui";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { RoadmapSurface } from "./roadmap-surface";

export function PrivateStartupView({ item }: { readonly item: PrivateOpportunityIdeaDto }) {
  const roadmap = item.hypothesis.startupRoadmap;
  if (!roadmap) return null;

  return (
    <RoadmapSurface>
      <div className="mx-auto grid max-w-[960px] gap-24 py-24 sm:gap-32 sm:py-48">
        <Link className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href="/roadmaps">Semua roadmap</Link>

        <header className="grid gap-12 rounded-cards bg-midnight-wine p-20 text-paper-white sm:p-28">
          <h1 className="wrap-anywhere text-heading-sm font-w460 sm:text-heading-lg">{item.hypothesis.title}</h1>
          <p className="max-w-[66ch] text-body-sm leading-relaxed text-paper-white/80">Enam langkah untuk menguji konsep. Sesuaikan dengan kapasitas Anda dan catat hasil aktual sebelum meneruskan ke tahap berikutnya.</p>
        </header>

        <ol className="grid gap-12 sm:gap-16">
          {roadmap.steps.map((step) => (
            <li key={step.sequence}>
              <Card className="grid gap-16 p-16 sm:p-20 md:p-24">
                <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-x-10 gap-y-4 border-b border-soft-mist pb-12 sm:grid-cols-[28px_minmax(0,1fr)_auto]">
                  <span className="flex size-28 shrink-0 items-center justify-center rounded-full bg-midnight-wine text-caption font-w540 text-paper-white">{step.sequence}</span>
                  <h2 className="min-w-0 flex-1 text-label-bold font-w540">{step.stage}</h2>
                  <p className="col-start-2 min-w-0 wrap-anywhere text-caption font-w540 text-royal-violet sm:col-start-3 sm:text-right">{step.timeline}</p>
                </div>
                <p className="wrap-anywhere max-w-[72ch] text-body-sm font-w540 leading-relaxed">{startupRoadmapDisplayAction(item, step)}</p>
                <dl className="grid gap-10 text-body-sm sm:grid-cols-2">
                  <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14">
                    <dt className="font-w540">Tujuan</dt>
                    <dd className="leading-relaxed text-stone-gray">{step.objective}</dd>
                  </div>
                  <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14">
                    <dt className="font-w540">Hasil yang dicatat</dt>
                    <dd className="leading-relaxed text-stone-gray">{step.expectedOutput}</dd>
                  </div>
                </dl>
                {step.sequence === 3 && item.hypothesis.analysis?.requirements?.initialNeeds.length ? (
                  <details className="border-t border-soft-mist">
                    <summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 focus-visible:outline-2 focus-visible:outline-royal-violet">Kebutuhan awal</summary>
                    <ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed text-stone-gray">{item.hypothesis.analysis.requirements.initialNeeds.map((need, index) => <li className="wrap-anywhere" key={index}>{need}</li>)}</ul>
                  </details>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>

        <JourneyProgress id={item.id} />
        <p className="max-w-[76ch] text-caption leading-relaxed text-stone-gray">Roadmap berasal dari analisis tersimpan, bukan pembaruan kondisi pasar. Tidak menjamin hasil usaha. Keputusan lanjut, revisi, atau berhenti tetap milik Anda.</p>
        <Link href={`/opportunities/hypotheses/${item.id}`} className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet">Tinjau skor dan bukti sumber</Link>
      </div>
    </RoadmapSurface>
  );
}
