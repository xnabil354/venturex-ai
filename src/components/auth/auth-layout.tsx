import Link from "next/link";
import type { ReactNode } from "react";

import { PageContainer } from "@/components/ui";

export function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="min-h-dvh bg-warm-parchment">
      <PageContainer className="flex min-h-dvh items-start py-24 sm:py-40 lg:py-64">
        <div className="grid w-full gap-32 lg:grid-cols-2 lg:gap-64">
          <section className="max-w-xl lg:pt-16">
            <Link
              aria-label="VENTUREX home"
              className="inline-flex min-h-button items-center text-body font-w540 tracking-[0.02em] text-ink-charcoal transition-colors hover:text-royal-violet"
              href="/"
            >
              VENTUREX
            </Link>
            <p className="mt-24 max-w-[30ch] text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg">
              Ruang kerja untuk membaca peluang bisnis F&amp;B.
            </p>
            <p className="mt-16 max-w-[48ch] text-body-sm leading-body-sm text-stone-gray">
              Masuk atau buat akun untuk melanjutkan ke ruang kerja VENTUREX.
            </p>
          </section>
          <div className="min-w-0">{children}</div>
        </div>
      </PageContainer>
    </main>
  );
}
