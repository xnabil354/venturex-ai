import Link from "next/link";

import { JourneyProgress } from "./journey-progress";
import { Card, StatusNotice } from "@/components/ui";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { RoadmapSurface } from "./roadmap-surface";

export function PrivateGrowthView({ item }: { item: PrivateOpportunityIdeaDto }) {
  const plan = item.hypothesis.growthRoadmap;
  if (!plan) return null;

  return (
    <RoadmapSurface>
      <div className="mx-auto grid max-w-[960px] gap-24 py-24 sm:gap-32 sm:py-48">
        <Link href={`/opportunities/hypotheses/${item.id}`} className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet">Kembali ke analisis bisnis</Link>

        <header className="grid gap-12 rounded-cards bg-deep-lagoon p-20 text-paper-white sm:p-28">
          <h1 className="wrap-anywhere text-heading-sm font-w460 sm:text-heading-lg">{item.hypothesis.title}</h1>
          <p className="max-w-[66ch] text-body-sm leading-relaxed text-paper-white/80">Lima tahap pengembangan bisnis untuk menguji peluang secara bertahap dan mencatat pembelajaran yang dapat ditindaklanjuti.</p>
        </header>

        {plan.sourceFingerprint !== item.hypothesis.businessAnalysis?.inputFingerprint ? <StatusNotice tone="info">Analisis telah berubah. Roadmap lama dipertahankan untuk konteks historis dan belum mengikuti analisis terbaru.</StatusNotice> : null}

        <ol className="grid gap-12 sm:gap-16">
          {plan.steps.map((step, index) => (
            <li key={step.stage}>
              <Card className="grid gap-16 p-16 sm:p-20 md:p-24">
                <div className="flex flex-wrap items-center gap-10 border-b border-soft-mist pb-12">
                  <span className="flex size-28 shrink-0 items-center justify-center rounded-full bg-deep-lagoon text-caption font-w540 text-paper-white">{index + 1}</span>
                  <h2 className="min-w-0 flex-1 text-label-bold font-w540">{step.stage}</h2>
                  <p className="text-caption font-w540 text-royal-violet">{step.timeline}</p>
                </div>
                <p className="max-w-[72ch] wrap-anywhere text-body-sm font-w540 leading-relaxed">{step.action}</p>
                <dl className="grid gap-10 text-body-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14">
                    <dt className="font-w540">Tujuan</dt>
                    <dd className="leading-relaxed text-stone-gray">{step.objective}</dd>
                  </div>
                  <div className="grid gap-4 rounded-small-buttons bg-warm-parchment p-14 sm:col-span-2 lg:col-span-1">
                    <dt className="font-w540">Hasil yang dicatat</dt>
                    <dd className="leading-relaxed text-stone-gray">{step.expectedOutput}</dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ol>

        <JourneyProgress id={item.id} />
      </div>
    </RoadmapSurface>
  );
}
