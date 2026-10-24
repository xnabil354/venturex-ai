import type { ReactNode } from "react";

import { PageContainer } from "@/components/ui";

export function ProfileSurface({ children }: { readonly children: ReactNode }) {
  return (
    <main className="relative isolate min-h-[calc(100dvh-64px)] overflow-hidden bg-warm-parchment">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[url('/images/culinary-craft.jpg')] bg-cover bg-center"
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-paper-white/85" />
      <PageContainer className="relative z-10">{children}</PageContainer>
    </main>
  );
}
