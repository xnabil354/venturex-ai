import type { HTMLAttributes } from "react";

import { cx } from "@/lib/cx";

type BadgeTone = "neutral" | "accent" | "wash";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-soft-mist bg-paper-white text-ink-charcoal",
  accent: "border-royal-violet bg-paper-white text-royal-violet",
  wash: "border-ink-charcoal bg-lilac-mist text-ink-charcoal",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex min-h-8 items-center rounded-pills border px-8 text-caption font-w540",
        toneClasses[tone],
        className,
      )}
    />
  );
}
