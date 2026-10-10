import Link from "next/link";
import { useId } from "react";

import type { DashboardOpportunityModuleState } from "../../dashboard/dto";

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
      <p className="text-body-sm leading-body-sm text-stone-gray">{descriptionCopy[state.status]}</p>
      {state.status === "AVAILABLE" ? (
        <ul className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
          {state.preview.map((opportunity) => (
            <li
              className="grid content-start gap-8 border border-soft-mist bg-paper-white p-16"
              key={opportunity.id}
            >
              <p className="text-caption font-w540 text-stone-gray">{opportunity.categoryName}</p>
              <h3 className="text-label-bold font-w460 leading-label-bold text-ink-charcoal">
                <Link
                  className="transition-colors hover:text-royal-violet hover:underline"
                  href={`/opportunities/${opportunity.id}`}
                >
                  {opportunity.name}
                </Link>
              </h3>
              <p className="text-body-sm leading-body-sm text-stone-gray">{opportunity.summary}</p>
              <p className="text-caption leading-body-sm text-stone-gray">
                Trend terkait: {opportunity.relatedTrendTitle}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline-offset-4 transition-colors hover:text-midnight-wine hover:underline"
        href="/opportunities"
      >
        Lihat semua peluang
      </Link>
    </section>
  );
}
