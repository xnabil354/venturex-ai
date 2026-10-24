import { cx } from "@/lib/cx";
import type {
  SearchApiOpportunityEvidence,
  SearchApiOpportunitySignalOption,
} from "@/opportunity/searchapi-evidence-contract";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";

export function sourceTypeLabel(source: SearchApiOpportunitySignalOption["sourceType"]): string {
  return source === "RELATED_QUERY_TOP" ? "Kueri terpopuler" : "Kueri makin populer";
}

export function sourceMetricLabel(source: SearchApiOpportunityEvidence): string {
  if (source.sourceType === "RELATED_QUERY_TOP") {
    return source.interestIndex === null ? "Indeks minat tidak tersedia" : `Indeks minat: ${source.interestIndex}`;
  }
  if (source.isBreakout) return "Pertumbuhan: Breakout";
  if (source.growthLabel) return `Pertumbuhan: ${source.growthLabel}`;
  if (source.growthPercent !== null) return `Pertumbuhan: +${source.growthPercent}%`;
  return "Pertumbuhan tidak tersedia";
}

export function opportunityTypeLabel(value: string | undefined): string | null {
  if (!value) return null;
  const labels: Readonly<Record<string, string>> = {
    PRODUCT_CONCEPT: "Konsep produk",
    BUSINESS_CONCEPT: "Konsep usaha",
    NEW_MENU: "Menu baru",
    NEW_VARIANT: "Varian baru",
    PRODUCT_EXTENSION: "Ekstensi produk",
    ADJACENT_MARKET: "Segmen berdekatan",
    SALES_CHANNEL_EXPERIMENT: "Eksperimen kanal",
    POSITIONING_EXPERIMENT: "Eksperimen positioning",
  };
  return labels[value] ?? null;
}

export function SavedSource({ item }: { readonly item: PrivateOpportunityIdeaDto }) {
  if (item.source.transport === "SearchApi.io") {
    return (
      <p>
        Sumber: Google Trends · “{item.source.query}”.{" "}
        <a className="font-w540 text-royal-violet underline underline-offset-2" href={item.source.url} rel="noreferrer" target="_blank">Lihat sumber</a>.
      </p>
    );
  }

  return <p>Sumber: Google Trends · “{item.source.title}”.</p>;
}

export function SignalOption({
  option,
  selected,
  onSelect,
}: {
  readonly option: SearchApiOpportunitySignalOption;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <div className={cx(
      "grid gap-6 rounded-cards border p-12 transition-colors",
      selected ? "border-midnight-wine bg-lilac-mist/30" : "border-soft-mist bg-paper-white hover:border-stone-gray",
    )}>
      <label className="flex cursor-pointer items-start gap-10 text-body-sm text-ink-charcoal">
        <input
          checked={selected}
          className="mt-3 size-16 shrink-0 accent-midnight-wine"
          name="opportunity-searchapi-source"
          onChange={() => onSelect(option.id)}
          type="radio"
          value={option.id}
        />
        <span className="grid min-w-0 gap-4">
          <span className="wrap-anywhere font-w540">{option.query}</span>
          <span className="flex flex-wrap gap-x-8 gap-y-2 text-caption text-stone-gray">
            <span>{sourceTypeLabel(option.sourceType)}</span>
            <span aria-hidden="true">·</span>
            <span>{sourceMetricLabel(option)}</span>
          </span>
          <span className="text-caption text-stone-gray">Posisi {option.position}</span>
        </span>
      </label>
      <a className="ml-26 w-fit text-caption font-w540 text-royal-violet underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-royal-violet" href={option.url} rel="noreferrer" target="_blank">
        Google Trends Explore
      </a>
    </div>
  );
}
