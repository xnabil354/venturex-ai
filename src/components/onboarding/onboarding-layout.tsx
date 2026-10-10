import Link from "next/link";
import type { ReactNode } from "react";

import { PageContainer } from "@/components/ui";

export function OnboardingLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="min-h-dvh bg-warm-parchment">
      <PageContainer className="flex min-h-dvh items-start py-32 sm:py-48 lg:py-64">
        <div className="grid w-full gap-32 lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1fr)] lg:gap-64">
          <section className="max-w-xl lg:pt-16">
            <Link
              aria-label="VENTUREX home"
              className="inline-flex min-h-button items-center text-body font-w540 tracking-[0.02em] text-ink-charcoal transition-colors hover:text-royal-violet"
              href="/"
            >
              VENTUREX
            </Link>
            <p className="mt-24 max-w-[30ch] text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg">
              Mulai dari konteks yang tepat.
            </p>
            <p className="mt-16 max-w-[48ch] text-body-sm leading-body-sm text-stone-gray">
              Pilih jalur akun Anda sebelum detail profil usaha disiapkan.
            </p>
          </section>
          <div className="min-w-0">{children}</div>
        </div>
      </PageContainer>
    </main>
  );
}
