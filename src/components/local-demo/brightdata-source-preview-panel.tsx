"use client";

import { useState } from "react";

import { brightDataDemoSourcePreviewSchema, type BrightDataDemoSourcePreview } from "@/ai-analysis/synthetic-demo/source-preview-contract";
import { Button } from "@/components/ui/button";

function metricText(value: number | string | null): string {
  if (value === null) return "tidak tersedia";
  return String(value);
}

function startedAtText(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return Number.isNaN(date.valueOf()) ? "timestamp tidak valid" : date.toISOString();
}

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
        setError("Status pratinjau sumber tidak dapat dimuat. Tidak ada data sumber yang ditampilkan.");
        return;
      }
      const body: unknown = await response.json();
      const parsed = brightDataDemoSourcePreviewSchema.safeParse(
        typeof body === "object" && body !== null && "data" in body ? body.data : null,
      );
      if (!parsed.success) {
        setError("Metadata pratinjau tidak valid. Tidak ada respons provider yang ditampilkan.");
        return;
      }
      setPreview(parsed.data);
    } catch {
      setError("Tidak dapat menghubungi demo lokal. Permintaan tidak akan diulang dari halaman ini.");
    } finally {
      setLoading(false);
    }
  }

  const modeLabel = preview?.mode === "LIVE_VERIFIED"
    ? "LIVE_VERIFIED — respons Bright Data nyata diterima"
    : preview?.mode === "MOCK_VERIFIED"
      ? "MOCK_VERIFIED — TEST DATA sintetis, bukan Bright Data"
      : preview?.mode === "BLOCKED"
        ? "BLOCKED — permintaan live gagal atau ditolak"
        : preview?.mode === "NOT_EXECUTED"
          ? "NOT_EXECUTED — belum ada request provider"
          : null;

  return (
    <section aria-labelledby="source-preview-heading" className="mb-28 rounded-cards border border-soft-mist bg-paper-white p-20 sm:p-24" data-testid="brightdata-source-preview-panel">
      <div className="flex flex-col gap-16 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-body-sm font-w540 text-royal-violet">Observasi sumber — preview lokal, terpisah dari katalog</p>
          <h2 className="mt-4 text-subheading font-w460" id="source-preview-heading">Google Trends Indonesia</h2>
          <p className="mt-8 text-body-sm leading-relaxed text-stone-gray">
            Penerbit asli Google; transport Bright Data SERP API. Tindakan ini meminta snapshot saat ini dan dapat memakai kredit atau menimbulkan biaya. Tidak ada retry atau pemuatan otomatis.
          </p>
        </div>
        <Button className="w-full shrink-0 sm:w-auto" disabled={loading || requestStarted} loading={loading} onClick={previewSource}>
          {requestStarted ? "Satu permintaan sudah dimulai" : "Periksa sumber sekali"}
        </Button>
      </div>
      <dl className="mt-18 grid gap-x-24 gap-y-12 border-t border-soft-mist pt-16 text-body-sm sm:grid-cols-2">
        <div>
          <dt className="font-w540">Sumber</dt>
          <dd className="mt-4">Google Trends Trending Now — Indonesia</dd>
        </div>
        <div>
          <dt className="font-w540">Transport</dt>
          <dd className="mt-4">Bright Data SERP API</dd>
        </div>
        <div>
          <dt className="font-w540">Rujukan</dt>
          <dd className="mt-4"><a className="break-all text-royal-violet underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-midnight-wine" href="https://trends.google.com/trending?geo=ID&amp;hl=id&amp;brd_json=1" rel="noreferrer" target="_blank">Google Trends — Trending Now, Indonesia</a></dd>
        </div>
        <div>
          <dt className="font-w540">Hak dan batas tampilan</dt>
          <dd className="mt-4 text-stone-gray">Konten hanya muncul sementara pada server loopback lokal. Distribusi publik dan penilaian hukum tidak termasuk dalam demo ini.</dd>
        </div>
      </dl>
      <p className="mt-14 text-caption text-stone-gray">
        Sinyal pencarian bukan bukti pembelian, permintaan pasar, pendapatan, atau keberhasilan usaha. Preview tidak disimpan, tidak dikirim ke 9Router, dan tidak membuat, memvalidasi, atau menerbitkan Trend maupun Opportunity.
      </p>
      <div aria-live="polite" className="mt-16 border-t border-soft-mist pt-14">
        {loading ? <p className="text-body-sm" role="status">Meminta snapshot sumber satu kali dari server lokal. Tidak ada data profil yang dikirim.</p> : null}
        {error ? <p className="text-body-sm" role="alert">{error}</p> : null}
        {preview && modeLabel ? <div className="space-y-12" data-testid="brightdata-source-preview">
          <h3 className="font-w540">{modeLabel}</h3>
          {preview.mode === "NOT_EXECUTED" ? <p className="text-body-sm text-stone-gray">Penyebab: {preview.reason}. Tidak ada request Bright Data yang dilakukan.</p> : null}
          {preview.mode === "BLOCKED" ? <p className="text-body-sm text-stone-gray">Kategori: {preview.reason}. {preview.attempted ? "Percobaan sudah memakai jatah proses ini; tidak ada retry." : "Tidak ada request provider yang dilakukan."}</p> : null}
          {preview.mode === "MOCK_VERIFIED" ? <p className="text-body-sm text-stone-gray">{preview.notice}</p> : null}
          {preview.mode === "LIVE_VERIFIED" || preview.mode === "MOCK_VERIFIED" ? <>
            <dl className="grid gap-x-24 gap-y-10 text-body-sm sm:grid-cols-2">
              <div><dt className="font-w540">Diambil pada</dt><dd className="mt-4 text-stone-gray">{preview.retrievedAt}</dd></div>
              <div><dt className="font-w540">HTTP / Content-Type</dt><dd className="mt-4 text-stone-gray">{preview.response.httpStatus} / {preview.response.contentType ?? "tidak tersedia"}</dd></div>
              <div><dt className="font-w540">Ukuran / struktur</dt><dd className="mt-4 text-stone-gray">{preview.response.responseBytes === null ? "tidak tersedia" : `${preview.response.responseBytes} byte`} / {preview.response.rootType}</dd></div>
              <div><dt className="font-w540">Kelengkapan parser</dt><dd className="mt-4 text-stone-gray">{preview.completeness}: {preview.records.accepted} diterima, {preview.records.rejected} ditolak dari {preview.records.total} record.</dd></div>
              <div><dt className="font-w540">Screening heuristik</dt><dd className="mt-4 text-stone-gray">{preview.records.screenedGroups} grup unik; {preview.records.classifications.LIKELY_FNB} LIKELY_FNB, {preview.records.classifications.REVIEW_REQUIRED} perlu review, {preview.records.classifications.OUT_OF_SCOPE} di luar cakupan.</dd></div>
              <div><dt className="font-w540">related_queries</dt><dd className="mt-4 text-stone-gray">Tersedia {preview.records.relatedQueries.available}; tidak tersedia {preview.records.relatedQueries.unavailable}; invalid {preview.records.relatedQueries.invalid}.</dd></div>
            </dl>
            <section aria-labelledby="source-observations-heading" className="border-t border-soft-mist pt-12">
              <h4 className="font-w540" id="source-observations-heading">Observasi yang diterima — bukan Trend terpublikasi</h4>
              {preview.records.candidates.length === 0 ? <p className="mt-8 text-body-sm text-stone-gray">Tidak ada grup observasi yang dapat ditampilkan dari record yang diterima.</p> : <ul className="mt-10 grid gap-10">
                {preview.records.candidates.map((candidate, index) => <li className="min-w-0 rounded-small-buttons border border-soft-mist p-14" key={`${candidate.title}-${candidate.startedAtUnixSeconds}-${index}`}>
                  <div className="flex flex-wrap items-start justify-between gap-8">
                    <p className="wrap-anywhere min-w-0 font-w540">{candidate.title}</p>
                    <span className="shrink-0 rounded-full border border-soft-mist px-8 py-4 text-caption">{candidate.classification}</span>
                  </div>
                  <dl className="mt-8 grid gap-x-16 gap-y-6 text-caption sm:grid-cols-2">
                    <div><dt className="font-w540">volume — unit tidak disediakan</dt><dd className="mt-2 wrap-anywhere text-stone-gray">{metricText(candidate.volume)}</dd></div>
                    <div><dt className="font-w540">volume_change — format penyedia</dt><dd className="mt-2 wrap-anywhere text-stone-gray">{metricText(candidate.volumeChange)}</dd></div>
                    <div><dt className="font-w540">started_at (UTC; bukan periode observasi)</dt><dd className="mt-2 wrap-anywhere text-stone-gray">{startedAtText(candidate.startedAtUnixSeconds)}</dd></div>
                    <div><dt className="font-w540">Status aktif / item kategori</dt><dd className="mt-2 text-stone-gray">{candidate.active ? "aktif" : "tidak aktif"} / {candidate.categoriesCount}</dd></div>
                    <div><dt className="font-w540">related_queries</dt><dd className="mt-2 text-stone-gray">{candidate.relatedQueries.availability === "AVAILABLE" ? `tersedia (${candidate.relatedQueries.count ?? 0})` : "tidak tersedia"}</dd></div>
                    {candidate.observationCount > 1 ? <div><dt className="font-w540">Observasi dalam grup</dt><dd className="mt-2 text-stone-gray">{candidate.observationCount}</dd></div> : null}
                  </dl>
                  {candidate.displayTruncated ? <p className="mt-6 text-caption text-stone-gray">Sebagian teks sumber dipotong untuk batas tampilan.</p> : null}
                </li>)}
              </ul>}
              {preview.records.omittedCandidates > 0 ? <p className="mt-8 text-caption text-stone-gray">{preview.records.omittedCandidates} grup tidak ditampilkan karena batas preview.</p> : null}
            </section>
            <p className="text-caption text-stone-gray">Observasi mentah dari sumber; screening kata kunci bersifat heuristik dan bukan validasi fakta. Waktu mulai topik tidak menunjukkan durasi atau periode observasi.</p>
            {preview.response.validationIssues?.length ? <p className="text-caption text-stone-gray">Issue schema pada record yang ditolak: {preview.response.validationIssues.map((issue) => `${issue.path.join(".")} (${issue.code})`).join(", ")}</p> : null}
          </> : null}
        </div> : null}
        {!loading && !error && !preview ? <p className="text-body-sm text-stone-gray">Belum ada permintaan. Tidak ada panggilan provider otomatis saat halaman dibuka.</p> : null}
      </div>
    </section>
  );
}
