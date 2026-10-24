"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, PageContainer, StatusNotice } from "@/components/ui";
import { RupiahInput } from "@/components/ui/rupiah-input";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { hasVerifiedBusinessConcept, businessAnalysisSchema, type BusinessAnalysis } from "@/opportunity/business-analysis-contract";
import type { AnalysisScore } from "@/opportunity/entrepreneur-analysis-contract";
import { PrivateHypothesisContent } from "./private-hypothesis-content";
import { HypothesisDetailSurface } from "./hypothesis-detail-surface";

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
export function BusinessScore({ title, result }: { title: string; result: AnalysisScore }) {
  return <Card className="grid min-w-0 content-start gap-16 p-16 sm:p-20"><h2 className="text-subheading font-w460">{title}</h2><p className="text-heading-sm font-w460">{result.score === null ? "Data belum cukup" : `${number.format(result.score)} / 100`}</p><p className="text-caption text-stone-gray">Skor awal · cakupan data {result.coverage}%</p><dl className="grid gap-12">{result.factors.map(f => <div key={f.key} className="grid gap-4 border-t border-soft-mist pt-12"><dt className="flex flex-wrap justify-between gap-8 text-body-sm font-w540"><span>{f.label}</span><span>{f.value === null ? "Belum tersedia" : number.format(f.value)}</span></dt><dd className="text-caption leading-relaxed text-stone-gray">{f.reason}</dd></div>)}</dl></Card>;
}
const link = "inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet";
export function BusinessHypothesisDetail({ item: initial, initialFresh }: { item: PrivateOpportunityIdeaDto; initialFresh: boolean }) {
  const [item, setItem] = useState(initial);
  const [analysis, setAnalysis] = useState<BusinessAnalysis | undefined>(initial.hypothesis.businessAnalysis);
  const [fresh, setFresh] = useState(initialFresh);
  const [consent, setConsent] = useState(false);
  const [min, setMin] = useState<string>(analysis?.proposedPrice ? String(analysis.proposedPrice.min) : "");
  const [max, setMax] = useState<string>(analysis?.proposedPrice ? String(analysis.proposedPrice.max) : "");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");
  const router = useRouter();
  async function perform(kind: "analysis" | "save" | "roadmap") {
    if (busy) return;
    setBusy(true); setMessage(""); setMessageTone("info");
    try {
      if (kind === "analysis" && ((min === "") !== (max === "") || (min !== "" && (!Number.isSafeInteger(Number(min)) || !Number.isSafeInteger(Number(max)) || Number(min) < 0 || Number(max) < Number(min))))) throw new Error("Isi kedua batas harga dengan Rupiah bulat, maksimum tidak lebih kecil dari minimum.");
      const response = await fetch(kind === "save" ? "/api/v1/opportunities/ideas" : `/api/v1/opportunities/ideas/${item.id}/${kind === "analysis" ? "analysis" : "roadmap"}`, { method: kind === "save" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "analysis" ? { consent, refresh: true, proposedPrice: min === "" ? null : { min: Number(min), max: Number(max) } } : kind === "save" ? { id: item.id, saved: !item.saved } : {}), signal: AbortSignal.timeout(175_000) });
      const body = await response.json();
      if (!response.ok) throw new Error(kind === "analysis" ? "Analisis gagal dimuat. Coba lagi." : kind === "save" ? "Penyimpanan gagal. Coba lagi." : "Roadmap belum dapat dibuat. Coba lagi.");
      if (kind === "analysis") { const next = businessAnalysisSchema.parse(body.data); setAnalysis(next); setFresh(true); setMessageTone("success"); setMessage("Analisis tersimpan. Tinjau faktor, risiko dan batasan sebelum mengambil keputusan."); }
      else if (kind === "save") { setItem({ ...item, saved: !item.saved }); setMessageTone("success"); setMessage(item.saved ? "Peluang dikeluarkan dari simpanan." : "Peluang disimpan."); }
      else router.push(`/opportunities/hypotheses/${item.id}/roadmap`);
      router.refresh();
    } catch (error) { setMessageTone("error"); setMessage(error instanceof Error ? error.message : "Permintaan belum berhasil; hasil sebelumnya tetap tersedia."); }
    finally { setBusy(false); }
  }
  return <HypothesisDetailSurface><PageContainer><div className="mx-auto grid max-w-[1040px] gap-24 py-24 sm:py-32 lg:py-40">
    <Link href={item.saved ? "/saved" : "/opportunities"} className={link}>Kembali ke peluang</Link>
    <header className="grid gap-12"><h1 className="wrap-anywhere text-heading-sm font-w460 sm:text-heading-lg">{item.hypothesis.title}</h1><p className="max-w-[72ch] text-body leading-relaxed text-stone-gray">Tinjau peluang pengembangan untuk bisnis yang sudah berjalan. Analisis awal membantu menentukan uji berikutnya.</p></header>
    {message ? <StatusNotice tone={messageTone} role={messageTone === "error" ? "alert" : "status"}>{messageTone === "error" ? <span className="text-midnight-wine">{message}</span> : message}</StatusNotice> : null}
    {analysis && !hasVerifiedBusinessConcept(analysis) ? <StatusNotice tone="info">Perbarui analisis untuk memeriksa kesesuaiannya dengan peluang ini.</StatusNotice> : analysis && !fresh ? <StatusNotice tone="info">Analisis sudah lama atau profil berubah. Perbarui sebelum membuat roadmap.</StatusNotice> : null}
    <Card className="grid gap-16 bg-warm-parchment p-16 sm:p-20"><h2 className="text-subheading font-w460">Analisis pengembangan bisnis</h2><p className="max-w-[72ch] text-body-sm leading-relaxed text-stone-gray">Analisis memakai konteks bisnis dan bukti terpilih. Hasilnya adalah panduan awal.</p>
      <fieldset disabled={busy} className="grid gap-12"><legend className="mb-8 text-body-sm font-w540">Estimasi harga konsep baru (opsional)</legend><p className="text-caption text-stone-gray">Per unit penawaran yang akan diuji; bukan modal, biaya, margin atau harga otomatis dari produk lama.</p><div className="grid gap-16 sm:grid-cols-2"><RupiahInput id="business-price-min" label="Harga minimum" value={min} onValueChange={value => { setMin(value); setFresh(false); }} /><RupiahInput id="business-price-max" label="Harga maksimum" value={max} onValueChange={value => { setMax(value); setFresh(false); }} /></div><label className="flex min-h-button items-start gap-12 py-8 text-body-sm leading-relaxed"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-4 size-20 shrink-0 accent-midnight-wine focus-visible:outline-2 focus-visible:outline-royal-violet" />Saya menyetujui pemrosesan profil bisnis dan bukti terpilih untuk analisis ini.</label></fieldset>
      <Button disabled={busy || !consent} onClick={() => perform("analysis")}>{busy ? "Memproses…" : analysis ? "Perbarui analisis" : "Analisis peluang bisnis"}</Button>
    </Card>
    {analysis && hasVerifiedBusinessConcept(analysis) ? <><div className="grid min-w-0 gap-20 lg:grid-cols-2"><BusinessScore title="Opportunity Score" result={analysis.opportunity} /><BusinessScore title="Business Fit" result={analysis.fit} /></div>
      <Card className="grid gap-16 p-16 sm:p-20"><h2 className="text-subheading font-w460">Risiko pelaksanaan awal: {analysis.risk.level === "UNKNOWN" ? "Belum dapat ditentukan" : analysis.risk.level}</h2><ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed">{analysis.risk.reasons.map(v => <li key={v}>{v}</li>)}</ul><h3 className="text-body font-w540">Target konsumen</h3><p className="text-body-sm leading-relaxed">{analysis.targetConsumer}</p><h3 className="text-body font-w540">Kompetisi</h3><p className="text-body-sm leading-relaxed">{analysis.competition}</p>{analysis.competitors?.places.map(p => <a key={p.url} href={p.url} target="_blank" rel="noreferrer" className={link}>{p.name}</a>)}<h3 className="text-body font-w540">Batasan dan kebutuhan awal</h3><ul className="grid list-disc gap-8 pl-20 text-body-sm leading-relaxed text-stone-gray">{[...(analysis.requirements?.initialNeeds ?? []), ...(analysis.requirements?.assumptions ?? []), ...analysis.warnings].map((v, i) => <li key={i}>{v}</li>)}</ul></Card></> : null}
    <PrivateHypothesisContent hypothesis={item.hypothesis} />
    <a className={link} href={item.source.url} target="_blank" rel="noreferrer">Buka evidence sumber</a>
    <Card className="grid gap-16 p-16 sm:p-20"><h2 className="text-subheading font-w460">Langkah pengembangan berikutnya</h2><p className="text-body-sm leading-relaxed text-stone-gray">Buat roadmap dari peluang tersimpan dengan analisis terbaru. Roadmap yang sudah ada tetap tersimpan.</p><div className="flex flex-wrap gap-12"><Button disabled={busy} variant="secondary" onClick={() => perform("save")}>{item.saved ? "Keluarkan dari simpanan" : "Simpan peluang"}</Button>{item.hypothesis.growthRoadmap ? <Link className={link} href={`/opportunities/hypotheses/${item.id}/roadmap`}>Buka Growth Roadmap</Link> : <Button disabled={busy || !item.saved || !fresh || !hasVerifiedBusinessConcept(analysis) || !analysis?.requirements || analysis.opportunity.score === null || analysis.fit.score === null} onClick={() => perform("roadmap")}>Buat Growth Roadmap</Button>}</div></Card>
  </div></PageContainer></HypothesisDetailSurface>;
}
