import Link from "next/link";

import { Card, EmptyState, PageContainer } from "@/components/ui";
import type { TrendListItem } from "@/trend/list-projection";

const EMPTY_DESCRIPTION =
  "Belum ada tren F&B terkurasi yang dipublikasikan untuk jenis pengguna ini.";

export function TrendList({ items }: { readonly items: readonly TrendListItem[] }) {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <header className="mb-32 grid max-w-[720px] gap-12">
          <p className="text-label-bold font-w460 text-royal-violet">Trend Intelligence</p>
          <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
            Trend Radar
          </h1>
          <p className="text-body leading-body text-stone-gray">
            Perubahan F&amp;B yang terkurasi, dengan sumber dan batasan bukti yang dapat ditinjau.
          </p>
        </header>

        {items.length === 0 ? (
          <EmptyState
            description={EMPTY_DESCRIPTION}
            title="Belum ada tren"
          />
        ) : (
          <ul aria-label="Daftar tren terpublikasi" className="grid gap-16">
            {items.map((item) => (
              <li key={item.id}>
                <Card className="p-20 sm:p-24">
                  <article aria-labelledby={`trend-${item.id}`} className="grid gap-24">
                    <header className="grid gap-12">
                      <div className="flex flex-wrap items-center gap-8">
                        <span className="wrap-anywhere text-label-bold font-w460 text-stone-gray">
                          {item.categoryName}
                        </span>
                        <span className="inline-flex min-h-28 items-center rounded-full border border-soft-mist bg-lilac-mist px-10 wrap-anywhere text-label-bold font-w460 text-ink-charcoal">
                          {item.directionLabel}
                        </span>
                      </div>
                      <h2
                        className="wrap-anywhere text-heading-sm font-w460 leading-heading-sm text-ink-charcoal"
                        id={`trend-${item.id}`}
                      >
                        <Link
                          className="transition-colors hover:text-royal-violet hover:underline"
                          href={`/trends/${item.id}`}
                        >
                          {item.title}
                        </Link>
                      </h2>
                      {item.subjectAreaName ? (
                        <p className="wrap-anywhere text-body-sm text-stone-gray">
                          Bidang F&amp;B: {item.subjectAreaName}
                        </p>
                      ) : null}
                    </header>

                    <div className="grid gap-12">
                      <p className="max-w-[76ch] wrap-anywhere text-body leading-body text-ink-charcoal">
                        {item.summary}
                      </p>
                      <p className="wrap-anywhere text-body-sm text-stone-gray">
                        {item.observationPeriodLabel}
                      </p>
                    </div>

                    <section aria-label={`Bukti untuk ${item.title}`} className="grid gap-12">
                      <h3 className="text-label-bold font-w460 text-ink-charcoal">
                        Bukti pendukung
                      </h3>
                      <ul className="grid gap-16 border-l border-soft-mist pl-16">
                        {item.evidence.map((evidence, index) => (
                          <li className="grid gap-8" key={`${item.id}-evidence-${index}`}>
                            <p className="wrap-anywhere text-body-sm font-w540 text-ink-charcoal">
                              {evidence.sourceName}
                            </p>
                            <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                              {evidence.supportingDetail}
                            </p>
                            <p className="wrap-anywhere text-body-sm text-stone-gray">
                              {evidence.sourceDateLabel}
                            </p>
                            <p className="wrap-anywhere text-body-sm text-stone-gray">
                              <span className="font-w540 text-ink-charcoal">Referensi: </span>
                              {evidence.sourceReference}
                            </p>
                            {evidence.limitations ? (
                              <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                                <span className="font-w540 text-ink-charcoal">Batasan bukti: </span>
                                {evidence.limitations}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </section>

                    {item.businessRelevanceExplanation ? (
                      <section className="grid gap-8 border-t border-soft-mist pt-16">
                        <h3 className="text-label-bold font-w460 text-ink-charcoal">
                          Konteks relevansi bisnis
                        </h3>
                        <p className="max-w-[76ch] wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                          {item.businessRelevanceExplanation}
                        </p>
                      </section>
                    ) : null}

                    <p className="border-t border-soft-mist pt-12 wrap-anywhere text-caption text-stone-gray">
                      Katalog diperbarui {item.catalogUpdatedAtLabel}
                    </p>
                  </article>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
