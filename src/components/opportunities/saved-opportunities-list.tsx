"use client";

import Link from "next/link";

import { Card, EmptyState, PageContainer } from "@/components/ui";
import type { SavedOpportunityListResult } from "@/opportunity/saved-dto";
import { OpportunityComparisonPanel, useOpportunityCompare } from "./opportunity-comparison";

export function SavedOpportunitiesList({
  result,
}: {
  readonly result: SavedOpportunityListResult;
}) {
  const compareState = useOpportunityCompare();
  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <header className="grid max-w-[760px] gap-12 border-b border-soft-mist pb-24">
          <div className="flex items-center gap-12">
            <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
              Saved Opportunities
            </h1>
            <span className="rounded-pills border border-soft-mist bg-paper-white px-10 py-3 text-caption font-w540 uppercase tracking-wider text-royal-violet shadow-2xs">
              Koleksi Tersimpan
            </span>
          </div>
          <p className="text-body leading-relaxed text-stone-gray">
            Daftar peluang yang Anda simpan dan masih tersedia untuk jenis akun Anda.
          </p>
        </header>

        {result.status === "EMPTY" ? (
          <EmptyState
            action={(
              <Link
                className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet"
                href="/opportunities"
              >
                Buka Opportunity Finder
              </Link>
            )}
            description="Belum ada opportunity yang disimpan."
            title="Belum ada simpanan"
          />
        ) : result.status === "ERROR" ? (
          <EmptyState
            action={(
              <Link
                className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet"
                href="/saved"
              >
                Coba lagi
              </Link>
            )}
            description="Peluang tersimpan belum dapat dimuat. Silakan coba kembali."
            title="Terjadi kendala"
          />
        ) : (
          <ul aria-label="Peluang tersimpan" className="grid gap-16">
            {result.items.map((item) => (
              <li key={item.id}>
                <Card className="p-20 sm:p-24 transition-all duration-300 border-[#ded8cb] bg-[#faf9f6] hover:border-midnight-wine/40 hover:-translate-y-1 hover:shadow-lg">
                  <article aria-labelledby={`saved-opportunity-${item.id}`} className="grid gap-14">
                    <div className="flex flex-wrap items-baseline justify-between gap-8">
                      <span className="inline-flex items-center rounded-pills border border-[#ded8cb] bg-warm-parchment px-10 py-3 text-caption font-w540 text-midnight-wine">
                        {item.categoryName}
                      </span>
                      <p className="text-caption text-stone-gray">
                        Tren terkait: {item.relatedTrend.title}
                      </p>
                    </div>
                    <h2
                      className="wrap-anywhere text-heading-sm font-w460 leading-heading-sm text-ink-charcoal"
                      id={`saved-opportunity-${item.id}`}
                    >
                      {item.name}
                    </h2>
                    <p className="max-w-[76ch] wrap-anywhere text-body-sm leading-relaxed text-stone-gray">
                      {item.summary}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-12 border-t border-soft-mist/60 pt-12">
                      <label className="flex min-h-button cursor-pointer items-center gap-8 text-body-sm text-ink-charcoal">
                        <input
                          aria-label={`Pilih ${item.name} untuk perbandingan`}
                          checked={compareState.selected.some(({ id }) => id === item.id)}
                          className="size-16 rounded accent-midnight-wine focus-visible:outline-2 focus-visible:outline-royal-violet"
                          disabled={compareState.loading}
                          onChange={() => compareState.toggle({ id: item.id, name: item.name })}
                          type="checkbox"
                        />
                        Pilih untuk perbandingan
                      </label>
                      <Link
                        aria-label={`Lihat detail ${item.name}`}
                        className="inline-flex min-h-button items-center rounded-small-buttons border border-ink-charcoal bg-lilac-mist px-16 text-body-sm font-w540 text-ink-charcoal transition-colors hover:bg-paper-white focus-visible:outline-2 focus-visible:outline-royal-violet"
                        href={`/opportunities/${item.id}`}
                      >
                        Lihat detail
                      </Link>
                    </div>
                  </article>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {result.status === "AVAILABLE" ? <OpportunityComparisonPanel compareState={compareState} /> : null}
      </div>
    </PageContainer>
  );
}
