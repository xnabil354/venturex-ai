import { useId, type ReactNode } from "react";

import { Badge, Card } from "../ui";
import type { DashboardReference } from "../../dashboard/dto";

export type ProfileSummaryProps = {
  readonly action?: ReactNode;
  readonly children: ReactNode;
  readonly statusLabel: string | null;
  readonly title: string;
};

export function ProfileSummary({ action, children, statusLabel, title }: ProfileSummaryProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="grid gap-12 sm:gap-16">
      <div className="flex flex-col items-start gap-10 sm:flex-row sm:items-center sm:justify-between">
        <h2
          className="text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal"
          id={headingId}
        >
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-8 sm:gap-12">
          {action}
          {statusLabel ? <Badge tone="wash">{statusLabel}</Badge> : null}
        </div>
      </div>
      <Card className="overflow-hidden border border-[#ded8cb] bg-[#faf9f6] shadow-xs p-0">{children}</Card>
    </section>
  );
}

export type SummaryFieldProps = {
  readonly children: ReactNode;
  readonly label: string;
};

export function SummaryField({ children, label }: SummaryFieldProps) {
  return (
    <div className="flex flex-col justify-between gap-6 p-16 sm:p-20 transition-colors hover:bg-warm-parchment/60">
      <dt className="text-caption font-w540 uppercase tracking-wider text-[#73685c]">{label}</dt>
      <dd className="min-w-0 text-body font-w540 text-ink-charcoal tabular-nums">{children}</dd>
    </div>
  );
}

export function SummaryReferences({ items }: { readonly items: readonly DashboardReference[] }) {
  if (items.length === 0) {
    return <span className="text-stone-gray">Belum dipilih</span>;
  }

  return (
    <ul className="flex flex-wrap gap-6">
      {items.map((item) => (
        <li
          key={item.code}
          className="inline-flex items-center rounded-pills border border-[#ded8cb] bg-paper-white px-10 py-3 text-caption font-w540 text-ink-charcoal shadow-2xs transition-all duration-200 hover:scale-105 hover:bg-warm-parchment hover:border-midnight-wine/40 cursor-default"
        >
          {item.name}
        </li>
      ))}
    </ul>
  );
}
