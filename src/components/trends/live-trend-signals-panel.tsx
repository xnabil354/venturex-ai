"use client";

import { useEffect, useState } from "react";

import {
  liveTrendAnalysisResponseSchema,
  liveTrendSignalsResponseSchema,
  type LiveTrendAnalysisResponse,
  type LiveTrendSignalsResponse,
} from "@/trend/live-signals-contract";

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
  READY: "9Router siap digunakan setelah persetujuan Anda.",
  AI_FEATURE_DISABLED: "Analisis 9Router belum diaktifkan pada lingkungan ini.",
  AI_PROVIDER_CONFIGURATION_UNAVAILABLE: "Endpoint, kunci server, atau model 9Router belum siap atau tidak diizinkan pada lingkungan ini.",
  SOURCE_PROCESSING_NOT_APPROVED: "Pemrosesan observasi Google Trends oleh 9Router belum disetujui.",
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
        setRefreshError(isApiError(payload) ? payload.error.message ?? "Observasi Google Trends belum tersedia." : "Observasi Google Trends belum tersedia.");
        return;
      }
      const parsed = liveTrendSignalsResponseSchema.safeParse(payload.data);
      if (!parsed.success) {
        setRefreshError("Respons Google Trends tidak memenuhi kontrak tampilan. Katalog historis tidak digunakan sebagai pengganti.");
        return;
      }
      setSnapshot(parsed.data);
    } catch {
      setRefreshError("Koneksi ke Google Trends gagal. Data historis tidak ditampilkan sebagai pengganti.");
    } finally {
      setRefreshing(false);
    }
  }

  async function analyze(signalId: string) {
    if (!snapshot || !consent) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    setRetryVisible(false);
    setRetrySeconds(0);
    try {
      const response = await fetch("/api/v1/trends/live-signals/analysis", {
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
      if (!response.ok || isApiError(payload)) {
        setAnalysisError(isApiError(payload) ? payload.error.message ?? "Analisis 9Router gagal." : "Analisis 9Router gagal.");
        const retryAfter = Number(response.headers.get("Retry-After"));
        if (Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 300) {
          setRetryVisible(true);
          setRetrySeconds(retryAfter);
        }
        return;
      }
      const parsed = liveTrendAnalysisResponseSchema.safeParse(payload.data);
      if (!parsed.success) {
        setAnalysisError("Respons analisis tidak memenuhi kontrak tampilan. Tidak ada hasil simulasi yang ditampilkan sebagai live.");
        return;
      }
      setAnalysis(parsed.data);
    } catch {
      setAnalysisError("Koneksi ke 9Router gagal. Tidak ada hasil simulasi yang ditampilkan sebagai live.");
    } finally {
      setAnalyzing(false);
      setConsent(false);
    }
  }

  return (
    <section aria-labelledby="live-signals-heading" className="mb-32 border-y border-soft-mist py-20 sm:py-24">
      <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="grid max-w-[760px] gap-8">
          <p className="text-label-bold font-w460 text-royal-violet">Google Trends · permintaan manual</p>
          <h2 className="text-heading-sm font-w460 leading-heading-sm text-ink-charcoal" id="live-signals-heading">
            Sinyal pencarian Indonesia
          </h2>
          <p className="text-body-sm leading-body-sm text-stone-gray">
            Daftar Trending Now menampilkan kueri Google Search yang sedang naik. Cakupan F&amp;B dan kata kunci usaha di bawah adalah penyaringan lokal VENTUREX; bukan kueri kategori atau kata kunci yang dikirim ke Google Trends.
          </p>
        </div>
        <button
          className="min-h-44 w-fit rounded-full border border-ink-charcoal bg-lilac-mist px-18 py-10 text-body-sm font-w540 text-ink-charcoal transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={refreshing}
          onClick={() => void refresh()}
          type="button"
        >
          {refreshing ? "Memuat sinyal…" : snapshot ? `Perbarui ${selectedWindowLabel}` : "Muat sinyal terbaru"}
        </button>
      </div>

      <div className="mt-20 grid gap-12 rounded-xl border border-soft-mist bg-white p-16 sm:grid-cols-2 sm:p-20">
        <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal">
          Rentang Trending Now
          <select
            className="min-h-44 rounded-lg border border-soft-mist bg-white px-12 text-body-sm font-w460 text-ink-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
            onChange={(event) => setTimeWindowHours(Number(event.target.value) as TimeWindowHours)}
            value={timeWindowHours}
          >
            {timeWindowOptions.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}
          </select>
          <span className="text-caption font-w460 text-stone-gray">Indonesia · Penelusuran Google · rentang diterapkan saat Anda menekan perbarui.</span>
        </label>
        <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal">
          Kata kunci produk dari profil
          <input
            autoComplete="off"
            className="min-h-44 rounded-lg border border-soft-mist bg-white px-12 text-body-sm font-w460 text-ink-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
            maxLength={80}
            onChange={(event) => {
              setKeyword(event.target.value);
              setSelectedSignalId(null);
              setAnalysis(null);
            }}
            placeholder="Contoh: bakso"
            value={keyword}
          />
          <span className="text-caption font-w460 text-stone-gray">Hanya menyaring daftar yang sudah dimuat; mengubahnya tidak mengirim profil atau membuat request baru.</span>
        </label>
        <label className="flex items-start gap-10 text-body-sm leading-body-sm text-ink-charcoal sm:col-span-2">
          <input
            checked={includeReviewRequired}
            className="mt-3 size-16 accent-royal-violet"
            onChange={(event) => setIncludeReviewRequired(event.target.checked)}
            type="checkbox"
          />
          <span>Sertakan istilah yang masih ambigu dan perlu tinjauan manual</span>
        </label>
      </div>

      {refreshError ? <p aria-live="polite" className="mt-16 rounded-xl border border-soft-mist bg-white px-16 py-12 text-body-sm text-ink-charcoal" role="status">{refreshError}</p> : null}

      {snapshot ? (
        <div className="mt-20 grid gap-20" aria-live="polite">
          {snapshot.mode === "MOCK_TEST" ? (
            <p className="border-l-2 border-royal-violet pl-12 text-label-bold text-royal-violet">TEST STUB — bukan respons Google Trends live.</p>
          ) : null}
          <div className="grid gap-8 text-caption text-stone-gray">
            <p>
              Snapshot {snapshot.mode === "MOCK_TEST" ? "uji" : "disajikan"} {new Date(snapshot.generatedAt).toLocaleString("id-ID")} · sumber diambil {new Date(snapshot.retrievedAt).toLocaleString("id-ID")} · Indonesia · {snapshot.source.timeWindowHours} jam terakhir · {snapshot.cache === "NETWORK" ? "request baru" : snapshot.cache === "COALESCED" ? "request bersama" : "cache sementara"} · status batch {snapshot.batchStatus}{snapshot.freshness === "STALE" ? " · data lama" : ""}
            </p>
            <p>
              Diterima {snapshot.records.accepted} dari {snapshot.records.retrieved}; ditolak {snapshot.records.rejected}. Klasifikasi lokal: {snapshot.screening.classifications.LIKELY_FNB} kemungkinan F&amp;B, {snapshot.screening.classifications.REVIEW_REQUIRED} perlu tinjauan, {snapshot.screening.classifications.OUT_OF_SCOPE} di luar cakupan.
            </p>
            <p>
              F&amp;B adalah penyaringan heuristic VENTUREX, bukan kategori yang diterapkan pada sumber. Kata kunci hanya menyaring hasil Trending Now yang sudah diterima; tidak ada hasil khusus kueri Bakso jika Google Trends tidak memasukkannya ke daftar.
            </p>
          </div>
          {snapshot.freshness === "STALE" ? <p className="rounded-lg bg-lilac-mist px-12 py-10 text-body-sm text-ink-charcoal">Refresh baru tidak berhasil; observasi cache ditandai lama dan bukan data baru.</p> : null}

          {visibleSignals.length === 0 ? (
            <div className="rounded-xl border border-soft-mist bg-white px-16 py-14 text-body-sm text-stone-gray">
              {normalizedKeyword
                ? <>Tidak ada sinyal Trending Now pada rentang {snapshot.source.timeWindowHours} jam yang cocok dengan “{keyword.trim()}”. Ini tidak membuktikan bahwa minat pencarian untuk istilah tersebut tidak ada; istilah ini hanya menyaring daftar trending umum yang dikembalikan.</>
                : "Tidak ada sinyal yang cocok dengan cakupan F&B lokal pada observasi ini. Tidak ada data yang dibuat untuk mengisi daftar."}
            </div>
          ) : (
            <ul aria-label="Sinyal Google Trends dengan relevansi F&B" className="grid gap-12 md:grid-cols-2">
              {visibleSignals.map((signal) => (
                <li className="rounded-xl border border-soft-mist bg-white p-16 sm:p-20" key={signal.id}>
                  <article aria-labelledby={`live-signal-${signal.id}`} className="grid gap-12">
                    <div className="flex flex-wrap items-center gap-8">
                      <span className="rounded-full border border-soft-mist bg-lilac-mist px-10 py-5 text-caption text-ink-charcoal">{signal.classification === "LIKELY_FNB" ? "Kemungkinan F&B · heuristic" : "Perlu tinjauan manual"}</span>
                      <span className="text-caption text-stone-gray">Sinyal sumber · belum divalidasi</span>
                    </div>
                    <h3 className="wrap-anywhere text-heading-sm font-w460 text-ink-charcoal" id={`live-signal-${signal.id}`}>{signal.title}</h3>
                    <p className="wrap-anywhere text-body-sm leading-body-sm text-stone-gray">{signal.screeningExplanation}</p>
                    <dl className="grid gap-8 border-t border-soft-mist pt-12 text-caption text-stone-gray sm:grid-cols-2">
                      <div><dt className="font-w540 text-ink-charcoal">Sumber</dt><dd>{signal.source.publisher}</dd></div>
                      <div><dt className="font-w540 text-ink-charcoal">Referensi sumber</dt><dd><a className="underline underline-offset-2" href={signal.source.url} rel="noreferrer" target="_blank">Google Trends Trending Now (Indonesia)</a></dd></div>
                      <div><dt className="font-w540 text-ink-charcoal">Wilayah</dt><dd>Indonesia (ID)</dd></div>
                      <div><dt className="font-w540 text-ink-charcoal">Diambil</dt><dd>{new Date(signal.source.retrievedAt).toLocaleString("id-ID")}</dd></div>
                      <div><dt className="font-w540 text-ink-charcoal">Mulai trending</dt><dd>{signal.source.providerStartedAtUnixSeconds ? new Date(signal.source.providerStartedAtUnixSeconds * 1000).toLocaleString("id-ID") : "Tidak tersedia"}</dd></div>
                      <div><dt className="font-w540 text-ink-charcoal">Volume pencarian dari sumber</dt><dd>{signal.metrics.volume.availability === "AVAILABLE" ? String(signal.metrics.volume.value) : "Tidak tersedia"} · unit tidak disediakan</dd></div>
                      <div><dt className="font-w540 text-ink-charcoal">Perubahan volume dari sumber</dt><dd>{signal.metrics.volumeChange.availability === "AVAILABLE" ? String(signal.metrics.volumeChange.value) : "Tidak tersedia"} · unit tidak disediakan</dd></div>
                      <div><dt className="font-w540 text-ink-charcoal">Status dari sumber</dt><dd>{signal.metrics.active.value ? "Aktif" : "Tidak aktif"}</dd></div>
                    </dl>
                    <p className="text-caption leading-body-sm text-stone-gray">Trending Now menunjukkan lonjakan aktivitas penelusuran, bukan pembelian, permintaan pasar, omzet, atau kelayakan usaha. Volume adalah nilai sumber tanpa unit yang dapat ditafsirkan sebagai jumlah pembeli.</p>
                    {snapshot.analysisAvailability.status === "AVAILABLE" ? (
                      <button
                        className="min-h-40 w-fit rounded-full border border-ink-charcoal px-14 py-8 text-body-sm font-w540 text-ink-charcoal hover:bg-lilac-mist disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={analyzing || snapshot.freshness === "STALE"}
                        onClick={() => { setSelectedSignalId(signal.id); setConsent(false); setAnalysis(null); setAnalysisError(null); }}
                        type="button"
                      >
                        Analisis dengan 9Router
                      </button>
                    ) : (
                      <p className="text-caption text-stone-gray">Analisis 9Router belum tersedia: {blockedAnalysisMessage[snapshot.analysisAvailability.reason]}</p>
                    )}
                    {selectedSignalId === signal.id ? (
                      <div className="grid gap-10 rounded-lg bg-lilac-mist p-12">
                        {publicHttpTransport ? <p className="border-l-2 border-ink-charcoal bg-white px-12 py-10 text-body-sm leading-body-sm text-ink-charcoal" role="alert">Peringatan transport: koneksi ke 9Router memakai HTTP tanpa enkripsi. Kunci API dan konteks yang dikirim dapat terlihat di jalur jaringan. Gunakan hanya profil uji sintetis dan jangan lanjutkan dengan data sensitif.</p> : null}
                        <label className="flex items-start gap-10 text-body-sm leading-body-sm text-ink-charcoal">
                          <input checked={consent} className="mt-3 size-16 accent-royal-violet" onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
                          <span>Saya setuju VENTUREX mengirim kategori produk/minat, jenis produk yang diminati bila diisi, segmen konsumen, kanal penjualan, dan bila relevan tingkat pengalaman/komitmen waktu dari profil server saya, bersama ringkasan sinyal Google Trends terpilih, ke layanan 9Router yang dikonfigurasi operator dengan model cx/gpt-6-luna-xhigh untuk satu analisis. Nama akun, email, lokasi, uraian bebas, catatan, dan angka finansial tidak dikirim. Hasil tidak disimpan oleh fitur ini. Retensi dan pemrosesan lanjutan layanan 9Router tidak diverifikasi oleh VENTUREX.{publicHttpTransport ? " Saya memahami request ini memakai HTTP tanpa enkripsi dan hanya melanjutkan dengan profil uji sintetis." : ""}</span>
                        </label>
                        <p className="text-caption leading-body-sm text-stone-gray">Analisis adalah interpretasi awal, bukan fakta pasar atau jaminan. Penggunaan konteks profil hanya tersedia setelah pemrosesan sumber diizinkan dan persetujuan ini diberikan.</p>
                        <button className="min-h-40 w-fit rounded-full bg-ink-charcoal px-14 py-8 text-body-sm font-w540 text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!consent || analyzing} onClick={() => void analyze(signal.id)} type="button">{analyzing ? "Meminta 9Router…" : "Kirim persetujuan dan analisis"}</button>
                        {analysisError ? <p aria-live="polite" className="text-body-sm text-ink-charcoal" role="alert">{analysisError}</p> : null}
                        {analysisError && retryVisible ? (
                          <button
                            className="min-h-40 w-fit rounded-full border border-ink-charcoal px-14 py-8 text-body-sm font-w540 text-ink-charcoal disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={analyzing || retrySeconds > 0}
                            onClick={() => void analyze(signal.id)}
                            type="button"
                          >
                            {retrySeconds > 0 ? `Coba lagi dalam ${retrySeconds} detik` : "Coba analisis lagi"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          )}
          {analysis ? (
            <section aria-labelledby="live-analysis-heading" className="grid gap-12 rounded-xl border border-soft-mist bg-white p-16 sm:p-20">
              <div>
                <p className="text-caption text-royal-violet">{analysis.mode === "LIVE_PROVIDER" ? `Respons ${analysis.provider} live` : "TEST STUB — bukan respons 9Router live"}</p>
                <h3 className="text-heading-sm font-w460 text-ink-charcoal" id="live-analysis-heading">Analisis sinyal terpilih</h3>
                <p className="text-caption text-stone-gray">Sumber: {analysis.sourceReference.title} · {analysis.sourceReference.publisher} · diambil {new Date(analysis.sourceReference.retrievedAt).toLocaleString("id-ID")}</p>
              </div>
              <dl className="grid gap-12">
                {([
                  ["Ringkasan", analysis.analysis.summary], ["Mengapa relevan", analysis.analysis.whyRelevant],
                  ["Konsumen sasaran", analysis.analysis.targetConsumer], ["Kompetisi", analysis.analysis.competition],
                  ["Potensi sebagai hipotesis", analysis.analysis.potential], ["Risiko", analysis.analysis.risks.join("; ")],
                  ["Langkah berikutnya", analysis.analysis.nextAction],
                ] as const).map(([label, value]) => <div className="border-t border-soft-mist pt-10" key={label}><dt className="text-label-bold font-w540 text-ink-charcoal">{label}</dt><dd className="mt-4 wrap-anywhere text-body-sm leading-body-sm text-stone-gray">{value}</dd></div>)}
              </dl>
              <div className="grid gap-6 border-t border-soft-mist pt-12">
                {analysis.limitations.map((limitation) => <p className="text-caption leading-body-sm text-stone-gray" key={limitation}>{limitation}</p>)}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
