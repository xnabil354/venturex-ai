import { useId } from "react";
import Link from "next/link";

import type { DashboardModuleState, DashboardModuleStatus } from "../../dashboard/dto";
import { Badge, Card } from "../ui";
import { ArrowRightIcon, RouteIcon } from "../landing/icons";
import { cx } from "@/lib/cx";

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
  readonly href?: string;
};

export function ModuleStatusCard({ description, state, title, href }: ModuleStatusCardProps) {
  const headingId = useId();
  const isAvailable = state.status === "AVAILABLE";

  return (
    <section aria-labelledby={headingId}>
      <Card
        className={cx(
          "grid gap-16 p-24 sm:p-32 transition-all duration-300",
          isAvailable
            ? "border-paper-white/10 bg-deep-lagoon text-paper-white shadow-lg hover:shadow-2xl hover:border-paper-white/20"
            : "border-[#ded8cb] bg-[#faf9f6] shadow-xs text-ink-charcoal",
        )}
      >
        <div className="flex flex-col gap-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-14">
            <span
              className={cx(
                "flex size-44 shrink-0 items-center justify-center rounded-small-buttons border transition-colors",
                isAvailable
                  ? "border-paper-white/20 bg-paper-white/15 text-lilac-mist"
                  : "border-[#ded8cb] bg-warm-parchment text-midnight-wine",
              )}
            >
              <RouteIcon className="size-20" />
            </span>
            <div className="grid gap-4">
              <span
                className={cx(
                  "text-caption font-w540 uppercase tracking-widest",
                  isAvailable ? "text-lilac-mist" : "text-royal-violet",
                )}
              >
                Langkah Eksekusi Utama
              </span>
              <h2
                className={cx(
                  "text-heading-sm font-w460 leading-heading-sm tracking-heading-sm",
                  isAvailable ? "text-paper-white" : "text-ink-charcoal",
                )}
                id={headingId}
              >
                {title}
              </h2>
            </div>
          </div>
          {isAvailable ? (
            <span className="inline-flex items-center gap-6 rounded-pills bg-paper-white/20 px-10 py-3 text-[11px] font-w540 text-paper-white border border-paper-white/10">
              <span className="h-6 w-6 rounded-full bg-emerald-400 animate-pulse" />
              {statusCopy[state.status]}
            </span>
          ) : (
            <Badge tone="neutral">{statusCopy[state.status]}</Badge>
          )}
        </div>

        <p
          className={cx(
            "max-w-[68ch] text-body-sm leading-relaxed",
            isAvailable ? "text-paper-white/80" : "text-stone-gray",
          )}
        >
          {description}
        </p>

        {href ? (
          <div className="pt-4">
            <Link
              className={cx(
                "group inline-flex min-h-[44px] items-center gap-10 px-20 py-8 text-body-sm font-w460 transition-all duration-200 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet",
                isAvailable
                  ? "rounded-buttons bg-paper-white text-midnight-wine hover:bg-lilac-mist shadow-xs"
                  : "rounded-small-buttons border border-ink-charcoal bg-lilac-mist text-ink-charcoal hover:bg-paper-white",
              )}
              href={href}
            >
              <span>Buka Roadmap</span>
              <ArrowRightIcon className="size-14 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        ) : null}
      </Card>
    </section>
  );
}
