import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "@/lib/cx";

export type StatusNoticeTone = "info" | "success" | "warning" | "error";

export type StatusNoticeProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: StatusNoticeTone;
};

const toneClasses: Record<StatusNoticeTone, string> = {
  info: "border-soft-mist bg-paper-white text-ink-charcoal",
  success: "border-ink-charcoal bg-lilac-mist/45 text-ink-charcoal",
  warning: "border-midnight-wine/35 bg-lilac-mist/35 text-ink-charcoal",
  error: "border-midnight-wine bg-paper-white text-ink-charcoal",
};

export function StatusNotice({
  children,
  className,
  tone = "info",
  ...props
}: StatusNoticeProps) {
  return (
    <div
      {...props}
      className={cx(
        "rounded-small-buttons border px-14 py-12 text-body-sm leading-body-sm",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
