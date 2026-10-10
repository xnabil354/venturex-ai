import Link from "next/link";
import { useId } from "react";

import type { DashboardTrendModuleState } from "../../dashboard/dto";

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
    <section aria-labelledby={headingId} className="grid gap-12 border-t border-soft-mist pt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-8">
        <h2
          className="text-label-bold font-w460 leading-label-bold text-ink-charcoal"
          id={headingId}
        >
          {title}
        </h2>
        <p className="text-caption font-w540 text-stone-gray">{statusCopy[state.status]}</p>
      </div>
      <p className="text-body-sm leading-body-sm text-stone-gray">
        {descriptionCopy[state.status]}
      </p>
      {state.status === "AVAILABLE" ? (
        <ul className="grid gap-12">
          {state.preview.map((trend) => (
            <li className="grid gap-8 border border-soft-mist bg-paper-white p-16" key={trend.id}>
              <p className="text-caption font-w540 text-stone-gray">{trend.categoryName}</p>
              <h3 className="text-label-bold font-w460 leading-label-bold text-ink-charcoal">
                <Link
                  className="transition-colors hover:text-royal-violet hover:underline"
                  href={`/trends/${trend.id}`}
                >
                  {trend.title}
                </Link>
              </h3>
              <p className="text-body-sm leading-body-sm text-stone-gray">{trend.summary}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline-offset-4 transition-colors hover:text-midnight-wine hover:underline"
        href="/trends"
      >
        Lihat semua Trend
      </Link>
    </section>
  );
}
