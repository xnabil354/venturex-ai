import {
  OPPORTUNITY_SCORE_COMPONENT_LABELS,
  type OpportunityScoreComponent,
} from "@/scoring/opportunity-score";
import type {
  OpportunityScoreDisplayState,
  OpportunityScoreServiceReason,
} from "@/scoring/opportunity-score-service";

function formatScore(value: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 6 }).format(value);
}

function formatWeight(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value);
}

function reasonCopy(reason: OpportunityScoreServiceReason): string {
  switch (reason) {
    case "CONFIGURATION_UNAVAILABLE":
      return "Konfigurasi Opportunity Score yang aktif belum tersedia.";
    case "CONFIGURATION_NOT_APPROVED":
      return "Konfigurasi Opportunity Score belum mendapat persetujuan produk.";
    case "CONFIGURATION_AMBIGUOUS":
      return "Ada lebih dari satu konfigurasi aktif sehingga skor belum dapat ditentukan.";
    case "INVALID_CONFIGURATION":
      return "Konfigurasi Opportunity Score belum lengkap atau belum valid.";
    case "INVALID_COMPONENTS":
      return "Ada nilai komponen tersimpan yang tidak valid.";
    case "COMPONENTS_UNAVAILABLE":
      return "Sebagian komponen belum memiliki input numerik yang disetujui.";
  }
}

function unavailableSourceItems(result: Exclude<OpportunityScoreDisplayState, { readonly status: "ERROR" }>) {
  return Object.entries(result.sources)
    .filter(([, source]) => source.status === "UNAVAILABLE")
    .map(([component, source]) => ({
      component: component as OpportunityScoreComponent,
      ...source,
    }));
}

export function OpportunityScoreDisplay({
  compact = false,
  result,
}: {
  readonly compact?: boolean;
  readonly result: OpportunityScoreDisplayState;
}) {
  if (result.status === "ERROR") {
    return (
      <p className="text-body-sm text-stone-gray" role="status">
        Opportunity Score sementara tidak dapat dimuat.
      </p>
    );
  }

  if (result.status === "INSUFFICIENT_DATA") {
    const unavailableSources = unavailableSourceItems(result);
    return (
      <div className="grid min-w-0 gap-8">
        <p className="text-body-sm text-stone-gray" role="status">
          Data belum cukup untuk menghitung skor secara layak.
        </p>
        <p className="wrap-anywhere text-caption leading-body-sm text-stone-gray">
          {reasonCopy(result.reason)}
        </p>
        {!compact && unavailableSources.length > 0 ? (
          <ul aria-label="Komponen Opportunity Score yang belum tersedia" className="grid gap-4">
            {unavailableSources.map(({ component, source, explanation }) => (
              <li className="wrap-anywhere text-caption leading-body-sm text-stone-gray" key={component}>
                {OPPORTUNITY_SCORE_COMPONENT_LABELS[component]}: {explanation} Sumber: {source}.
              </li>
            ))}
          </ul>
        ) : null}
        {!compact ? (
          <p className="max-w-[76ch] text-caption leading-body-sm text-stone-gray">
            {result.disclaimer}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-8">
      <span className="w-fit rounded-full border border-soft-mist bg-lilac-mist px-10 py-4 text-caption font-w540 text-ink-charcoal">
        MVP scoring model
      </span>
      <p aria-label={`Opportunity Score ${formatScore(result.score)} dari 100`} className="text-heading-sm font-w460 text-ink-charcoal">
        {formatScore(result.score)} <span className="text-body-sm text-stone-gray">/ 100</span>
      </p>
      <p className="wrap-anywhere text-caption text-stone-gray">
        Versi model: {result.modelVersion}
      </p>
      {!compact ? (
        <>
          <p className="max-w-[76ch] text-caption leading-body-sm text-stone-gray">
            Score menunjukkan attractiveness relatif dan bukan probabilitas keberhasilan.
          </p>
          <p className="text-caption font-w540 text-ink-charcoal">Bobot yang disetujui dan rincian komponen</p>
          <ul className="grid gap-8">
            {result.breakdown.map((item) => {
              const source = result.sources[item.component];
              return (
                <li className="grid min-w-0 gap-2 border-l border-soft-mist pl-12" key={item.component}>
                  <span className="wrap-anywhere text-body-sm font-w540 text-ink-charcoal">
                    {OPPORTUNITY_SCORE_COMPONENT_LABELS[item.component]}
                  </span>
                  <span className="wrap-anywhere text-caption leading-body-sm text-stone-gray">
                    Nilai {formatScore(item.normalizedValue)} · Bobot {formatWeight(item.weight)} · Kontribusi {formatScore(item.weightedContribution)}
                  </span>
                  <span className="wrap-anywhere text-caption leading-body-sm text-stone-gray">
                    Sumber: {source.source}.
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="max-w-[76ch] text-caption leading-body-sm text-stone-gray">
            {result.disclaimer}
          </p>
        </>
      ) : null}
    </div>
  );
}
