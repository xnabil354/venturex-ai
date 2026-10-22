"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Button } from "@/components/ui";
import type { JourneyProgress as Progress } from "@/reports/journey";
import { fetchWithTimeout } from "@/lib/request-timeout";

export function JourneyProgress({ id }: { id: string }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const url = `/api/v1/reports/journeys/${id}/progress`;
  useEffect(() => {
    const controller = new AbortController();
    void fetchWithTimeout(url, { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      setProgress(await response.json() as Progress); setError("");
    }).catch(() => { if (!controller.signal.aborted) setError("Progres belum dapat dimuat."); });
    return () => controller.abort();
  }, [url, reload]);
  async function update(stage: number, completed: boolean) {
    if (!progress || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetchWithTimeout(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage, completed, fingerprint: progress.fingerprint }) });
      const body = await response.json() as Progress & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Progres belum tersimpan.");
      setProgress(body);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Progres belum tersimpan."); }
    finally { setBusy(false); }
  }
  return <Card className="grid gap-16 p-20 sm:p-24">
    <div className="grid gap-8"><h2 className="text-subheading font-w460">Progres pelaksanaan</h2><p className="text-body-sm text-stone-gray">Tandai tahap setelah Anda menjalankan kegiatannya.</p></div>
    {!progress && !error ? <p role="status" className="text-body-sm">Memuat progres…</p> : null}
    {progress ? <><p aria-live="polite" className="text-body-sm font-w540">{progress.steps.filter(step => step.completedAt).length} dari {progress.steps.length} tahap selesai</p><div className="grid gap-8">{progress.steps.map(step => <label key={step.stage} className="flex min-h-button cursor-pointer items-start gap-12 rounded-small-buttons border border-soft-mist p-12 text-body-sm leading-relaxed"><input type="checkbox" checked={Boolean(step.completedAt)} disabled={busy} onChange={event => void update(step.stage, event.target.checked)} className="mt-4 size-20 shrink-0 accent-midnight-wine focus-visible:outline-2 focus-visible:outline-royal-violet" /><span>{step.stage}. {step.title}</span></label>)}</div>
    <p className="text-caption leading-relaxed text-stone-gray">{!progress.ready ? "Tinjau analisis dan simpan peluang agar laporan tersedia." : progress.complete ? "Semua tahap selesai. Laporan dapat diunduh melalui dashboard." : "Laporan tersedia setelah semua tahap selesai."}</p>
    {progress.complete ? <Link href="/dashboard#laporan" className="inline-flex min-h-button items-center text-body-sm text-royal-violet underline">Buka laporan di dashboard</Link> : null}</> : null}
    {error ? <div role="alert" className="grid gap-8 text-body-sm"><p>{error}</p><Button variant="secondary" disabled={busy} onClick={() => setReload(value => value + 1)}>Muat ulang</Button></div> : null}
  </Card>;
}
