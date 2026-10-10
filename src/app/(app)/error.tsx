"use client";

import { ShellErrorState } from "@/components/layout/shell-states";

export default function Error({ reset }: { reset: () => void }) {
  return <ShellErrorState onRetry={reset} />;
}
