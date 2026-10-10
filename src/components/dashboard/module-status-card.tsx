import { useId } from "react";

import type { DashboardModuleState, DashboardModuleStatus } from "../../dashboard/dto";

const statusCopy = {
  AVAILABLE: "Tersedia",
  EMPTY: "Belum ada data",
  UNAVAILABLE: "Belum tersedia",
  ERROR: "Tidak dapat dimuat",
} as const satisfies Record<DashboardModuleStatus, string>;

export type ModuleStatusCardProps = {
  readonly description: string;
  readonly state: DashboardModuleState;
  readonly title: string;
};

export function ModuleStatusCard({ description, state, title }: ModuleStatusCardProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="grid gap-8 border-t border-soft-mist pt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-8">
        <h2
          className="text-label-bold font-w460 leading-label-bold text-ink-charcoal"
          id={headingId}
        >
          {title}
        </h2>
        <p className="text-caption font-w540 text-stone-gray">{statusCopy[state.status]}</p>
      </div>
      <p className="text-body-sm leading-body-sm text-stone-gray">{description}</p>
    </section>
  );
}
