import Link from "next/link";
import type { ReactNode } from "react";

import { Card, PageContainer } from "@/components/ui";
import type { OpportunityDetailDto } from "@/opportunity/dto";
import type { OpportunityEvidenceState } from "@/opportunity/evidence-dto";
import type { OpportunitySaveState } from "@/opportunity/saved-dto";
import type { OpportunityScoreDisplayState } from "@/scoring/opportunity-score-service";
import type { RiskAssessmentDisplayState } from "@/scoring/risk-assessment-service";
import { FitScoreSection } from "./fit-score-section";
import { OpportunityScoreDisplay } from "./opportunity-score-display";
import { RiskIndicatorDisplay } from "./risk-indicator-display";
import { SavedOpportunityControl } from "./saved-opportunity-control";

function DetailSection({
  id,
  title,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-8 border-t border-soft-mist pt-16">
      <h2 className="text-label-bold font-w460 text-ink-charcoal" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function NotAvailable({ children }: { readonly children: ReactNode }) {
  return <p className="max-w-[76ch] wrap-anywhere text-body-sm leading-body-sm text-stone-gray">{children}</p>;
}

export function OpportunityDetail({
  evidence,
  item,
  opportunityScore,
  riskAssessment,
  saveState,
}: {
  readonly evidence: OpportunityEvidenceState;
  readonly item: OpportunityDetailDto;
  readonly opportunityScore: OpportunityScoreDisplayState;
  readonly riskAssessment: RiskAssessmentDisplayState;
  readonly saveState: OpportunitySaveState;
}) {
  const titleId = `opportunity-detail-${item.id}`;

  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <Link
          className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet transition-colors hover:text-midnight-wine hover:underline"
          href="/opportunities"
        >
          Kembali ke Opportunity Finder
        </Link>

        <Card className="p-20 sm:p-24">
          <article aria-labelledby={titleId} className="grid gap-24">
            <header className="grid gap-12">
              <p className="text-label-bold font-w460 text-royal-violet">Opportunity Intelligence</p>
              <div className="flex flex-wrap items-center gap-8">
                <span className="wrap-anywhere text-label-bold font-w460 text-stone-gray">
                  {item.categoryName}
                </span>
                <span className="inline-flex min-h-28 items-center rounded-full border border-soft-mist bg-lilac-mist px-10 wrap-anywhere text-label-bold font-w460 text-ink-charcoal">
                  {item.opportunityType}
                </span>
              </div>
              <h1
                className="wrap-anywhere text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display"
                id={titleId}
              >
                {item.name}
              </h1>
              <p className="max-w-[76ch] wrap-anywhere text-body leading-body text-ink-charcoal">
                {item.description}
              </p>
              <SavedOpportunityControl initialState={saveState} opportunityId={item.id} />
            </header>

            <DetailSection id={`${titleId}-target`} title="Target konsumen">
              <NotAvailable>{item.targetConsumerSummary?.trim() || "Belum dicantumkan."}</NotAvailable>
            </DetailSection>

            <DetailSection id={`${titleId}-competition`} title="Konteks kompetisi">
              <dl className="grid gap-12 sm:grid-cols-2">
                <div className="grid gap-4">
                  <dt className="text-body-sm font-w540 text-ink-charcoal">Tingkat kompetisi</dt>
                  <dd className="wrap-anywhere text-body-sm text-stone-gray">
                    {item.competitionLevel?.trim() || "Belum dicantumkan."}
                  </dd>
                </div>
                <div className="grid gap-4">
                  <dt className="text-body-sm font-w540 text-ink-charcoal">Ringkasan</dt>
                  <dd className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                    {item.competitionSummary?.trim() || "Belum dicantumkan."}
                  </dd>
                </div>
              </dl>
            </DetailSection>

            <DetailSection id={`${titleId}-trend`} title="Trend terkait">
              <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                <Link
                  className="font-w540 text-royal-violet underline-offset-2 hover:underline"
                  href={`/trends/${item.relatedTrend.id}`}
                >
                  {item.relatedTrend.title}
                </Link>
              </p>
            </DetailSection>

            <DetailSection id={`${titleId}-scores`} title="Score, Fit, dan Risk">
              <dl className="grid gap-12 lg:grid-cols-3">
                <div className="grid min-w-0 gap-4">
                  <dt className="text-body-sm font-w540 text-ink-charcoal">Opportunity Score</dt>
                  <dd className="min-w-0"><OpportunityScoreDisplay result={opportunityScore} /></dd>
                </div>
                <div className="grid min-w-0 gap-4">
                  <dt className="text-body-sm font-w540 text-ink-charcoal">Fit Score</dt>
                  <dd className="min-w-0"><FitScoreSection opportunityId={item.id} /></dd>
                </div>
                <div className="grid min-w-0 gap-4">
                  <dt className="text-body-sm font-w540 text-ink-charcoal">Risk</dt>
                  <dd className="min-w-0"><RiskIndicatorDisplay result={riskAssessment} /></dd>
                </div>
              </dl>
            </DetailSection>

            <EvidenceSection evidence={evidence} titleId={titleId} />

            <DetailSection id={`${titleId}-analysis`} title="AI Analysis">
              <NotAvailable>AI Analysis belum tersedia.</NotAvailable>
            </DetailSection>

            <DetailSection id={`${titleId}-roadmap`} title="Roadmap">
              <NotAvailable>Roadmap belum tersedia.</NotAvailable>
            </DetailSection>
          </article>
        </Card>
      </div>
    </PageContainer>
  );
}

function EvidenceSection({
  evidence,
  titleId,
}: {
  readonly evidence: OpportunityEvidenceState;
  readonly titleId: string;
}) {
  return (
    <section aria-labelledby={`${titleId}-evidence`} className="grid gap-12 border-t border-soft-mist pt-16">
      <h2 className="text-label-bold font-w460 text-ink-charcoal" id={`${titleId}-evidence`}>
        Evidence
      </h2>

      {evidence.status === "ERROR" ? (
        <p className="max-w-[76ch] text-body-sm leading-body-sm text-stone-gray" role="status">
          Evidence belum dapat dimuat. Informasi Opportunity tetap tersedia.
        </p>
      ) : (
        <>
          {evidence.limited ? (
            <p className="w-fit rounded-full border border-soft-mist bg-lilac-mist px-10 py-4 text-body-sm font-w540 text-ink-charcoal" role="status">
              Bukti terbatas
            </p>
          ) : null}

          {evidence.status === "EMPTY" ? (
            <p className="max-w-[76ch] text-body-sm leading-body-sm text-stone-gray">
              Belum ada evidence tersimpan untuk Opportunity ini.
            </p>
          ) : (
            <>
              <p className="max-w-[76ch] text-caption leading-body-sm text-stone-gray">
                Jumlah evidence tidak menyatakan kualitas atau verifikasi sumber.
              </p>
              <ul className="grid gap-16">
                {evidence.items.map((source, index) => (
                  <li
                    className="grid gap-8 border-l border-soft-mist pl-16"
                    key={`${source.sourceName}-${index}`}
                  >
                    <h3 className="wrap-anywhere text-body-sm font-w540 text-ink-charcoal">
                      {source.sourceName}
                    </h3>
                    <p className="wrap-anywhere text-body-sm text-stone-gray">
                      Jenis sumber: {source.sourceType}
                    </p>
                    <p className="wrap-anywhere text-body-sm text-stone-gray">
                      {source.sourceDateLabel}
                    </p>
                    <p className="wrap-anywhere text-body-sm text-stone-gray">
                      {source.retrievedAtLabel}
                    </p>
                    <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                      <span className="font-w540 text-ink-charcoal">Referensi sumber: </span>
                      {source.sourceReference ?? "Tidak dicantumkan."}
                    </p>
                    {source.sourceUrl ? (
                      <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                        <span className="font-w540 text-ink-charcoal">URL sumber: </span>
                        <a
                          className="text-royal-violet underline-offset-2 hover:underline"
                          href={source.sourceUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {source.sourceUrl}
                        </a>
                      </p>
                    ) : null}
                    <div className="grid gap-4">
                      <p className="text-body-sm font-w540 text-ink-charcoal">
                        Keterbatasan sumber
                      </p>
                      {source.limitations.length > 0 ? (
                        <ul className="grid gap-4">
                          {source.limitations.map((limitation, limitationIndex) => (
                            <li
                              className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray"
                              key={`${limitationIndex}-${limitation}`}
                            >
                              {limitation}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-body-sm text-stone-gray">Tidak dicantumkan.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
