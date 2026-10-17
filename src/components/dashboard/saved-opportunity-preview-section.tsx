import Link from "next/link";
import { useId } from "react";

import type { DashboardSavedOpportunityModuleState } from "../../dashboard/dto";
import { Badge, Card } from "../ui";
import { ArrowRightIcon, TargetIcon } from "../landing/icons";

const statusCopy = {
  AVAILABLE: "Tersedia",
  EMPTY: "Belum ada data",
  UNAVAILABLE: "Belum tersedia",
  ERROR: "Tidak dapat dimuat",
} as const;

const descriptionCopy = {
  AVAILABLE: "Peluang tersimpan yang masih sesuai untuk tipe akun Anda.",
  EMPTY: "Belum ada peluang eligible yang tersimpan.",
  UNAVAILABLE: "Penyimpanan peluang belum tersedia di aplikasi.",
  ERROR: "Peluang tersimpan belum dapat dimuat saat ini. Ringkasan Dashboard tetap tersedia.",
} as const;

export type SavedOpportunityPreviewSectionProps = {
  readonly state: DashboardSavedOpportunityModuleState;
  readonly title: string;
};

export function SavedOpportunityPreviewSection({
  state,
  title,
}: SavedOpportunityPreviewSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="h-full">
      <Card className="flex h-full flex-col justify-between gap-16 p-20 sm:p-28 transition-all duration-300 border-[#ded8cb] bg-[#faf9f6] hover:border-royal-violet/40 hover:shadow-xs">
        <div className="grid gap-14">
          <div className="flex flex-wrap items-baseline justify-between gap-8">
            <div className="flex items-center gap-10">
              <span className="flex size-36 shrink-0 items-center justify-center rounded-small-buttons bg-royal-violet/10 text-royal-violet border border-royal-violet/20">
                <TargetIcon className="size-18" />
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

          <p className="text-body-sm leading-relaxed text-stone-gray">{descriptionCopy[state.status]}</p>

          {state.status === "AVAILABLE" ? (
            <ul className="divide-y divide-soft-mist/70 border-y border-soft-mist/70 sm:grid sm:grid-cols-2 sm:gap-x-24 sm:gap-y-16 sm:divide-y-0 sm:border-y-0 lg:grid-cols-3">
              {state.preview.map((opportunity) => (
                <li className="py-14 first:pt-0 sm:py-0 grid content-start gap-4" key={opportunity.id}>
                  <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">{opportunity.categoryName}</span>
                  <h3 className="text-body font-w540 text-ink-charcoal">
                    <Link
                      className="transition-colors hover:text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                      href={`/opportunities/${opportunity.id}`}
                    >
                      {opportunity.name}
                    </Link>
                  </h3>
                  <p className="text-body-sm leading-relaxed text-stone-gray">{opportunity.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-small-buttons border border-soft-mist/60 bg-warm-parchment/60 p-14 text-caption leading-relaxed text-stone-gray">
              Simpan ide peluang yang menjanjikan saat melakukan riset untuk dievaluasi kelayakannya lebih lanjut.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-soft-mist/60">
          <Link
            className="group inline-flex min-h-button w-fit items-center gap-8 text-body-sm font-w540 text-royal-violet underline underline-offset-4 transition-colors hover:text-midnight-wine focus-visible:outline-2 focus-visible:outline-royal-violet"
            href="/saved"
          >
            <span>Lihat semua peluang tersimpan</span>
            <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
