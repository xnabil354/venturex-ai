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
    <section aria-labelledby={headingId} className="grid gap-16">
      <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
        <h2
          className="text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal"
          id={headingId}
        >
          {title}
        </h2>
        <div className="flex items-center gap-12">
          {action}
          {statusLabel ? <Badge tone="wash">{statusLabel}</Badge> : null}
        </div>
      </div>
      <Card>{children}</Card>
    </section>
  );
}

export type SummaryFieldProps = {
  readonly children: ReactNode;
  readonly label: string;
};

export function SummaryField({ children, label }: SummaryFieldProps) {
  return (
    <div className="grid gap-4 border-t border-soft-mist pt-12">
      <dt className="text-caption font-w540 text-stone-gray">{label}</dt>
      <dd className="min-w-0 text-body-sm leading-body-sm text-ink-charcoal">{children}</dd>
    </div>
  );
}

export function SummaryReferences({ items }: { readonly items: readonly DashboardReference[] }) {
  if (items.length === 0) {
    return <span className="text-stone-gray">Belum dipilih</span>;
  }

  return (
    <ul className="flex flex-wrap gap-x-12 gap-y-4">
      {items.map((item) => (
        <li key={item.code}>{item.name}</li>
      ))}
    </ul>
  );
}
