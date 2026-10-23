"use client";

import { useState } from "react";

import { brightDataDemoSourcePreviewSchema, type BrightDataDemoSourcePreview } from "@/ai-analysis/synthetic-demo/source-preview-contract";
import { Button } from "@/components/ui/button";


export function BrightDataSourcePreviewPanel() {
  const [preview, setPreview] = useState<BrightDataDemoSourcePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestStarted, setRequestStarted] = useState(false);

  async function previewSource() {
    if (requestStarted || loading) return;
    setRequestStarted(true);
    setLoading(true);
    setPreview(null);
    setError(null);
    try {
      const response = await fetch("/api/local/trend-source-preview", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        setError("Pratinjau gagal dimuat. Coba lagi nanti.");
        return;
      }
      const body: unknown = await response.json();
      const parsed = brightDataDemoSourcePreviewSchema.safeParse(
        typeof body === "object" && body !== null && "data" in body ? body.data : null,
      );
      if (!parsed.success) {
        setError("Pratinjau tidak dapat ditampilkan.");
        return;
      }
      setPreview(parsed.data);
    } catch {
      setError("Pratinjau gagal dimuat. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  }

  const modeLabel = preview ? "Sinyal tersedia" : null;

  return (
    <section aria-labelledby="source-preview-heading" className="mb-28 rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24" data-testid="brightdata-source-preview-panel">
      <div className="flex flex-col gap-16 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-body-sm font-w540 text-royal-violet">Pratinjau tren</p>
          <h2 className="mt-4 text-subheading font-w460" id="source-preview-heading">Google Trends Indonesia</h2>
          <p className="mt-8 text-body-sm leading-relaxed text-stone-gray">
            Muat pratinjau saat Anda ingin melihat sinyal terbaru.
          </p>
        </div>
        <Button className="w-full shrink-0 sm:w-auto" disabled={loading || requestStarted} loading={loading} onClick={previewSource}>
          {requestStarted ? "Pratinjau dimuat" : "Muat pratinjau"}
        </Button>
      </div>
      <dl className="mt-18 grid gap-x-24 gap-y-12 border-t border-soft-mist pt-16 text-body-sm sm:grid-cols-2">
        <div>
          <dt className="font-w540">Sumber</dt>
          <dd className="mt-4">Google Trends · Indonesia</dd>
        </div>
        <div>
          <dt className="font-w540">Rujukan</dt>
          <dd className="mt-4"><a className="break-all text-royal-violet underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-midnight-wine" href="https://trends.google.com/trending?geo=ID&amp;hl=id&amp;brd_json=1" rel="noreferrer" target="_blank">Google Trends — Trending Now, Indonesia</a></dd>
        </div>
      </dl>
      <p className="mt-14 text-caption text-stone-gray">
        Sinyal pencarian bukan bukti pembelian.
      </p>
      <div aria-live="polite" className="mt-16 border-t border-soft-mist pt-14">
        {loading ? <p className="text-body-sm" role="status">Memuat sinyal…</p> : null}
        {error ? <p className="text-body-sm" role="alert">{error}</p> : null}
        {preview && modeLabel ? <div className="space-y-12" data-testid="brightdata-source-preview">
          <h3 className="font-w540">{modeLabel}</h3>
          {preview.mode === "NOT_EXECUTED" ? <p className="text-body-sm text-stone-gray">Pratinjau belum tersedia.</p> : null}
          {preview.mode === "BLOCKED" ? <p className="text-body-sm text-stone-gray">Pratinjau belum tersedia.</p> : null}
          {preview.mode === "MOCK_VERIFIED" ? <p className="text-body-sm text-stone-gray">Data contoh digunakan.</p> : null}
          {preview.mode === "LIVE_VERIFIED" || preview.mode === "MOCK_VERIFIED" ? <>

            <section aria-labelledby="source-observations-heading" className="border-t border-soft-mist pt-12">
              <h4 className="font-w540" id="source-observations-heading">Sinyal tren</h4>
              {preview.records.candidates.length === 0 ? <p className="mt-8 text-body-sm text-stone-gray">Belum ada sinyal untuk filter ini.</p> : <ul className="mt-10 grid gap-10">
                {preview.records.candidates.map((candidate, index) => <li className="min-w-0 rounded-small-buttons border border-soft-mist p-14" key={`${candidate.title}-${candidate.startedAtUnixSeconds}-${index}`}>
                  <div className="flex flex-wrap items-start justify-between gap-8">
                    <p className="wrap-anywhere min-w-0 font-w540">{candidate.title}</p>

                  </div>
                </li>)}
              </ul>}
              {preview.records.omittedCandidates > 0 ? <p className="mt-8 text-caption text-stone-gray">{preview.records.omittedCandidates} sinyal tidak ditampilkan.</p> : null}
            </section>
            <p className="text-caption text-stone-gray">Sinyal pencarian dapat berubah dan belum membuktikan permintaan pasar.</p>
          </> : null}
        </div> : null}
        {!loading && !error && !preview ? <p className="text-body-sm text-stone-gray">Pilih “Muat pratinjau” untuk melihat sinyal.</p> : null}
      </div>
    </section>
  );
}
