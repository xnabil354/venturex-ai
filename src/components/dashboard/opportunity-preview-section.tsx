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
  AVAILABLE: "Hipotesis terbaru yang sudah Anda buat.",
  EMPTY: "Buat hipotesis di Opportunity Finder untuk melihat ide Anda di sini.",
  UNAVAILABLE: "Rangkai sinyal tren menjadi ide yang bisa diuji.",
  ERROR: "Hipotesis belum dapat dimuat. Coba buka Opportunity Finder.",
} as const;

export type OpportunityPreviewSectionProps = {
  readonly state: DashboardOpportunityModuleState;
  readonly title: string;
};

export function OpportunityPreviewSection({ state, title }: OpportunityPreviewSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <Card className="flex flex-col gap-16 border-[#ded8cb] bg-paper-white p-20 transition-colors duration-200 hover:border-midnight-wine/40 sm:p-24">
        <div className="grid gap-14">
          <div className="flex flex-wrap items-center justify-between gap-10">
            <div className="flex items-center gap-10">
              <span className="flex size-36 shrink-0 items-center justify-center rounded-small-buttons border border-midnight-wine/25 bg-midnight-wine/10 text-midnight-wine">
                <CompassIcon className="size-18" />
              </span>
              <h2
                className="text-label-bold font-w460 leading-label-bold text-ink-charcoal"
                id={headingId}
              >
                {title}
              </h2>
            </div>
            <Badge tone={state.status === "AVAILABLE" ? "wash" : "neutral"}>{state.status === "AVAILABLE" ? `${state.preview.length} ide terbaru` : statusCopy[state.status]}</Badge>
          </div>

          <p className="text-body-sm leading-relaxed text-stone-gray">
            {descriptionCopy[state.status]}
          </p>

          {state.status === "AVAILABLE" ? (
            <ul className="grid gap-x-24 divide-y divide-soft-mist/70 border-y border-soft-mist/70 md:grid-cols-2 xl:grid-cols-3 md:divide-y-0">
              {state.preview.map((opportunity) => (
                <li
                  className="grid content-start gap-6 py-14"
                  key={opportunity.id}
                >
                  <span className="text-caption font-w540 uppercase tracking-wider text-midnight-wine">{opportunity.categoryName}</span>
                  <h3 className="break-words text-body font-w540 text-ink-charcoal">
                    <Link
                      className="transition-colors hover:text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                      href={opportunity.href ?? `/opportunities/${opportunity.id}`}
                    >
                      {opportunity.name}
                    </Link>
                  </h3>
                  <p className="line-clamp-3 text-body-sm leading-relaxed text-stone-gray">{opportunity.summary}</p>
                  <p className="break-words border-t border-soft-mist/40 pt-4 text-caption font-w460 leading-relaxed text-stone-gray">
                    {opportunity.generatedAt ? "Sinyal asal" : "Trend terkait"}: {opportunity.relatedTrendTitle}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-auto border-t border-soft-mist/70 pt-10">
          <Link
            className="group inline-flex min-h-button w-fit items-center gap-8 rounded-small-buttons px-10 text-body-sm font-w540 text-midnight-wine transition-colors hover:text-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
            href="/opportunities"
          >
            <span>Jelajahi Peluang</span>
            <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
