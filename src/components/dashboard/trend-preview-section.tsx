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
  AVAILABLE: "Trend terbit untuk tipe akun Anda.",
  EMPTY: "Belum ada Trend terbit untuk tipe akun Anda.",
  UNAVAILABLE: "Data tren belum tersedia di aplikasi.",
  ERROR: "Trend belum dapat dimuat saat ini. Ringkasan Dashboard tetap tersedia.",
} as const;

export type TrendPreviewSectionProps = {
  readonly state: DashboardTrendModuleState;
  readonly title: string;
};

export function TrendPreviewSection({ state, title }: TrendPreviewSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="h-full">
      <Card className="flex h-full flex-col justify-between gap-16 p-20 sm:p-28 transition-all duration-300 border-[#ded8cb] bg-[#faf9f6] hover:border-deep-lagoon/40 hover:shadow-xs">
        <div className="grid gap-14">
          <div className="flex flex-wrap items-baseline justify-between gap-8">
            <div className="flex items-center gap-10">
              <span className="flex size-36 shrink-0 items-center justify-center rounded-small-buttons bg-deep-lagoon/15 text-deep-lagoon border border-deep-lagoon/25">
                <TrendingUpIcon className="size-18" />
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
              {state.preview.map((trend) => (
                <li className="py-14 first:pt-0 last:pb-0" key={trend.id}>
                  <span className="text-caption font-w540 uppercase tracking-wider text-deep-lagoon">{trend.categoryName}</span>
                  <h3 className="text-body font-w540 text-ink-charcoal mt-4">
                    <Link
                      className="transition-colors hover:text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                      href={`/trends/${trend.id}`}
                    >
                      {trend.title}
                    </Link>
                  </h3>
                  <p className="text-body-sm leading-relaxed text-stone-gray mt-4">{trend.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-small-buttons border border-soft-mist/60 bg-warm-parchment/60 p-14 text-caption leading-relaxed text-stone-gray">
              Pantau pergeseran preferensi konsumen F&amp;B secara objektif dari data penelusuran digital Google Trends Indonesia.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-soft-mist/60">
          <Link
            className="group inline-flex min-h-button w-fit items-center gap-8 rounded-small-buttons border border-ink-charcoal bg-lilac-mist px-16 py-8 text-body-sm font-w540 text-ink-charcoal transition-all duration-200 hover:bg-paper-white focus-visible:outline-2 focus-visible:outline-royal-violet"
            href="/trends"
          >
            <span>Lihat semua Trend</span>
            <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
