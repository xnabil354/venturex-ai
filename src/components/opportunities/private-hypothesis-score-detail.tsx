"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Card, PageContainer, RupiahInput, StatusNotice } from "@/components/ui";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { entrepreneurAnalysisSchema, type EntrepreneurAnalysis, type AnalysisScore } from "@/opportunity/entrepreneur-analysis-contract";
import type { PrivateFitOptions, PrivateFitProfile } from "@/scoring/private-hypothesis-score";
import type { EntrepreneurOpportunityProfileContext } from "@/opportunity/opportunity-analysis-context";
import { EntrepreneurRiskView } from "./entrepreneur-risk-view";
import { PrivateStartupAction } from "@/components/roadmaps/private-startup-action";

const number = (value: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const basisLabels = { MARKET: "Bukti pencarian", PROFILE_ALIGNMENT: "Kesesuaian profil", MODEL_ASSUMPTION: "Perkiraan konsep", USER_ESTIMATE: "Estimasi Anda", MISSING: "Belum tersedia" };
const experienceLabels = { BEGINNER: "Pemula", SOME_EXPERIENCE: "Ada pengalaman", EXPERIENCED: "Berpengalaman" };
const timeLabels = { LIMITED: "Waktu terbatas", PART_TIME: "Paruh waktu", FULL_TIME: "Penuh waktu" };

function ScoreCard({ title, result, accent, generating }: { title: string; result: AnalysisScore | undefined; accent?: boolean; generating: boolean }) {
  return <section className={`grid min-w-0 content-start gap-12 rounded-cards border p-20 sm:p-24 ${accent ? "border-royal-violet/30 bg-lilac-mist/25" : "border-soft-mist bg-paper-white"}`}>
    <div className="flex flex-wrap items-center justify-between gap-8"><h2 className="text-body font-w540">{title}</h2><span className="text-caption text-stone-gray">Penilaian awal</span></div>
    <p aria-live="polite" className="text-heading-lg font-w460">{result?.score === null || !result ? "—" : number(result.score)} <span className="text-body-sm text-stone-gray">/ 100</span></p>
    <p className="text-body-sm leading-relaxed text-stone-gray">{generating ? "Mengumpulkan bukti dan menyusun analisis..." : !result ? "Jalankan analisis mendalam untuk melihat hasilnya." : result.score === null ? "Bukti belum cukup untuk skor awal yang dapat dibandingkan." : `Cakupan faktor ${number(result.coverage)}%. Skor awal dihitung dari faktor yang tersedia.`}</p>
    {result ? <details className="min-w-0 border-t border-soft-mist pt-4"><summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet">Lihat rincian perhitungan</summary><div className="grid gap-14 pt-8">
      {result.factors.map(factor => <div className="grid gap-4" key={factor.key}><div className="flex flex-wrap justify-between gap-8 text-body-sm"><span>{factor.label} · {number(factor.weight * 100)}%</span><span className="font-w540">{factor.value === null ? "Belum tersedia" : `${number(factor.value)} / 100`}</span></div><p className="text-caption leading-relaxed text-stone-gray">{basisLabels[factor.basis]} · {factor.reason}</p></div>)}
      <p className="text-caption leading-relaxed text-stone-gray">Skor awal = jumlah nilai × bobot faktor tersedia, dibagi total bobot tersedia. Minimal tiga faktor dan cakupan bobot enam puluh persen. Data kosong tidak dianggap nol. Bobot bersifat heuristik dan belum dikalibrasi terhadap hasil usaha nyata.</p>
    </div></details> : null}
  </section>;
}

export function PrivateHypothesisScoreDetail({ item, profile, options, initialFresh = false }: {
  readonly item: PrivateOpportunityIdeaDto; readonly profile: PrivateFitProfile & Partial<Pick<EntrepreneurOpportunityProfileContext, "experienceLevel" | "timeCommitment">>; readonly options: PrivateFitOptions; readonly initialFresh?: boolean;
}) {
  const [analysis, setAnalysis] = useState<EntrepreneurAnalysis | undefined>(item.hypothesis.analysis);
  const [fresh, setFresh] = useState(initialFresh);
  const [capital, setCapital] = useState(item.hypothesis.analysis?.capitalMin?.toString() ?? "");
  const [consent, setConsent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(item.saved);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const capitalNumber = capital.trim() === "" ? null : Number(capital);
  const dirty = Boolean(analysis && capitalNumber !== analysis.capitalMin);
  const canSave = Boolean(analysis?.requirements && analysis.opportunity.score !== null && analysis.fit.score !== null && fresh && !dirty);

  async function saveOpportunity() {
    if (!canSave || !reviewed || saved || saving || generating) return;
    setSaving(true); setSaveError(null);
    try {
      const response = await fetch("/api/v1/opportunities/ideas", { method: "PATCH", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, saved: true, reviewed: true, analysisFingerprint: analysis?.inputFingerprint }) });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = "Peluang belum dapat disimpan. Coba lagi.";
        setSaveError(message); return;
      }
      if (typeof payload !== "object" || payload === null || !("data" in payload) || typeof payload.data !== "object" || payload.data === null || !("saved" in payload.data) || payload.data.saved !== true) { setSaveError("Konfirmasi penyimpanan belum diterima. Muat ulang untuk memeriksa statusnya."); return; }
      setSaved(true);
    } catch { setSaveError("Koneksi penyimpanan terputus. Muat ulang untuk memeriksa status peluang."); }
    finally { setSaving(false); }
  }

  async function analyze() {
    if (!consent || controller.current || saved || saving) return;
    if (capitalNumber !== null && (!Number.isSafeInteger(capitalNumber) || capitalNumber < 0)) { setError("Estimasi modal harus berupa rupiah utuh yang tidak negatif, atau biarkan kosong."); return; }
    const current = new AbortController();
    controller.current = current;
    const timeout = setTimeout(() => current.abort(), 175_000);
    setGenerating(true); setError(null); setSaveError(null);
    try {
      const response = await fetch(`/api/v1/opportunities/ideas/${item.id}/analysis`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true, refresh: true, capitalMin: capitalNumber }), signal: current.signal });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = "Analisis belum dapat diperbarui. Hasil sebelumnya tetap tersedia.";
        setError(message); return;
      }
      const parsed = entrepreneurAnalysisSchema.safeParse(typeof payload === "object" && payload !== null && "data" in payload ? payload.data : null);
      if (!parsed.success) { setError("Hasil analisis belum sesuai format. Hasil sebelumnya tetap tersedia."); return; }
      setAnalysis(parsed.data); setFresh(true); setReviewed(false);
    } catch {
      setError(current.signal.aborted ? "Waktu tunggu analisis berakhir. Muat ulang halaman untuk memeriksa apakah hasil sudah tersimpan." : "Koneksi analisis terputus. Hasil sebelumnya tetap tersedia.");
    } finally { clearTimeout(timeout); controller.current = null; setGenerating(false); }
  }

  const source = item.source;
  const scores = <>
    <section aria-label="Skor peluang dan kecocokan" className="grid gap-16 md:grid-cols-2"><ScoreCard title="Opportunity Score" result={analysis?.opportunity} generating={generating} /><ScoreCard title="Fit Score" result={analysis?.fit} generating={generating} accent /></section>
    <p className="text-caption leading-relaxed text-stone-gray">Skor adalah indikator awal, bukan probabilitas keberhasilan. Faktor perkiraan AI dan kecocokan profil berbeda dari bukti pasar teramati. Lokasi memberi konteks pencarian; Location Fit belum diberi angka tersendiri.</p>
  </>;
  return <PageContainer><div className="mx-auto grid max-w-[1120px] gap-24 py-24 sm:gap-32 sm:py-40">
    <Link className="inline-flex min-h-button w-fit items-center gap-8 text-body-sm font-w540 text-royal-violet hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href={`/opportunities#hypothesis-${item.id}`}><span aria-hidden="true">←</span> Kembali ke hipotesis</Link>
    <header className="grid gap-12"><p className="text-caption font-w540 text-royal-violet">Detail peluang · Calon pengusaha</p><h1 className="max-w-[30ch] wrap-anywhere text-heading-sm font-w460 sm:text-heading-lg">{item.hypothesis.title}</h1><p className="max-w-[76ch] wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{item.hypothesis.concept}</p></header>
    {analysis ? scores : null}

    {!saved ? <Card className="grid gap-16 border-soft-mist p-20 sm:p-24">
      <div className="grid gap-6"><h2 className="text-subheading font-w460">Analisis mendalam</h2><p className="max-w-[76ch] text-body-sm leading-relaxed text-stone-gray">Profil Anda dibaca otomatis. Gabungkan dengan kebutuhan konsep, histori pencarian, dan sampel kompetitor lokal untuk menghitung skor awal. Estimasi modal di bawah adalah biaya konsep, berbeda dari budget pribadi Anda.</p></div>
      <p className="rounded-small-buttons bg-warm-parchment px-12 py-10 text-body-sm">Budget profil: <span className="font-w540">{money(profile.budget.min)} – {money(profile.budget.max)}</span></p>
      <p className="text-caption leading-relaxed text-stone-gray">Minat: {options.categories.filter(option => profile.interestCategoryIds.includes(option.id)).map(option => option.name).join(", ") || "belum tersedia"} · Kanal: {options.channels.filter(option => profile.salesChannelIds.includes(option.id)).map(option => option.name).join(", ") || "belum tersedia"}. Pengalaman, waktu, lokasi, segmen, dan konteks profil relevan dibaca dari server saat analisis dijalankan.</p>
      <div className="grid gap-12 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <RupiahInput aria-label="Estimasi modal minimum dalam rupiah" disabled={generating || saving} id="analysis-capital-min" label="Estimasi modal minimum konsep (opsional)" onValueChange={digits => { setCapital(digits); setReviewed(false); }} placeholder="500.000" value={capital} />
        <Button className="w-full sm:w-auto" disabled={!consent || generating || saving} loading={generating} loadingText="AI sedang menganalisis..." onClick={() => void analyze()} variant="primary">{analysis ? "Perbarui analisis" : "Analisis peluang ini"}</Button>
      </div>
      <label className="flex min-h-button cursor-pointer items-start gap-10 text-body-sm leading-relaxed"><input checked={consent} className="mt-[3px] size-16 shrink-0 accent-midnight-wine" disabled={generating} onChange={event => setConsent(event.target.checked)} type="checkbox" /><span>Saya setuju konteks bisnis dan bukti terpilih diproses untuk analisis ini.</span></label>
      {generating ? <StatusNotice role="status" tone="info">Mengambil bukti pasar dan menyusun analisis. Halaman ini akan menampilkan hasil setelah tersimpan.</StatusNotice> : null}
      {error ? <StatusNotice role="alert" tone="error">{error}</StatusNotice> : null}
      {analysis && (!fresh || dirty) ? <StatusNotice role="status" tone="info">Hasil di bawah adalah analisis tersimpan. Profil, estimasi, atau masa berlaku hasil perlu diperbarui; jalankan analisis untuk memakai konteks terbaru.</StatusNotice> : null}
    </Card> : <StatusNotice tone="success" role="status">Peluang tersimpan permanen. Analisis ini disimpan sebagai catatan keputusan Anda.</StatusNotice>}

    {!analysis ? scores : null}
    {analysis ? <EntrepreneurRiskView analysis={analysis} /> : null}
    {analysis?.warnings.length ? <details className="border-t border-soft-mist"><summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 focus-visible:outline-2 focus-visible:outline-royal-violet">Kelengkapan bukti & catatan analisis</summary><ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed text-stone-gray">{analysis.warnings.map((warning, index) => <li className="wrap-anywhere" key={index}>{warning}</li>)}</ul></details> : null}
    {analysis?.requirements ? <Card className="grid gap-10 p-20 sm:p-24"><h2 className="text-subheading font-w460">Mengapa konsep ini relevan?</h2><p className="max-w-[76ch] wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{analysis.requirements.summary}</p><p className="max-w-[76ch] wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{analysis.requirements.rationale}</p></Card> : null}
    {analysis?.requirements ? <section className="grid gap-12 rounded-cards border border-soft-mist bg-warm-parchment/60 p-20 sm:p-24"><h2 className="text-body font-w540">Kebutuhan konsep yang dinilai</h2><p className="text-caption text-stone-gray">Usulan awal dari AI untuk dikonfirmasi, bukan kondisi usaha yang sudah berjalan.</p><dl className="grid min-w-0 gap-16 sm:grid-cols-2">
      <div className="grid gap-4"><dt className="text-caption text-stone-gray">Kategori</dt><dd className="text-body-sm">{analysis.referenceLabels?.category ?? options.categories.find(option => option.id === analysis.requirements?.categoryId)?.name ?? "Label tidak tercatat dalam arsip"}</dd></div>
      <div className="grid gap-4"><dt className="text-caption text-stone-gray">Kanal uji</dt><dd className="wrap-anywhere text-body-sm">{(analysis.referenceLabels?.channels ?? options.channels.filter(option => analysis.requirements?.salesChannelIds.includes(option.id)).map(option => option.name)).join(", ") || "Label tidak tercatat dalam arsip"}</dd></div>
      <div className="grid gap-4"><dt className="text-caption text-stone-gray">Kebutuhan pengalaman</dt><dd className="text-body-sm">{analysis.requirements.requiredExperience ? experienceLabels[analysis.requirements.requiredExperience] : "Belum ditentukan"}<span className="block text-caption text-stone-gray">{saved ? "Kecocokan memakai profil saat analisis dibuat." : `Profil: ${profile.experienceLevel ? experienceLabels[profile.experienceLevel] : "lihat profil"}`}</span></dd></div>
      <div className="grid gap-4"><dt className="text-caption text-stone-gray">Kebutuhan waktu</dt><dd className="text-body-sm">{analysis.requirements.requiredTime ? timeLabels[analysis.requirements.requiredTime] : "Belum ditentukan"}<span className="block text-caption text-stone-gray">{saved ? "Kecocokan memakai profil saat analisis dibuat." : `Profil: ${profile.timeCommitment ? timeLabels[profile.timeCommitment] : "lihat profil"}`}</span></dd></div>
    </dl></section> : null}
    <div className="grid min-w-0 gap-16 md:grid-cols-2">
      <Card className="grid content-start gap-12 p-20 sm:p-24"><h2 className="text-subheading font-w460">Target konsumen</h2><p className="wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{analysis?.targetConsumer ?? item.hypothesis.targetCustomer}</p><p className="text-caption text-stone-gray">Segmen untuk diuji, belum menjadi pembeli terkonfirmasi.</p></Card>
      <Card className="grid content-start gap-12 p-20 sm:p-24"><h2 className="text-subheading font-w460">Kompetisi</h2><p className="text-body-sm leading-relaxed text-stone-gray">{analysis?.competition ?? "Jalankan analisis untuk mencari sampel listing kompetitor pada kota profil."}</p>{analysis?.competitors ? <p className="text-caption text-stone-gray">Sampel kota {analysis.competitors.city}; hasil pencarian dapat terbatas atau tidak lengkap.</p> : null}
        {analysis?.competitors?.diagnostics ? <details className="border-t border-soft-mist"><summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 focus-visible:outline-2 focus-visible:outline-royal-violet">Lihat hasil penyaringan listing</summary><dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-12 gap-y-8 text-caption text-stone-gray"><dt>Diterima dari pencarian</dt><dd>{analysis.competitors.diagnostics.receivedCount}</dd><dt>Diperiksa (maksimal 20)</dt><dd>{analysis.competitors.diagnostics.inspectedCount}</dd><dt>Cocok dengan kota</dt><dd>{analysis.competitors.sampleCount}</dd><dt>Alamat di luar kota / tidak cocok</dt><dd>{analysis.competitors.diagnostics.outsideCityCount}</dd><dt>Data tidak lengkap / tidak valid</dt><dd>{analysis.competitors.diagnostics.invalidCount}</dd><dt>Listing duplikat</dt><dd>{analysis.competitors.diagnostics.duplicateCount}</dd></dl><p className="mt-12 text-caption leading-relaxed text-stone-gray">Ini sampel pencarian, bukan jumlah seluruh kompetitor.</p></details> : null}
      </Card>
      <Card className="grid content-start gap-12 p-20 sm:p-24"><h2 className="text-subheading font-w460">Risiko & hal yang perlu diuji</h2><ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed text-stone-gray">{(analysis?.risks ?? item.hypothesis.assumptions).map((risk, index) => <li className="wrap-anywhere" key={index}>{risk}</li>)}</ul></Card>
      <section className="grid content-start gap-12 rounded-cards border border-soft-mist bg-warm-parchment/60 p-20 sm:p-24"><h2 className="text-subheading font-w460">Kebutuhan awal</h2><ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed text-stone-gray">{(analysis?.requirements?.initialNeeds ?? item.hypothesis.validationSteps).map((need, index) => <li className="wrap-anywhere" key={index}>{need}</li>)}</ul>{analysis?.requirements ? <p className="text-caption text-stone-gray">Kebutuhan konsep masih berupa perkiraan yang perlu dikonfirmasi, bukan biaya terverifikasi.</p> : null}</section>
    </div>
    {analysis?.requirements ? <details className="border-t border-soft-mist"><summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 focus-visible:outline-2 focus-visible:outline-royal-violet">Asumsi kebutuhan konsep</summary><ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed text-stone-gray">{analysis.requirements.assumptions.map((assumption, index) => <li className="wrap-anywhere" key={index}>{assumption}</li>)}</ul></details> : null}
    <Card className="grid min-w-0 gap-16 p-20 sm:p-24"><h2 className="text-subheading font-w460">Bukti & sumber</h2>
      <section className="grid gap-6"><h3 className="text-body-sm font-w540">Sinyal awal hipotesis</h3><p className="wrap-anywhere text-body-sm text-stone-gray">{source.transport === "SearchApi.io" ? source.query : source.title}</p><a className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href={source.url} target="_blank" rel="noreferrer">Buka Google Trends ↗</a></section>
      {analysis?.trend ? <section className="grid gap-6 border-t border-soft-mist pt-12"><h3 className="text-body-sm font-w540">Tren pencarian</h3><p className="wrap-anywhere text-body-sm leading-relaxed text-stone-gray">{analysis.trend.query} · {analysis.trend.geo || "Seluruh dunia"} · satu tahun</p><p className="text-caption leading-relaxed text-stone-gray">Kestabilan dan momentum dihitung dalam seri yang sama. Indeks bukan jumlah pencarian atau transaksi.</p></section> : null}
      {analysis?.competitors?.places.length ? <section className="grid gap-10 border-t border-soft-mist pt-12"><h3 className="text-body-sm font-w540">Contoh listing dalam sampel</h3><ul className="grid gap-10">{analysis.competitors.places.map(place => <li className="grid gap-4" key={place.url}><a className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href={place.url} target="_blank" rel="noreferrer">{place.name} ↗</a><p className="wrap-anywhere text-caption text-stone-gray">{place.address}</p></li>)}</ul><p className="text-caption text-stone-gray">Sampel listing dapat belum mencakup semua pesaing.</p></section> : null}
    </Card>
    <Card className="grid gap-12 p-20 sm:p-24">
      <h2 className="text-subheading font-w460">{saved ? "Peluang sudah tersimpan" : "Simpan peluang pilihan Anda"}</h2>
      {saved ? <>
        {analysis?.requirements && analysis.opportunity.score !== null && analysis.fit.score !== null ? <><p className="text-body-sm text-stone-gray">Lanjutkan dengan langkah uji dari analisis yang sudah Anda tinjau.</p><PrivateStartupAction id={item.id} exists={Boolean(item.hypothesis.startupRoadmap)} /></> : <p className="text-body-sm text-stone-gray">Arsip ini belum memiliki analisis lengkap. Tinjau hipotesis baru di Opportunity Finder untuk menyusun roadmap.</p>}
        <Link className="inline-flex min-h-button w-fit items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href={`/saved#hypothesis-${item.id}`}>Lihat di Saved Opportunities</Link>
      </> : <>
        <p className="text-body-sm leading-relaxed text-stone-gray">Tinjau skor, target konsumen, kompetisi, risiko, kebutuhan awal, dan bukti sebelum menyimpan. Peluang beserta analisisnya akan tersimpan permanen dan tidak dapat dihapus.</p>
        <label className="flex min-h-button items-start gap-10 text-body-sm leading-relaxed"><input className="mt-[3px] size-16 shrink-0 accent-midnight-wine" checked={reviewed} disabled={!canSave || generating || saving} onChange={event => setReviewed(event.target.checked)} type="checkbox" /><span>Saya sudah meninjau detail dan ingin menyimpan peluang ini secara permanen.</span></label>
        <Button className="w-full sm:w-fit" disabled={!canSave || !reviewed || generating || saving} loading={saving} loadingText="Menyimpan peluang..." onClick={() => void saveOpportunity()} variant="primary">Simpan peluang</Button>
        {!canSave ? <p className="text-caption text-stone-gray">Jalankan analisis hingga kedua skor tersedia dengan profil dan estimasi terkini.</p> : null}
      </>}
      {saveError ? <p role="alert" className="text-body-sm text-midnight-wine">{saveError}</p> : null}
    </Card>
  </div></PageContainer>;
}
