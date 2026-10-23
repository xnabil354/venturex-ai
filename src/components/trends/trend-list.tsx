import { TrendRadarPanel } from "@/components/trends/trend-radar-panel";
import Link from "next/link";
import { PageContainer } from "@/components/ui";

export function TrendList({ productQuery = "", currentYear, today, viewerId, queryKey }: { readonly queryKey?: string; readonly productQuery?: string; readonly currentYear?: number; readonly today?: string; readonly viewerId?: string }) {
  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-[1120px] py-32 sm:py-48 lg:py-64">
        <header className="mb-32 grid max-w-[760px] gap-12 border-b border-soft-mist pb-24">
          <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
            Trend Radar
          </h1>
          <p className="text-body leading-relaxed text-stone-gray">
            Jelajahi tren populer dan yang sedang meningkat berdasarkan produk usaha di profil Anda. Data sumber belum ditinjau sebagai Trend VENTUREX.
          </p>
        </header>
        {!productQuery ? <p className="mb-24 rounded-cards border border-soft-mist bg-paper-white p-16 text-body-sm">Lengkapi produk usaha untuk mulai eksplorasi. <Link className="inline-flex min-h-button items-center text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet" href="/profile">Edit profil</Link></p> : null}
        <TrendRadarPanel
          {...(queryKey ? { queryKey } : {})}
          {...(viewerId ? { viewerId } : {})}
          {...(currentYear === undefined ? {} : { currentYear })}
          productQuery={productQuery}
          {...(today === undefined ? {} : { today })}
        />
      </div>
    </PageContainer>
  );
}
