"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Select } from "@/components/ui";
import { fetchWithTimeout } from "@/lib/request-timeout";

type Choice = { id: string; title: string; completed: number; total: number; available: boolean };
export function JourneyReportCard() {
  const [items, setItems] = useState<Choice[]>([]), [selected, setSelected] = useState("");
  const [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetchWithTimeout(`/api/v1/reports/journeys?page=${page}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Laporan belum dapat dimuat.");
      const data = await response.json() as { items: Choice[]; hasMore: boolean };
      setItems(data.items); setSelected(data.items[0]?.id ?? ""); setHasMore(data.hasMore); setError("");
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Laporan belum dapat dimuat."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  const current = items.find(item => item.id === selected);
  async function download(format: "pdf" | "xlsx") {
    if (!current?.available || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetchWithTimeout(`/api/v1/reports/journeys/${current.id}?format=${format}`, { cache: "no-store" }, 60_000);
      if (!response.ok) { const body = await response.json() as { error?: { message?: string } }; throw new Error(body.error?.message ?? "Unduhan belum berhasil."); }
      const blob = await response.blob(), url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/u)?.[1] ?? `venturex-laporan.${format}`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unduhan belum berhasil."); }
    finally { setBusy(false); }
  }
  return <section id="laporan" aria-labelledby="laporan-heading"><Card className="grid gap-20 p-20 sm:p-32">
    <header className="grid gap-8"><h2 id="laporan-heading" className="text-subheading font-w460">Laporan perjalanan</h2><p className="text-body-sm leading-relaxed text-stone-gray">Simpan ringkasan peluang, analisis, dan roadmap Anda.</p></header>
    {loading ? <p role="status" className="text-body-sm">Memuat laporan…</p> : items.length ? <div className="grid gap-12"><Select label="Pilih perjalanan" id="report-journey" value={selected} disabled={busy} onChange={event => setSelected(event.target.value)} options={items.map(item => ({ value: item.id, label: item.title }))} /><p aria-live="polite" className="text-body-sm text-stone-gray">{current?.completed ?? 0} dari {current?.total ?? 0} tahap selesai{current?.available ? " · Siap diunduh" : " · Belum tersedia"}</p>{!current?.available ? <Link className="inline-flex min-h-button items-center text-body-sm text-royal-violet underline" href={current ? `/opportunities/hypotheses/${current.id}/roadmap` : "/roadmaps"}>Lanjutkan roadmap</Link> : null}</div> : <p className="text-body-sm leading-relaxed text-stone-gray">Simpan peluang dan buat roadmap, lalu selesaikan seluruh tahap untuk membuka unduhan.</p>}
    <div className="flex flex-col gap-12 sm:flex-row"><Button disabled={loading || busy || !current?.available} onClick={() => void download("pdf")}>Unduh PDF</Button><Button variant="secondary" disabled={loading || busy || !current?.available} onClick={() => void download("xlsx")}>Unduh Excel</Button></div>
    {busy ? <p role="status" className="text-caption">Menyiapkan unduhan…</p> : null}
    {page > 1 || hasMore ? <nav aria-label="Halaman laporan" className="flex flex-wrap items-center gap-12"><Button variant="secondary" disabled={loading || busy || page === 1} onClick={() => { setLoading(true); setPage(page - 1); }}>Sebelumnya</Button><span className="text-caption">Halaman {page}</span><Button variant="secondary" disabled={loading || busy || !hasMore} onClick={() => { setLoading(true); setPage(page + 1); }}>Berikutnya</Button></nav> : null}
    {error ? <div role="alert" className="grid gap-8 text-body-sm"><p>{error}</p><Button variant="secondary" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Coba lagi</Button></div> : null}
  </Card></section>;
}
