import Link from "next/link";

import type { RoadmapPage } from "@/roadmap/domain";
import { Badge, Card, EmptyState, PageContainer } from "@/components/ui";
import { ArrowRightIcon } from "@/components/landing/icons";

export function RoadmapList({ page, roadmapType }: { readonly page: RoadmapPage; readonly roadmapType: "STARTUP" | "GROWTH" }) {
  const roadmapLabel = roadmapType === "GROWTH" ? "Growth Roadmap" : "Startup Roadmap";
  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <header className="grid gap-12 border-b border-soft-mist pb-24">
          <div className="flex items-center gap-12">
            <h1 className="text-heading-lg font-w460 text-ink-charcoal sm:text-display">Roadmap tersimpan</h1>
            <span className="rounded-pills border border-soft-mist bg-paper-white px-10 py-3 text-caption font-w540 uppercase tracking-wider text-royal-violet shadow-2xs">
              {roadmapLabel}
            </span>
          </div>
          <p className="max-w-[76ch] text-body-sm leading-relaxed text-stone-gray">
            {roadmapType === "GROWTH"
              ? "Roadmap membantu menyusun uji pertumbuhan untuk bisnis yang berjalan. Isinya bukan prediksi atau jaminan hasil usaha."
              : "Roadmap membantu menyusun langkah validasi. Isi langkah bukan jaminan pasar atau keberhasilan usaha."}
          </p>
        </header>
        {page.items.length === 0 ? (
          <EmptyState
            action={
              <Link
                className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet"
                href="/opportunities"
              >
                Jelajahi Opportunity
              </Link>
            }
            description="Buka Opportunity yang memenuhi syarat untuk membuat rencana validasi pertama."
            title={`Belum ada ${roadmapLabel}`}
          />
        ) : (
          <ul className="grid gap-16">
            {page.items.map((item) => (
              <li key={item.id}>
                <Card className="grid gap-16 p-20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-24 transition-all duration-300 border-[#ded8cb] bg-[#faf9f6] hover:border-midnight-wine/40 hover:-translate-y-1 hover:shadow-lg">
                  <div className="grid gap-8">
                    <div className="flex flex-wrap items-center gap-8">
                      <Badge tone="wash">{roadmapLabel}</Badge>
                      <p className="text-caption text-stone-gray">
                        Dibuat {new Date(item.createdAt).toLocaleDateString("id-ID", { dateStyle: "long" })}
                      </p>
                    </div>
                    <h2 className="text-heading-sm font-w460 text-ink-charcoal">{item.opportunity.name}</h2>
                  </div>
                  <Link
                    className="group inline-flex min-h-button items-center justify-center gap-8 rounded-small-buttons border border-ink-charcoal bg-lilac-mist px-16 text-body-sm font-w540 text-ink-charcoal transition-all duration-200 hover:bg-paper-white focus-visible:outline-2 focus-visible:outline-royal-violet"
                    href={`/roadmaps/${item.id}`}
                  >
                    <span>Buka roadmap</span>
                    <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {page.totalPages > 1 ? (
          <nav aria-label="Navigasi halaman Roadmap" className="flex flex-wrap items-center justify-between gap-16 border-t border-soft-mist pt-16">
            {page.page > 1 ? (
              <Link className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href={`/roadmaps?page=${page.page - 1}`}>
                Sebelumnya
              </Link>
            ) : (
              <span className="text-body-sm text-stone-gray">Sebelumnya</span>
            )}
            <p aria-live="polite" className="text-caption text-stone-gray">Halaman {page.page} dari {page.totalPages}.</p>
            {page.page < page.totalPages ? (
              <Link className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href={`/roadmaps?page=${page.page + 1}`}>
                Selanjutnya
              </Link>
            ) : (
              <span className="text-body-sm text-stone-gray">Selanjutnya</span>
            )}
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
