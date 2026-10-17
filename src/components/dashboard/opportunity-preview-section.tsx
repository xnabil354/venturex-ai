import Link from "next/link";
import { useId } from "react";

import type { DashboardOpportunityModuleState } from "../../dashboard/dto";
import { Badge, Card } from "../ui";
import { ArrowRightIcon, CompassIcon } from "../landing/icons";

const statusCopy = {
  AVAILABLE: "Tersedia",
  EMPTY: "Belum ada data",
  UNAVAILABLE: "Belum tersedia",
  ERROR: "Tidak dapat dimuat",
} as const;

const descriptionCopy = {
  AVAILABLE: "Peluang katalog terkait Trend terpublikasi untuk tipe akun Anda.",
  EMPTY: "Belum ada peluang dengan Trend terpublikasi untuk tipe akun Anda.",
  UNAVAILABLE: "Preview peluang belum tersedia saat ini.",
  ERROR: "Katalog peluang belum dapat dimuat. Bagian Dashboard lainnya tetap tersedia.",
} as const;

export type OpportunityPreviewSectionProps = {
  readonly state: DashboardOpportunityModuleState;
  readonly title: string;
};

export function OpportunityPreviewSection({ state, title }: OpportunityPreviewSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="h-full">
      <Card className="flex h-full flex-col justify-between gap-16 p-20 sm:p-28 transition-all duration-300 border-[#ded8cb] bg-[#faf9f6] hover:border-midnight-wine/40 hover:shadow-xs">
        <div className="grid gap-14">
          <div className="flex flex-wrap items-baseline justify-between gap-8">
            <div className="flex items-center gap-10">
              <span className="flex size-36 shrink-0 items-center justify-center rounded-small-buttons bg-midnight-wine/15 text-midnight-wine border border-midnight-wine/25">
                <CompassIcon className="size-18" />
              </span>
              <h2
                className="text-label-bold font-w460 leading-label-bold text-ink-charcoal"
                id={headingId}
              >
                {title}
              </h2>
            </div>
            <Badge tone={state.status === "AVAILABLE" ? "wash" : "neutral"}>{statusCopy[state.status]}</Badge>
          </div>

          <p className="text-body-sm leading-relaxed text-stone-gray">
            {descriptionCopy[state.status]}
          </p>

          {state.status === "AVAILABLE" ? (
            <ul className="divide-y divide-soft-mist/70 border-y border-soft-mist/70">
              {state.preview.map((opportunity) => (
                <li
                  className="py-14 first:pt-0 last:pb-0 grid content-start gap-4"
                  key={opportunity.id}
                >
                  <span className="text-caption font-w540 uppercase tracking-wider text-midnight-wine">{opportunity.categoryName}</span>
                  <h3 className="text-body font-w540 text-ink-charcoal">
                    <Link
                      className="transition-colors hover:text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                      href={`/opportunities/${opportunity.id}`}
                    >
                      {opportunity.name}
                    </Link>
                  </h3>
                  <p className="text-body-sm leading-relaxed text-stone-gray">{opportunity.summary}</p>
                  <p className="text-caption font-w460 leading-relaxed text-stone-gray border-t border-soft-mist/40 pt-4">
                    Trend terkait: {opportunity.relatedTrendTitle}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-small-buttons border border-soft-mist/60 bg-warm-parchment/60 p-14 text-caption leading-relaxed text-stone-gray">
              Kembangkan hipotesis bisnis yang berakar pada sinyal tren riil dan modal yang sesuai dengan kapabilitas Anda.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-soft-mist/60">
          <Link
            className="group inline-flex min-h-button w-fit items-center gap-8 rounded-small-buttons border border-ink-charcoal bg-lilac-mist px-16 py-8 text-body-sm font-w540 text-ink-charcoal transition-all duration-200 hover:bg-paper-white focus-visible:outline-2 focus-visible:outline-royal-violet"
            href="/opportunities"
          >
            <span>Jelajahi Peluang</span>
            <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
