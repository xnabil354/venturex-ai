import { LiveTrendSignalsPanel } from "@/components/trends/live-trend-signals-panel";
import { PageContainer } from "@/components/ui";

export function TrendList({ initialKeyword = "", publicHttpTransport = false }: { readonly initialKeyword?: string; readonly publicHttpTransport?: boolean }) {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <header className="mb-32 grid max-w-[760px] gap-12 border-b border-soft-mist pb-24">
          <div className="flex items-center gap-12">
            <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
              Trend Radar
            </h1>
            <span className="rounded-pills border border-deep-lagoon/20 bg-deep-lagoon/10 px-10 py-3 text-caption font-w540 uppercase tracking-wider text-deep-lagoon shadow-2xs">
              Live Signals
            </span>
          </div>
          <p className="text-body leading-relaxed text-stone-gray">
            Observasi Google Trends Indonesia diambil langsung saat Anda meminta refresh. Sinyal ini belum menjadi Trend VENTUREX yang divalidasi atau dipublikasikan.
          </p>
        </header>
        <LiveTrendSignalsPanel initialKeyword={initialKeyword} publicHttpTransport={publicHttpTransport} />
      </div>
    </PageContainer>
  );
}
