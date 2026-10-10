import type { HTMLAttributes } from "react";

import { cx } from "@/lib/cx";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cx(
        "rounded-cards border border-soft-mist bg-paper-white p-16",
        className,
      )}
    />
  );
}
