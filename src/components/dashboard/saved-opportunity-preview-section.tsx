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
  AVAILABLE: "Hipotesis pilihan Anda untuk ditinjau kembali.",
  EMPTY: "Simpan hipotesis yang ingin Anda lanjutkan dari Opportunity Finder.",
  UNAVAILABLE: "Simpan peluang yang ingin Anda nilai lebih lanjut.",
  ERROR: "Peluang tersimpan belum dapat dimuat saat ini. Bagian lain di Dashboard tetap tersedia.",
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
      <Card className="grid gap-16 border-royal-violet/20 bg-lilac-mist/15 p-20 transition-colors duration-200 hover:border-royal-violet/40 sm:p-24">
        <div className="grid min-w-0 gap-14">
          <div className="flex flex-wrap items-center justify-between gap-10">
            <div className="flex items-center gap-10">
              <span className="flex size-36 shrink-0 items-center justify-center rounded-small-buttons border border-royal-violet/20 bg-paper-white/70 text-royal-violet">
                <TargetIcon className="size-18" />
              </span>
              <h2
                className="text-label-bold font-w460 leading-label-bold text-ink-charcoal"
                id={headingId}
              >
                {title}
              </h2>
            </div>
            <Badge tone={state.status === "AVAILABLE" ? "wash" : "neutral"}>{state.status === "AVAILABLE" ? `${state.preview.length} tersimpan` : statusCopy[state.status]}</Badge>
          </div>

          <p className="text-body-sm leading-relaxed text-stone-gray">{descriptionCopy[state.status]}</p>

          {state.status === "AVAILABLE" ? (
            <ul className="divide-y divide-royal-violet/15 border-y border-royal-violet/15 sm:grid sm:grid-cols-2 sm:gap-x-24 sm:gap-y-16 sm:divide-y-0 sm:border-y-0 lg:grid-cols-3">
              {state.preview.map((opportunity) => (
                <li className="py-14 first:pt-0 sm:py-0 grid content-start gap-4" key={opportunity.id}>
                  <span className="text-caption font-w540 uppercase tracking-wider text-royal-violet">{opportunity.categoryName}</span>
                  <h3 className="break-words text-body font-w540 text-ink-charcoal">
                    <Link
                      className="transition-colors hover:text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                      href={opportunity.href ?? `/opportunities/${opportunity.id}`}
                    >
                      {opportunity.name}
                    </Link>
                  </h3>
                  <p className="line-clamp-2 text-body-sm leading-relaxed text-stone-gray">{opportunity.summary}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex sm:justify-end">
          <Link
            className="group inline-flex min-h-button w-full items-center justify-center gap-8 rounded-small-buttons border border-royal-violet/30 bg-paper-white px-14 text-body-sm font-w540 text-royal-violet transition-colors hover:border-royal-violet hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet sm:w-fit"
            href="/saved"
          >
            <span>Lihat semua peluang tersimpan</span>
            <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </div>
      </Card>
    </section>
  );
}
