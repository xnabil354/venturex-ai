import { Badge } from "@/components/ui/badge";
import { RISK_FACTOR_LABELS } from "@/scoring/risk-assessment";
import type { RiskAssessmentDisplayState } from "@/scoring/risk-assessment-service";

const LEVEL_LABELS = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
} as const;

const LEVEL_BORDER_CLASSES = {
  LOW: "border-soft-mist",
  MEDIUM: "border-ink-charcoal",
  HIGH: "border-midnight-wine",
} as const;

function reasonCopy(reason: Extract<RiskAssessmentDisplayState, { readonly status: "INSUFFICIENT_DATA" }> ["reason"]): string {
  switch (reason) {
    case "CONFIGURATION_UNAVAILABLE":
      return "Kebijakan Risk yang aktif dan disetujui belum tersedia.";
    case "CONFIGURATION_NOT_APPROVED":
      return "Kebijakan Risk aktif belum mendapat persetujuan produk.";
    case "CONFIGURATION_AMBIGUOUS":
      return "Ada lebih dari satu kebijakan Risk aktif sehingga penilaian belum dapat ditentukan.";
    case "INVALID_CONFIGURATION":
      return "Kebijakan Risk belum lengkap atau tidak valid.";
    case "REQUIRED_INPUTS_UNAVAILABLE":
      return "Sebagian input wajib untuk penilaian Risk belum tersedia atau belum memiliki mapping yang disetujui.";
    case "INVALID_INPUTS":
      return "Nilai sumber untuk penilaian Risk tidak valid.";
  }
}

function EvidenceReferences({
  references,
}: {
  readonly references: Extract<RiskAssessmentDisplayState, { readonly status: "ASSESSED" }> ["evidenceReferences"];
}) {
  if (references.length === 0) {
    return <p className="text-caption leading-body-sm text-stone-gray">Tidak ada referensi evidence Opportunity yang tersedia.</p>;
  }

  return (
    <>
      <p className="text-caption leading-body-sm text-stone-gray">
        Referensi berikut tersimpan pada Opportunity dan tidak otomatis membuktikan faktor risiko tertentu.
      </p>
      <ul className="grid gap-4">
        {references.map((reference, index) => (
          <li className="wrap-anywhere text-caption leading-body-sm text-stone-gray" key={`${reference.sourceName}-${index}`}>
            <span className="font-w540 text-ink-charcoal">{reference.sourceName}: </span>
            {reference.sourceReference ? `${reference.sourceReference} ` : null}
            {reference.sourceUrl ? (
              <a className="text-royal-violet underline-offset-2 hover:underline" href={reference.sourceUrl} rel="noopener noreferrer" target="_blank">
                {reference.sourceUrl}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export function RiskIndicatorDisplay({
  compact = false,
  result,
}: {
  readonly compact?: boolean;
  readonly result: RiskAssessmentDisplayState;
}) {
  if (result.status === "ERROR") {
    return (
      <p className="text-body-sm text-stone-gray" role="status">
        Indikator Risiko sementara tidak dapat dimuat.
      </p>
    );
  }

  if (result.status === "INSUFFICIENT_DATA") {
    return (
      <div className="grid min-w-0 gap-8">
        <p className="text-body-sm text-stone-gray" role="status">
          Risiko belum dapat dinilai berdasarkan data dan kebijakan yang tersedia.
        </p>
        <p className="wrap-anywhere text-caption leading-body-sm text-stone-gray">
          {reasonCopy(result.reason)}
        </p>
        {!compact ? (
          <>
            {result.modelVersion ? (
              <p className="text-caption text-stone-gray">Versi model: {result.modelVersion}</p>
            ) : null}
            {result.missingFactors.length > 0 ? (
              <p className="text-caption leading-body-sm text-stone-gray">
                Faktor yang belum dapat dinilai: {result.missingFactors.map((factor) => RISK_FACTOR_LABELS[factor]).join(", ")}.
              </p>
            ) : null}
            <ul className="grid gap-4">
              {result.limitations.map((limitation, index) => (
                <li className="wrap-anywhere text-caption leading-body-sm text-stone-gray" key={`${index}-${limitation}`}>
                  {limitation}
                </li>
              ))}
            </ul>
            <EvidenceReferences references={result.evidenceReferences} />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-8">
      <div className={`grid gap-8 border-l-2 pl-12 ${LEVEL_BORDER_CLASSES[result.level]}`} role="group" aria-label={`Risiko ${LEVEL_LABELS[result.level]}`}>
        <div className="flex flex-wrap items-center gap-8">
          <Badge tone="wash">{LEVEL_LABELS[result.level]} ({result.level})</Badge>
          <span className="text-caption text-stone-gray">Risiko</span>
        </div>
        <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
          {result.reasons[0]}
        </p>
      </div>
      {compact ? (
        <p className="text-caption text-stone-gray">Versi policy: {result.modelVersion}</p>
      ) : (
        <>
          <p className="text-caption text-stone-gray">Versi model: {result.modelVersion}</p>
          <div className="grid gap-8">
            <h3 className="text-body-sm font-w540 text-ink-charcoal">Alasan penilaian</h3>
            <ul className="grid gap-8">
              {result.reasons.map((reason, index) => (
                <li className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray" key={`${index}-${reason}`}>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-8">
            <h3 className="text-body-sm font-w540 text-ink-charcoal">Faktor yang dipertimbangkan</h3>
            <ul className="grid gap-8">
              {result.factorsConsidered.map((factor) => (
                <li className="grid min-w-0 gap-4 border-l border-soft-mist pl-12" key={factor.factor}>
                  <span className="text-body-sm font-w540 text-ink-charcoal">
                    {factor.label}: {LEVEL_LABELS[factor.level]}
                  </span>
                  <span className="wrap-anywhere text-caption leading-body-sm text-stone-gray">
                    Nilai sumber: {factor.value}. Sumber: {factor.source}. Referensi field: {factor.sourceReference}.
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {result.factorsNotAssessed.length > 0 ? (
            <p className="wrap-anywhere text-caption leading-body-sm text-stone-gray">
              Faktor yang tidak dinilai: {result.factorsNotAssessed.map((factor) => RISK_FACTOR_LABELS[factor]).join(", ")}.
            </p>
          ) : null}
          <div className="grid gap-8">
            <h3 className="text-body-sm font-w540 text-ink-charcoal">Referensi evidence</h3>
            <EvidenceReferences references={result.evidenceReferences} />
          </div>
          <div className="grid gap-8">
            <h3 className="text-body-sm font-w540 text-ink-charcoal">Keterbatasan</h3>
            <ul className="grid gap-4">
              {result.limitations.map((limitation, index) => (
                <li className="wrap-anywhere text-caption leading-body-sm text-stone-gray" key={`${index}-${limitation}`}>
                  {limitation}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
