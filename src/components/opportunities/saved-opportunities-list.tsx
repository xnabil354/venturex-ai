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
        <header className="grid max-w-[720px] gap-12">
          <p className="text-label-bold font-w460 text-royal-violet">Opportunity Intelligence</p>
          <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
            Saved Opportunities
          </h1>
          <p className="text-body leading-body text-stone-gray">
            Daftar peluang yang Anda simpan dan masih tersedia untuk jenis akun Anda.
          </p>
        </header>

        {result.status === "EMPTY" ? (
          <EmptyState
            action={(
              <Link
                className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet hover:underline"
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
                className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet hover:underline"
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
                <Card className="p-20 sm:p-24">
                  <article aria-labelledby={`saved-opportunity-${item.id}`} className="grid gap-12">
                    <p className="wrap-anywhere text-body-sm font-w540 text-stone-gray">
                      {item.categoryName}
                    </p>
                    <h2
                      className="wrap-anywhere text-heading-sm font-w460 leading-heading-sm text-ink-charcoal"
                      id={`saved-opportunity-${item.id}`}
                    >
                      {item.name}
                    </h2>
                    <p className="max-w-[76ch] wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                      {item.summary}
                    </p>
                    <p className="wrap-anywhere text-body-sm text-stone-gray">
                      Tren terkait: {item.relatedTrend.title}
                    </p>
                    <label className="flex min-h-button w-fit items-center gap-8 text-body-sm text-ink-charcoal">
                      <input
                        aria-label={`Pilih ${item.name} untuk perbandingan`}
                        checked={compareState.selected.some(({ id }) => id === item.id)}
                        className="size-16 accent-royal-violet"
                        disabled={compareState.loading}
                        onChange={() => compareState.toggle({ id: item.id, name: item.name })}
                        type="checkbox"
                      />
                      Pilih untuk perbandingan
                    </label>
                    <Link
                      aria-label={`Lihat detail ${item.name}`}
                      className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet hover:underline"
                      href={`/opportunities/${item.id}`}
                    >
                      Lihat detail
                    </Link>
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
