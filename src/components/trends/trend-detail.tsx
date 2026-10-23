import Link from "next/link";

import { Card, PageContainer } from "@/components/ui";
import type { OpportunityListItemDto } from "@/opportunity/dto";
import type { TrendListItem } from "@/trend/list-projection";

export type TrendDetailRelatedOpportunities = {
  readonly status: "AVAILABLE" | "EMPTY" | "ERROR";
  readonly items: readonly OpportunityListItemDto[];
};

export function TrendDetail({
  item,
  relatedOpportunities,
}: {
  readonly item: TrendListItem;
  readonly relatedOpportunities: TrendDetailRelatedOpportunities;
}) {
  const titleId = `trend-detail-${item.id}`;

  return (
    <PageContainer>
      <div className="grid gap-16 py-32 sm:py-48 lg:py-64">
        <Link
          className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet transition-colors hover:text-midnight-wine hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet"
          href="/trends"
        >
          Kembali ke Trend Radar
        </Link>
        <Card className="border-[#ded8cb] bg-[#faf9f6] p-20 sm:p-24 shadow-2xs">
          <article aria-labelledby={titleId} className="grid gap-24">
            <header className="grid gap-12">
              <p className="text-label-bold font-w540 text-deep-lagoon">Trend Intelligence</p>
              <div className="flex flex-wrap items-center gap-8">
                <span className="wrap-anywhere text-label-bold font-w460 text-stone-gray">
                  {item.categoryName}
                </span>
                <span className="inline-flex min-h-28 items-center rounded-full border border-deep-lagoon/20 bg-deep-lagoon/10 px-10 wrap-anywhere text-label-bold font-w540 text-deep-lagoon">
                  {item.directionLabel}
                </span>
              </div>
              <h1
                className="wrap-anywhere text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display"
                id={titleId}
              >
                {item.title}
              </h1>
              {item.subjectAreaName ? (
                <p className="wrap-anywhere text-body-sm text-stone-gray">
                  Bidang F&amp;B: {item.subjectAreaName}
                </p>
              ) : null}
              <p className="max-w-[76ch] wrap-anywhere text-body leading-body text-ink-charcoal">
                {item.summary}
              </p>
              <p className="wrap-anywhere text-body-sm text-stone-gray">
                {item.observationPeriodLabel}
              </p>
            </header>

            <section aria-labelledby={`${titleId}-relevance`} className="grid gap-8 border-t border-soft-mist pt-16">
              <h2
                className="text-label-bold font-w460 text-ink-charcoal"
                id={`${titleId}-relevance`}
              >
                Konteks relevansi bisnis
              </h2>
              <p className="max-w-[76ch] wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                {item.businessRelevanceExplanation?.trim() || "Konteks relevansi bisnis belum tersedia."}
              </p>
            </section>

            <section aria-labelledby={`${titleId}-evidence`} className="grid gap-12 border-t border-soft-mist pt-16">
              <h2
                className="text-label-bold font-w460 text-ink-charcoal"
                id={`${titleId}-evidence`}
              >
                Bukti dan sumber
              </h2>
              <ul className="grid gap-16">
                {item.evidence.map((evidence, index) => (
                  <li
                    className="grid gap-8 border-l border-soft-mist pl-16"
                    key={`${item.id}-evidence-${index}`}
                  >
                    <h3 className="wrap-anywhere text-body-sm font-w540 text-ink-charcoal">
                      {evidence.sourceName}
                    </h3>
                    <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                      {evidence.supportingDetail}
                    </p>
                    <p className="wrap-anywhere text-body-sm text-stone-gray">
                      {evidence.sourceDateLabel}
                    </p>
                    <p className="wrap-anywhere text-body-sm text-stone-gray">
                      <span className="font-w540 text-ink-charcoal">Referensi sumber: </span>
                      {evidence.sourceReference}
                    </p>
                    <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                      <span className="font-w540 text-ink-charcoal">Keterbatasan sumber: </span>
                      {evidence.limitations?.trim() || "Tidak dicantumkan."}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </article>
        </Card>
        <p className="wrap-anywhere border-t border-soft-mist pt-12 text-caption text-stone-gray">
          Katalog diperbarui {item.catalogUpdatedAtLabel}
        </p>
        <section aria-labelledby={`${titleId}-opportunities`} className="grid gap-8 border-t border-soft-mist pt-24">
          <h2
            className="text-label-bold font-w460 text-ink-charcoal"
            id={`${titleId}-opportunities`}
          >
            Peluang terkait
          </h2>
          {relatedOpportunities.status === "AVAILABLE" ? (
            <ul className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {relatedOpportunities.items.map((opportunity) => (
                <li
                  className="grid content-start gap-8 rounded-card border border-[#ded8cb] bg-[#faf9f6] p-16 shadow-2xs transition-all duration-200 hover:border-midnight-wine/40 hover:shadow-xs"
                  key={opportunity.id}
                >
                  {opportunity.categoryName ? (
                    <span className="inline-flex w-fit items-center rounded-pills border border-[#ded8cb] bg-warm-parchment px-8 py-2 text-caption font-w540 text-midnight-wine">
                      {opportunity.categoryName}
                    </span>
                  ) : null}
                  <h3 className="wrap-anywhere text-label-bold font-w460 text-ink-charcoal">
                    <Link
                      className="transition-colors hover:text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                      href={`/opportunities/${opportunity.id}`}
                    >
                      {opportunity.name}
                    </Link>
                  </h3>
                  <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                    {opportunity.summary}
                  </p>
                </li>
              ))}
            </ul>
          ) : relatedOpportunities.status === "EMPTY" ? (
            <p className="text-body-sm leading-body-sm text-stone-gray">
              Belum ada peluang yang terhubung dengan tren ini.
            </p>
          ) : (
            <div aria-live="polite" className="grid gap-8">
              <p className="text-caption font-w540 text-stone-gray">Tidak dapat dimuat</p>
              <p className="text-body-sm leading-body-sm text-stone-gray">
                Peluang terkait belum dapat dimuat. Konten Trend tetap tersedia.
              </p>
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
