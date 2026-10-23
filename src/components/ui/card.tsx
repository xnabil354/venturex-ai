import type { HTMLAttributes } from "react";

import { cx } from "@/lib/cx";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  readonly surface?: "paper" | "transparent";
};

export function Card({ className, surface = "paper", ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cx(
        "rounded-cards border border-soft-mist p-16",
        surface === "paper" ? "bg-paper-white" : undefined,
        className,
      )}
    />
  );
}
