"use client";

import { useEffect, useState } from "react";

import {
  liveTrendAnalysisResponseSchema,
  liveTrendSignalsResponseSchema,
  type LiveTrendAnalysisResponse,
  type LiveTrendSignalsResponse,
} from "@/trend/live-signals-contract";
import { Badge, Button, Card, StatusNotice } from "@/components/ui";

type ApiError = { readonly error: { readonly code?: string; readonly message?: string }; readonly requestId?: string };
type ApiSuccess = { readonly data: unknown; readonly requestId?: string };
type ApiEnvelope = ApiSuccess | ApiError | Record<string, never>;
type TimeWindowHours = 4 | 24 | 48 | 168;

const timeWindowOptions: readonly { readonly hours: TimeWindowHours; readonly label: string }[] = [
  { hours: 4, label: "4 jam terakhir" },
  { hours: 24, label: "24 jam terakhir" },
  { hours: 48, label: "48 jam terakhir" },
  { hours: 168, label: "7 hari terakhir" },
];

async function readJson(response: Response): Promise<ApiEnvelope> {
  try { return await response.json() as ApiEnvelope; } catch { return {}; }
}

function isApiError(value: unknown): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("id-ID").trim().replace(/\s+/gu, " ");
}

const blockedAnalysisMessage: Record<LiveTrendSignalsResponse["analysisAvailability"]["reason"], string> = {
  READY: "Analisis siap setelah persetujuan Anda.",
  AI_FEATURE_DISABLED: "Analisis belum tersedia saat ini.",
  AI_PROVIDER_CONFIGURATION_UNAVAILABLE: "Analisis belum siap digunakan.",
  SOURCE_PROCESSING_NOT_APPROVED: "Analisis belum tersedia saat ini.",
};

export function LiveTrendSignalsPanel({
  initialKeyword = "",
  publicHttpTransport = false,
}: {
  readonly initialKeyword?: string;
  readonly publicHttpTransport?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<LiveTrendSignalsResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [timeWindowHours, setTimeWindowHours] = useState<TimeWindowHours>(24);
  const [keyword, setKeyword] = useState(initialKeyword.slice(0, 80));
  const [includeReviewRequired, setIncludeReviewRequired] = useState(false);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState<LiveTrendAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [retryVisible, setRetryVisible] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);

  useEffect(() => {
    if (retrySeconds <= 0) return;
    const timer = window.setTimeout(() => setRetrySeconds((remaining) => Math.max(0, remaining - 1)), 1_000);
    return () => window.clearTimeout(timer);
  }, [retrySeconds]);

  const normalizedKeyword = normalizeSearch(keyword);
  const visibleSignals = snapshot?.signals.filter((signal) => {
    if (!includeReviewRequired && signal.classification !== "LIKELY_FNB") return false;
    if (!normalizedKeyword) return true;
    const searchable = normalizeSearch([signal.title, ...signal.matchedKeywords].join(" "));
    return searchable.includes(normalizedKeyword);
  }) ?? [];
  const selectedWindowLabel = timeWindowOptions.find((item) => item.hours === timeWindowHours)?.label ?? "24 jam terakhir";

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setSelectedSignalId(null);
    try {
      const response = await fetch(`/api/v1/trends/live-signals/refresh?hours=${timeWindowHours}`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await readJson(response);
      if (!response.ok || isApiError(payload)) {
        setRefreshError("Sinyal belum dapat dimuat. Coba lagi.");
        return;
      }
      const parsed = liveTrendSignalsResponseSchema.safeParse(payload.data);
      if (!parsed.success) {
        setRefreshError("Data sinyal tidak dapat ditampilkan. Coba lagi.");
        return;
      }
      setSnapshot(parsed.data);
    } catch {
      setRefreshError("Sinyal gagal dimuat. Coba lagi.");
    } finally {
      setRefreshing(false);
    }
  }

  async function analyze(signalId: string) {
    if (!snapshot || !consent || analyzing) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setRetryVisible(false);
    try {
      const response = await fetch("/api/v1/trends/live-signals/analyze", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: snapshot.snapshotId,
          signalId,
          consent: true,
          disclosureVersion: "trends-ninerouter-profile-v2",
        }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        if (response.status === 503) {
          const retryAfterHeader = response.headers.get("retry-after");
          const parsedSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : Number.NaN;
          setRetrySeconds(Number.isFinite(parsedSeconds) && parsedSeconds > 0 ? parsedSeconds : 60);
          setRetryVisible(true);
        }
        setAnalysisError("Analisis belum berhasil. Coba lagi.");
        return;
      }
      if (isApiError(payload)) {
        setAnalysisError("Analisis belum berhasil. Coba lagi.");
        return;
      }
      const parsed = liveTrendAnalysisResponseSchema.safeParse(payload.data);
      if (!parsed.success) {
        setAnalysisError("Hasil analisis tidak dapat ditampilkan. Coba lagi.");
        return;
      }
      setAnalysis(parsed.data);
      setSelectedSignalId(null);
    } catch {
      setAnalysisError("Analisis gagal dimuat. Coba lagi.");
    } finally {
      setAnalyzing(false);
      setConsent(false);
    }
  }

  return (
    <section aria-labelledby="live-signals-heading" className="grid gap-20">
      <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="grid max-w-[760px] gap-8">
          <h2 className="text-heading-sm font-w460 leading-heading-sm text-ink-charcoal" id="live-signals-heading">
            Sinyal pencarian Indonesia
          </h2>
          <p className="text-body-sm leading-body-sm text-stone-gray">
            Daftar Trending Now menampilkan kueri Google Search yang sedang naik. Cakupan F&amp;B dan kata kunci usaha di bawah adalah penyaringan lokal VENTUREX; bukan kueri kategori atau kata kunci yang dikirim ke Google Trends.
          </p>
        </div>
        <Button
          disabled={refreshing}
          onClick={() => void refresh()}
          type="button"
          variant="secondary"
        >
          {refreshing ? "Memuat sinyal…" : snapshot ? `Perbarui ${selectedWindowLabel}` : "Muat sinyal terbaru"}
        </Button>
      </div>

      <Card className="grid gap-16 p-16 sm:grid-cols-2 sm:p-20 border-[#ded8cb] bg-[#faf9f6]">
        <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal">
          Rentang Trending Now
          <select
            className="min-h-44 rounded-small-buttons border border-[#ded8cb] bg-paper-white px-12 text-body-sm font-w460 text-ink-charcoal focus:border-deep-lagoon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-lagoon"
            onChange={(event) => setTimeWindowHours(Number(event.target.value) as TimeWindowHours)}
            value={timeWindowHours}
          >
            {timeWindowOptions.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}
          </select>
            <span className="text-caption font-w460 text-stone-gray">Indonesia · rentang diterapkan saat Anda menekan perbarui.</span>
        </label>
        <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal">
          Kata kunci produk dari profil
          <input
            autoComplete="off"
            className="min-h-44 rounded-small-buttons border border-[#ded8cb] bg-paper-white px-12 text-body-sm font-w460 text-ink-charcoal focus:border-deep-lagoon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-lagoon"
            maxLength={80}
            onChange={(event) => {
              setKeyword(event.target.value);
              setSelectedSignalId(null);
              setAnalysis(null);
            }}
            placeholder="Contoh: bakso"
            value={keyword}
          />
            <span className="text-caption font-w460 text-stone-gray">Menyaring sinyal yang sudah dimuat.</span>
        </label>
        <label className="flex items-start gap-10 text-body-sm leading-body-sm text-ink-charcoal sm:col-span-2">
          <input
            checked={includeReviewRequired}
            className="mt-3 size-16 accent-midnight-wine"
            onChange={(event) => setIncludeReviewRequired(event.target.checked)}
            type="checkbox"
          />
          <span>Sertakan istilah yang masih ambigu dan perlu tinjauan manual</span>
        </label>
      </Card>

      {refreshError ? <StatusNotice aria-live="polite" role="status" tone="error">{refreshError}</StatusNotice> : null}

      {snapshot ? (
        <div className="grid gap-20" aria-live="polite">
          {snapshot.mode === "MOCK_TEST" ? (
            <StatusNotice tone="warning">Mode contoh menggunakan data simulasi.</StatusNotice>
          ) : null}

          <details className="group rounded-cards border border-[#ded8cb] bg-[#faf9f6] p-16 text-caption leading-body-sm text-stone-gray transition-colors">
            <summary className="flex cursor-pointer items-center justify-between font-w540 text-ink-charcoal focus-visible:outline-2 focus-visible:outline-deep-lagoon">
              <span className="flex items-center gap-8">
                <span className="h-6 w-6 rounded-full bg-deep-lagoon" />
                <span>Detail sinyal</span>
              </span>
              <span className="text-deep-lagoon text-body-sm transition-transform duration-200 group-open:rotate-180">▾</span>
            </summary>
            <div className="grid gap-8 border-t border-soft-mist mt-12 pt-12">
              <p>Menampilkan sinyal yang sesuai dengan filter pilihan Anda.</p>
            </div>
          </details>

          {snapshot.freshness === "STALE" ? <StatusNotice tone="warning">Data mungkin belum terbaru. Coba perbarui sinyal.</StatusNotice> : null}

          {visibleSignals.length === 0 ? (
            <StatusNotice tone="info" className="text-stone-gray">
              {normalizedKeyword
                ? <>Tidak ada sinyal untuk “{keyword.trim()}” dalam rentang ini. Coba rentang waktu yang lebih panjang.</>
                : "Belum ada sinyal yang cocok. Coba perbarui daftar."}
            </StatusNotice>
          ) : (
            <ul aria-label="Sinyal Google Trends dengan relevansi F&B" className="grid gap-16 md:grid-cols-2">
              {visibleSignals.map((signal) => (
                <li key={signal.id}>
                  <Card className="flex h-full flex-col justify-between p-20 sm:p-24 transition-all duration-300 border-[#ded8cb] bg-[#faf9f6] hover:border-deep-lagoon/40 hover:-translate-y-1 hover:shadow-lg">
                    <article aria-labelledby={`live-signal-${signal.id}`} className="grid gap-14">
                      <div className="flex flex-wrap items-center justify-between gap-8">
                        <Badge tone={signal.classification === "LIKELY_FNB" ? "wash" : "neutral"}>
                          {signal.classification === "LIKELY_FNB" ? "Kemungkinan F&B" : "Perlu ditinjau"}
                        </Badge>
                        <span className="inline-flex items-center gap-6 text-caption font-w460 text-stone-gray">
                          {signal.classification === "LIKELY_FNB" ? (
                            <span className="h-6 w-6 rounded-full bg-emerald-500 animate-pulse" />
                          ) : null}
                          Sinyal awal
                        </span>
                      </div>
                      <h3 className="wrap-anywhere text-heading-sm font-w460 text-ink-charcoal" id={`live-signal-${signal.id}`}>
                        {signal.title}
                      </h3>
                      <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                        {signal.screeningExplanation}
                      </p>

                      {/* Mini Bento Metrics Pills */}
                      <div className="grid grid-cols-2 gap-8 text-caption">
                        <div className="rounded-small-buttons bg-warm-parchment p-10 border border-[#ded8cb] transition-colors hover:border-deep-lagoon/30">
                          <span className="block text-[11px] font-w460 uppercase tracking-wider text-stone-gray">Volume Sumber</span>
                          <strong className="text-body-sm font-w540 text-ink-charcoal">
                            {signal.metrics.volume.availability === "AVAILABLE" ? String(signal.metrics.volume.value) : "Tidak tersedia"}
                          </strong>
                        </div>
                        <div className="rounded-small-buttons bg-warm-parchment p-10 border border-[#ded8cb] transition-colors hover:border-deep-lagoon/30">
                          <span className="block text-[11px] font-w460 uppercase tracking-wider text-stone-gray">Status Sumber</span>
                          <strong className="text-body-sm font-w540 text-ink-charcoal">
                            {signal.metrics.active.value ? "Aktif" : "Tidak aktif"}
                          </strong>
                        </div>
                      </div>

                      <dl className="grid gap-8 border-t border-soft-mist pt-12 text-caption text-stone-gray sm:grid-cols-2">
                        <div><dt className="font-w540 text-ink-charcoal">Referensi sumber</dt><dd><a className="underline underline-offset-2 text-royal-violet" href={signal.source.url} rel="noreferrer" target="_blank">Google Trends Trending Now (Indonesia)</a></dd></div>
                        <div><dt className="font-w540 text-ink-charcoal">Wilayah</dt><dd>Indonesia (ID)</dd></div>
                        <div><dt className="font-w540 text-ink-charcoal">Volume</dt><dd>{signal.metrics.volume.availability === "AVAILABLE" ? String(signal.metrics.volume.value) : "Tidak tersedia"}</dd></div>
                        <div><dt className="font-w540 text-ink-charcoal">Status</dt><dd>{signal.metrics.active.value ? "Aktif" : "Tidak aktif"}</dd></div>
                      </dl>

                      <p className="text-caption leading-body-sm text-stone-gray">
                        Sinyal pencarian bukan bukti pembelian atau jaminan keberhasilan usaha.
                      </p>

                      {snapshot.analysisAvailability.status === "AVAILABLE" ? (
                        <Button
                          disabled={analyzing || snapshot.freshness === "STALE"}
                          onClick={() => { setSelectedSignalId(signal.id); setConsent(false); setAnalysis(null); setAnalysisError(null); }}
                          type="button"
                          variant="secondary"
                        >
                          Analisis tren
                        </Button>
                      ) : (
                        <p className="text-caption text-stone-gray">{blockedAnalysisMessage[snapshot.analysisAvailability.reason]}</p>
                      )}

                      {selectedSignalId === signal.id ? (
                        <div className="grid gap-12 rounded-cards border border-midnight-wine/40 bg-warm-parchment p-16 sm:p-20">
                          {publicHttpTransport ? <StatusNotice role="alert" tone="error">Koneksi tidak aman. Gunakan hanya data contoh.</StatusNotice> : null}
                          <label className="flex items-start gap-10 text-body-sm leading-body-sm text-ink-charcoal">
                            <input checked={consent} className="mt-3 size-16 accent-midnight-wine" onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
                            <span>Saya setuju ringkasan sinyal dan konteks profil yang relevan diproses untuk analisis ini. Hasil tidak disimpan.</span>
                          </label>
                          <p className="text-caption leading-body-sm text-stone-gray">Hasil adalah panduan awal, bukan jaminan.</p>
                          <Button disabled={!consent || analyzing} loading={analyzing} onClick={() => void analyze(signal.id)} type="button">{analyzing ? "Menganalisis…" : "Mulai analisis"}</Button>
                          {analysisError ? <p aria-live="polite" className="text-body-sm text-ink-charcoal" role="alert">{analysisError}</p> : null}
                          {analysisError && retryVisible ? (
                            <Button
                              disabled={analyzing || retrySeconds > 0}
                              onClick={() => void analyze(signal.id)}
                              type="button"
                              variant="secondary"
                            >
                              {retrySeconds > 0 ? `Coba lagi dalam ${retrySeconds} detik` : "Coba analisis lagi"}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {analysis ? (
            <Card aria-labelledby="live-analysis-heading" className="grid gap-16 p-20 sm:p-24 border-royal-violet/30">
              <div>
                <p className="text-caption font-w540 text-royal-violet">Analisis selesai</p>
                <h3 className="text-heading-sm font-w460 text-ink-charcoal" id="live-analysis-heading">Analisis sinyal terpilih</h3>
                <p className="text-caption text-stone-gray">Sumber: <a className="underline underline-offset-2 text-royal-violet" href={analysis.sourceReference.url} rel="noreferrer" target="_blank">Google Trends</a></p>
              </div>
              <dl className="grid gap-12">
                {([
                  ["Ringkasan", analysis.analysis.summary], ["Mengapa relevan", analysis.analysis.whyRelevant],
                  ["Konsumen sasaran", analysis.analysis.targetConsumer], ["Kompetisi", analysis.analysis.competition],
                  ["Potensi sebagai hipotesis", analysis.analysis.potential], ["Risiko", analysis.analysis.risks.join("; ")],
                  ["Langkah berikutnya", analysis.analysis.nextAction],
                ] as const).map(([label, value]) => (
                  <div className="border-t border-soft-mist pt-10" key={label}>
                    <dt className="text-label-bold font-w540 text-ink-charcoal">{label}</dt>
                    <dd className="mt-4 wrap-anywhere text-body-sm leading-body-sm text-stone-gray">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-6 border-t border-soft-mist pt-12">
                {analysis.limitations.map((limitation) => <p className="text-caption leading-body-sm text-stone-gray" key={limitation}>{limitation}</p>)}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
