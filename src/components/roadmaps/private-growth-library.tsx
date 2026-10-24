import Link from "next/link";

import { Card } from "@/components/ui";
import { PrivatePagination } from "@/components/opportunities/private-pagination";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { RoadmapSurface } from "./roadmap-surface";

export function PrivateGrowthLibrary({ items, page, hasMore }: { items: readonly PrivateOpportunityIdeaDto[]; page: number; hasMore: boolean }) {
  return (
    <RoadmapSurface>
      <div className="mx-auto grid max-w-[960px] gap-24 py-24 sm:gap-32 sm:py-48">
        <header className="grid gap-12 border-b border-soft-mist pb-20 sm:pb-24">
          <h1 className="text-heading-sm font-w460 sm:text-heading-lg">Growth Roadmaps</h1>
          <p className="max-w-[64ch] text-body-sm leading-relaxed text-stone-gray">Rencana pengembangan dari peluang bisnis yang telah dianalisis, dengan ruang untuk menguji dan menyesuaikan tiap tahap.</p>
        </header>

        {items.length ? (
          <ul className="grid gap-12 sm:gap-16">
            {items.map((item) => (
              <li key={item.id}>
                <Card className="grid gap-16 p-16 transition-colors duration-200 hover:border-royal-violet/40 sm:p-20 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-24">
                  <div className="grid min-w-0 gap-8">
                    <p className="text-caption font-w540 text-royal-violet">Lima tahap pengembangan</p>
                    <h2 className="wrap-anywhere text-subheading font-w460">{item.hypothesis.title}</h2>
                  </div>
                  <Link href={`/opportunities/hypotheses/${item.id}/roadmap`} className="inline-flex min-h-button w-full items-center justify-center rounded-buttons bg-midnight-wine px-16 text-body-sm font-w540 text-paper-white transition-colors hover:bg-deep-lagoon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet md:w-auto">
                    Buka roadmap
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="grid gap-12 p-20 sm:p-24">
            <h2 className="text-label-bold font-w540">Belum ada roadmap di halaman ini</h2>
            <p className="max-w-[60ch] text-body-sm leading-relaxed text-stone-gray">Analisis peluang bisnis, simpan, lalu buat Growth Roadmap dari detailnya.</p>
            <Link href="/saved" className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet">Pilih peluang tersimpan</Link>
          </Card>
        )}

        <PrivatePagination page={page} hasMore={hasMore} href="/roadmaps" />
        <Link href="/roadmaps?source=catalog" className="inline-flex min-h-button w-fit items-center border-t border-soft-mist pt-16 text-caption font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet">Arsip roadmap katalog sebelumnya</Link>
      </div>
    </RoadmapSurface>
  );
}
