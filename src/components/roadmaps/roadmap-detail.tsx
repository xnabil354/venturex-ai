import Link from "next/link";

import type { RoadmapDetail } from "@/roadmap/domain";
import { Card, PageContainer } from "@/components/ui";

const rupiah = new Intl.NumberFormat("id-ID");

export function RoadmapDetailView({ roadmap }: { readonly roadmap: RoadmapDetail }) {
  const context = roadmap.generationContext;
  const label = roadmap.roadmapType === "GROWTH" ? "Growth Roadmap" : "Startup Roadmap";

  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <Link className="w-fit text-body-sm font-w540 text-royal-violet underline underline-offset-4" href="/roadmaps">Kembali ke Roadmap</Link>
        <header className="grid gap-8">
          <p className="text-label-bold text-royal-violet">{context.method.replaceAll("_", " ")}</p>
          <h1 className="text-heading-lg font-w460 text-ink-charcoal sm:text-display">{label}</h1>
          <p className="text-body text-ink-charcoal">Opportunity: <Link className="text-royal-violet underline underline-offset-4" href={`/opportunities/${roadmap.opportunity.id}`}>{roadmap.opportunity.name}</Link></p>
          <p className="max-w-[76ch] text-body-sm leading-body-sm text-stone-gray">Rencana ini dibuat dengan template deterministik {context.version}; hasilnya bukan prediksi atau rekomendasi otomatis.</p>
        </header>
        <ol className="grid gap-12">
          {roadmap.steps.map((step) => (
            <li key={step.id}>
              <Card className="grid gap-12 p-16 sm:p-24">
                <div className="flex flex-wrap items-baseline justify-between gap-8">
                  <h2 className="text-label-bold text-ink-charcoal">{step.sequence}. {step.stage}</h2>
                  <p className="text-caption text-stone-gray">{step.timeline}</p>
                </div>
                <div className="grid gap-4"><h3 className="text-body-sm font-w540 text-ink-charcoal">Tindakan</h3><p className="text-body-sm leading-body-sm text-ink-charcoal">{step.action}</p></div>
                <div className="grid gap-4"><h3 className="text-body-sm font-w540 text-ink-charcoal">Tujuan</h3><p className="text-body-sm leading-body-sm text-stone-gray">{step.objective}</p></div>
                <div className="grid gap-4"><h3 className="text-body-sm font-w540 text-ink-charcoal">Hasil yang diharapkan</h3><p className="text-body-sm leading-body-sm text-stone-gray">{step.expectedOutput}</p></div>
              </Card>
            </li>
          ))}
        </ol>
        <Card className="grid gap-16 p-16 sm:p-24">
          <h2 className="text-label-bold text-ink-charcoal">Konteks dan keterbatasan</h2>
          <RoadmapProfileSnapshot roadmap={roadmap} />
          <p className="text-body-sm text-stone-gray">Mode konteks: {context.contextMode === "LIMITED_CONTEXT" ? "Terbatas" : "Lengkap"}</p>
          {context.unavailableInputs.length > 0 ? <p className="text-body-sm text-stone-gray">Belum tersedia: {context.unavailableInputs.join(", ")}.</p> : <p className="text-body-sm text-stone-gray">Score dan Risk tercatat tersedia sebagai konteks tambahan, bukan prediksi.</p>}
          <p className="text-body-sm text-stone-gray">Sinyal tersimpan — Opportunity Score: {context.availableSignals.opportunityScore ?? "Tidak tersedia"}; Fit Score: {context.availableSignals.fitScore ?? "Tidak tersedia"}; Risk: {context.availableSignals.riskLevel ?? "Tidak tersedia"}.</p>
          <div className="grid gap-4"><h3 className="text-body-sm font-w540 text-ink-charcoal">Asumsi</h3><ul className="grid gap-4">{context.assumptions.map((item) => <li className="text-body-sm leading-body-sm text-stone-gray" key={item}>{item}</li>)}</ul></div>
          <div className="grid gap-4"><h3 className="text-body-sm font-w540 text-ink-charcoal">Batasan</h3><ul className="grid gap-4">{context.limitations.map((item) => <li className="text-body-sm leading-body-sm text-stone-gray" key={item}>{item}</li>)}</ul></div>
          {context.evidence.length > 0 ? <div className="grid gap-4"><h3 className="text-body-sm font-w540 text-ink-charcoal">Sumber yang tercatat</h3><ul className="grid gap-4">{context.evidence.map((item) => <li className="text-body-sm leading-body-sm text-stone-gray" key={item.id}>{item.sourceName}{item.sourceReference ? ` — ${item.sourceReference}` : ""}</li>)}</ul><p className="text-caption text-stone-gray">Pencatatan sumber tidak berarti sumber telah diverifikasi.</p></div> : null}
        </Card>
      </div>
    </PageContainer>
  );
}

function RoadmapProfileSnapshot({ roadmap }: { readonly roadmap: RoadmapDetail }) {
  if (roadmap.roadmapType === "GROWTH") {
    const profile = roadmap.generationContext.profileInputs;
    return (
      <>
        <p className="text-body-sm text-stone-gray">Profil bisnis yang digunakan: {profile.businessName}; {profile.businessCategory}; {profile.location}.</p>
        <p className="text-body-sm text-stone-gray">Rentang harga rata-rata pada profil: Rp {rupiah.format(profile.averagePriceRange.min)}–Rp {rupiah.format(profile.averagePriceRange.max)}. Rentang ini bukan biaya atau hasil margin.</p>
        <p className="text-body-sm text-stone-gray">Produk aktif: {profile.products.map((product) => `${product.name}${product.listedPrice === null ? " (harga tidak dicantumkan)" : ` (harga tercatat Rp ${rupiah.format(product.listedPrice)})`}`).join(", ")}.</p>
        <p className="text-body-sm text-stone-gray">Segmen pelanggan: {profile.customerSegments.join(", ")}; channel: {profile.salesChannels.join(", ")}.</p>
        {profile.businessDescription ? <p className="text-body-sm text-stone-gray">Deskripsi bisnis: {profile.businessDescription}</p> : null}
      </>
    );
  }

  const profile = roadmap.generationContext.profileInputs;
  return (
    <>
      <p className="text-body-sm text-stone-gray">Profil yang digunakan: {profile.location}; {profile.experienceLevel}; {profile.timeCommitment}; anggaran profil Rp {rupiah.format(profile.budgetRange.min)}–Rp {rupiah.format(profile.budgetRange.max)}.</p>
      <p className="text-body-sm text-stone-gray">Segmen: {profile.customerSegments.join(", ")}; channel: {profile.salesChannels.join(", ")}; minat: {profile.interests.join(", ")}.</p>
    </>
  );
}
