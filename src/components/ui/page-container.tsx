import type { HTMLAttributes } from "react";

import { cx } from "@/lib/cx";

export function PageContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cx(
        "mx-auto w-full max-w-page px-16 sm:px-24 lg:px-32",
        className,
      )}
    />
  );
}
