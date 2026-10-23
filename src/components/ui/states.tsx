import { useId } from "react";
import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

export type EmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description: string;
  title: string;
};

export function EmptyState({
  action,
  className,
  description,
  title,
}: EmptyStateProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cx(
        "grid max-w-[62ch] gap-12 rounded-cards border border-soft-mist bg-paper-white p-20 text-left sm:p-24",
        className,
      )}
    >
      <h3
        className="text-label-bold font-w460 leading-label-bold text-ink-charcoal"
        id={titleId}
      >
        {title}
      </h3>
      <p className="max-w-[48ch] text-body-sm text-stone-gray">{description}</p>
      {action ? (
        <div className="flex flex-wrap items-center gap-8">{action}</div>
      ) : null}
    </section>
  );
}

export type LoadingSkeletonProps = {
  className?: string;
};

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div
      aria-label="Loading"
      aria-live="polite"
      className={cx(
        "animate-pulse rounded-small-buttons bg-soft-mist/70",
        className,
      )}
      role="status"
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}
