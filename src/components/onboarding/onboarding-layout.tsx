import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageContainer } from "@/components/ui";

import {
  OnboardingProgressProvider,
  OnboardingProgressSlot,
} from "./onboarding-progress-context";

type OnboardingLayoutProps = Readonly<{
  children: ReactNode;
  showBackToSelection?: boolean;
}>;

export function OnboardingLayout({
  children,
  showBackToSelection = false,
}: OnboardingLayoutProps) {
  return (
    <main className="min-h-dvh bg-warm-parchment text-ink-charcoal selection:bg-lilac-mist">
      <OnboardingProgressProvider>
        <PageContainer className="pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] sm:pb-48 sm:pt-32 lg:max-w-[1360px] lg:pb-64 lg:pt-48">
          <section
            aria-label="Persiapan profil usaha"
            className="grid gap-20 lg:grid-cols-[minmax(17rem,26rem)_minmax(0,1fr)] lg:items-stretch lg:gap-32"
          >
            <aside className="hidden lg:sticky lg:top-24 lg:col-start-1 lg:row-start-1 lg:block lg:self-start">
              <OnboardingProgressSlot
                className="mb-24 w-full max-w-[30rem] md:mx-auto lg:mx-0"
                tone="paper"
              />

              <div className="relative flex min-h-[23rem] flex-col gap-32 overflow-hidden rounded-[1.5rem] bg-[#14080e] p-24 pb-64 text-paper-white sm:min-h-[25rem] sm:p-32 sm:pb-80 lg:h-[calc(100dvh-14rem)] lg:min-h-[34rem] lg:justify-between lg:rounded-[2rem] lg:p-40 xl:p-48">
                <Image
                  alt="Interior kedai F&B bernuansa hangat, dengan cahaya sore melalui jendela"
                  className="object-cover object-center"
                  fill
                  priority
                  sizes="(min-width: 1024px) 416px, (min-width: 640px) calc(100vw - 48px), calc(100vw - 32px)"
                  src="/images/hero-editorial.png"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#14080e]/75 via-[#14080e]/40 to-[#14080e]/15 lg:bg-gradient-to-t lg:from-[#14080e]/90 lg:via-[#14080e]/25 lg:to-[#14080e]/10"
                />

                <p className="relative z-10 text-caption font-w540 uppercase tracking-[0.14em] text-paper-white/75">
                  VENTUREX <span aria-hidden="true">&middot;</span> Usaha F&amp;B
                </p>

                <div className="relative z-10 max-w-[34rem] lg:mb-8 lg:max-w-[26rem]">
                  <h2 className="max-w-[18ch] text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-paper-white sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg">
                    Setiap usaha punya titik awal yang berbeda.
                  </h2>
                  <p className="mt-12 max-w-[42ch] text-body-sm leading-body-sm text-paper-white/75">
                    Mulai dari ide usaha atau lanjutkan bisnis yang sudah berjalan.
                  </p>
                </div>
              </div>
            </aside>

            <div className="relative z-10 w-full rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-32 lg:col-start-2 lg:row-start-1 lg:self-start lg:p-36 xl:p-40">
              <OnboardingProgressSlot className="mb-24 lg:hidden" tone="paper" />
              {showBackToSelection ? (
                <Link
                  className="mb-24 inline-flex min-h-[44px] items-center gap-8 rounded-small-buttons text-body-sm font-w540 text-stone-gray transition-colors hover:text-midnight-wine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
                  href="/onboarding?reselect=1"
                >
                  <svg
                    aria-hidden="true"
                    className="size-16"
                    fill="none"
                    viewBox="0 0 16 16"
                  >
                    <path
                      d="M13 8H3m4.5-4.5L3 8l4.5 4.5"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                  Kembali ke pemilihan jalur
                </Link>
              ) : null}
              {children}
            </div>
          </section>
        </PageContainer>
      </OnboardingProgressProvider>
    </main>
  );
}
