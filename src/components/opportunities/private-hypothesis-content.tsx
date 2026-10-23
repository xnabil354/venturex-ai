import type { PrivateOpportunityHypothesis } from "@/opportunity/private-hypothesis";

function ReadingList({ items }: { items: readonly string[] }) {
  return (
    <ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed text-stone-gray">
      {items.map((item, index) => <li className="wrap-anywhere max-w-[72ch]" key={index}>{item}</li>)}
    </ul>
  );
}

export function PrivateHypothesisContent({ hypothesis }: { hypothesis: PrivateOpportunityHypothesis }) {
  const hasNotes = hypothesis.assumptions.length > 0 || Boolean(hypothesis.evidenceGaps?.length) || Boolean(hypothesis.limitations?.length);

  return (
    <div className="grid min-w-0 gap-24 text-ink-charcoal">
      <section className="grid gap-8 border-t border-soft-mist pt-20">
        <h3 className="text-body-sm font-w540">Siapa yang bisa diajak mencoba?</h3>
        <p className="max-w-[72ch] wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{hypothesis.targetCustomer}</p>
      </section>

      {hypothesis.profileAlignment?.length || hypothesis.evidenceInterpretation ? (
        <div className="grid min-w-0 gap-24 md:grid-cols-2 md:gap-32">
          {hypothesis.profileAlignment?.length ? (
            <section className="grid min-w-0 content-start gap-10">
              <h3 className="text-body-sm font-w540">Kenapa ide ini relevan buat Anda?</h3>
              <ReadingList items={hypothesis.profileAlignment} />
            </section>
          ) : null}
          {hypothesis.evidenceInterpretation ? (
            <section className="grid min-w-0 content-start gap-10">
              <h3 className="text-body-sm font-w540">Apa petunjuk dari pencarian?</h3>
              <p className="max-w-[72ch] wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{hypothesis.evidenceInterpretation}</p>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="grid gap-16 rounded-cards bg-warm-parchment p-16 sm:p-24">
        <div className="grid gap-4">
          <h3 className="text-body font-w540">Mulai dari langkah kecil</h3>
          <p className="text-body-sm leading-relaxed text-stone-gray">Ini rencana percobaan, hasilnya belum diketahui.</p>
        </div>
        <ol className="grid gap-16">
          {hypothesis.validationSteps.map((step, index) => (
            <li className="flex min-w-0 items-start gap-12" key={index}>
              <span aria-hidden="true" className="flex size-28 shrink-0 items-center justify-center rounded-full bg-midnight-wine text-caption font-w540 text-paper-white">{index + 1}</span>
              <p className="max-w-[72ch] min-w-0 wrap-anywhere text-body-sm leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {hasNotes ? (
        <details className="group min-w-0 border-t border-soft-mist">
          <summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-violet">Yang masih perlu dicari tahu</summary>
          <div className="grid gap-20 pb-8 pt-8">
            {hypothesis.assumptions.length ? <section className="grid gap-8"><h4 className="text-body-sm font-w540">Dugaan yang perlu dicoba</h4><ReadingList items={hypothesis.assumptions} /></section> : null}
            {hypothesis.evidenceGaps?.length ? <section className="grid gap-8"><h4 className="text-body-sm font-w540">Informasi yang belum tersedia</h4><ReadingList items={hypothesis.evidenceGaps} /></section> : null}
            {hypothesis.limitations?.length ? <section className="grid gap-8"><h4 className="text-body-sm font-w540">Yang perlu diingat</h4><ReadingList items={hypothesis.limitations} /></section> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
