import { LiveTrendSignalsPanel } from "@/components/trends/live-trend-signals-panel";
import { PageContainer } from "@/components/ui";

export function TrendList({ initialKeyword = "", publicHttpTransport = false }: { readonly initialKeyword?: string; readonly publicHttpTransport?: boolean }) {
  return (
    <PageContainer>
      <div className="py-32 sm:py-48 lg:py-64">
        <header className="mb-32 grid max-w-[720px] gap-12">
          <p className="text-label-bold font-w460 text-royal-violet">Trend Intelligence</p>
          <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
            Trend Radar
          </h1>
          <p className="text-body leading-body text-stone-gray">
            Observasi Google Trends Indonesia diambil langsung saat Anda meminta refresh. Sinyal ini belum menjadi Trend VENTUREX yang divalidasi atau dipublikasikan.
          </p>
        </header>
        <LiveTrendSignalsPanel initialKeyword={initialKeyword} publicHttpTransport={publicHttpTransport} />
      </div>
    </PageContainer>
  );
}
