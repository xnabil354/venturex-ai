import Link from "next/link";
import { useId } from "react";

import type { DashboardTrendModuleState } from "../../dashboard/dto";
import { Badge, Card } from "../ui";
import { ArrowRightIcon, TrendingUpIcon } from "../landing/icons";

const statusCopy = {
  AVAILABLE: "Tersedia",
  EMPTY: "Belum ada data",
  UNAVAILABLE: "Belum tersedia",
  ERROR: "Tidak dapat dimuat",
} as const;

const descriptionCopy = {
  AVAILABLE: "Cuplikan hasil pencarian terakhir Anda.",
  EMPTY: "Muat data di Trend Radar untuk melihat preview di sini.",
  UNAVAILABLE: "Pantau minat pencarian untuk produk usaha Anda.",
  ERROR: "Trend belum dapat dimuat saat ini. Bagian lain di Dashboard tetap tersedia.",
} as const;

export type TrendPreviewSectionProps = {
  readonly state: DashboardTrendModuleState;
  readonly title: string;
};

export function TrendPreviewSection({ state, title }: TrendPreviewSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <Card className="flex flex-col gap-16 border-[#ded8cb] bg-paper-white p-20 transition-colors duration-200 hover:border-deep-lagoon/40 sm:p-24">
        <div className="grid gap-14">
          <div className="flex flex-wrap items-center justify-between gap-10">
            <div className="flex items-center gap-10">
              <span className="flex size-36 shrink-0 items-center justify-center rounded-small-buttons border border-deep-lagoon/25 bg-deep-lagoon/10 text-deep-lagoon">
                <TrendingUpIcon className="size-18" />
              </span>
              <h2
                className="text-label-bold font-w460 leading-label-bold text-ink-charcoal"
                id={headingId}
              >
                {title}
              </h2>
            </div>
            <Badge tone={state.status === "AVAILABLE" ? "wash" : "neutral"}>{state.status === "AVAILABLE" ? `${state.preview.length} sinyal` : statusCopy[state.status]}</Badge>
          </div>

          <p className="text-body-sm leading-relaxed text-stone-gray">
            {descriptionCopy[state.status]}
          </p>
          {state.context ? <p className="break-words rounded-small-buttons bg-warm-parchment px-12 py-10 text-caption leading-relaxed text-stone-gray">{state.context}</p> : null}

          {state.status === "AVAILABLE" ? (
            <ul className="grid gap-x-24 divide-y divide-soft-mist/70 border-y border-soft-mist/70 md:grid-cols-2 xl:grid-cols-3 md:divide-y-0">
              {state.preview.map((trend) => (
                <li className="py-14" key={trend.id}>
                  <span className="text-caption font-w540 uppercase tracking-wider text-deep-lagoon">{trend.categoryName}</span>
                  <h3 className="mt-4 break-words text-body font-w540 text-ink-charcoal">
                    <Link
                      className="transition-colors hover:text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                      href={trend.href ?? `/trends/${trend.id}`}
                    >
                      {trend.title}
                    </Link>
                  </h3>
                  <p className="text-body-sm leading-relaxed text-stone-gray mt-4">{trend.summary}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-auto border-t border-soft-mist/70 pt-10">
          <Link
            className="group inline-flex min-h-button w-fit items-center gap-8 rounded-small-buttons px-10 text-body-sm font-w540 text-deep-lagoon transition-colors hover:text-midnight-wine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
            href="/trends"
          >
            <span>Lihat semua Trend</span>
            <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
