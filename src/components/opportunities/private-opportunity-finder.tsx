"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, EmptyState, PageContainer, StatusNotice } from "@/components/ui";
import type { StatusNoticeTone } from "@/components/ui/status-notice";
import { cx } from "@/lib/cx";
import {
  OPPORTUNITY_SEARCHAPI_DISCLOSURE_VERSION,
  searchApiOpportunitySignalsResponseSchema,
  type SearchApiOpportunitySignalOption,
} from "@/opportunity/searchapi-evidence-contract";
import {
  privateOpportunityGenerationResponseSchema,
  privateOpportunityIdeaResponseSchema,
  type PrivateOpportunityIdeaDto,
} from "@/opportunity/private-hypothesis";
import { hasVerifiedBusinessConcept } from "@/opportunity/business-analysis-contract";
import { PrivateHypothesisContent } from "./private-hypothesis-content";
import { PrivatePagination } from "./private-pagination";
import {
  WORLDWIDE_TREND_GEO,
  type GoogleTrendsGeoOption,
  type TrendRadarPreset,
  type TrendRadarProperty,
} from "@/trend/trend-radar-contract";
import { GoogleTrendsGeographySelect } from "@/components/trends/google-trends-geography-select";
import {
  opportunityTypeLabel,
  SavedSource,
  SignalOption,
  sourceMetricLabel,
  sourceTypeLabel,
} from "./private-opportunity-finder-parts";

type PeriodOption = Readonly<{ value: TrendRadarPreset; label: string }>;

const periodOptions: readonly PeriodOption[] = [
  { value: "1h", label: "1 jam terakhir" },
  { value: "4h", label: "4 jam terakhir" },
  { value: "24h", label: "24 jam terakhir" },
  { value: "7d", label: "7 hari terakhir" },
  { value: "1m", label: "1 bulan terakhir" },
  { value: "3m", label: "3 bulan terakhir" },
  { value: "1y", label: "1 tahun terakhir" },
  { value: "5y", label: "5 tahun terakhir" },
  { value: "all", label: "Sepanjang waktu" },
];

const propertyOptions: readonly Readonly<{ value: TrendRadarProperty; label: string }>[] = [
  { value: "web", label: "Penelusuran web" },
  { value: "images", label: "Penelusuran gambar" },
  { value: "news", label: "Berita" },
  { value: "shopping", label: "Shopping" },
  { value: "youtube", label: "YouTube" },
];

function apiError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return null;
  const error = payload.error;
  return typeof error === "object" && error !== null ? "Permintaan belum berhasil. Coba lagi." : null;
}

export function PrivateOpportunityFinder({
  initialItems,
  comparisonOwnerId,
  initialLoadFailed = false,
  profileContextCategories = [],
  profileContextAvailable = false,
  providerAvailable = false,
  providerBlockMessage,
  evidenceSigningAvailable = false,
  searchApiAvailable = false,
  sourceProcessingApproved = false,
  view = "finder",
  showScoreDetails = false,
  businessMode = false,
  queryKey,
  pagination,
  profileActionRequired = false,
}: {
  readonly comparisonOwnerId?: string;
  readonly initialItems: readonly PrivateOpportunityIdeaDto[];
  readonly initialLoadFailed?: boolean;
  readonly profileContextCategories?: readonly string[];
  readonly profileContextAvailable?: boolean;
  readonly providerAvailable?: boolean;
  readonly providerBlockMessage?: string;
  readonly evidenceSigningAvailable?: boolean;
  readonly searchApiAvailable?: boolean;
  readonly sourceProcessingApproved?: boolean;
  readonly view?: "finder" | "saved";
  readonly showScoreDetails?: boolean;
  readonly businessMode?: boolean;
  readonly queryKey?: string;
  readonly pagination?: { readonly page: number; readonly hasMore: boolean };
  readonly profileActionRequired?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const comparisonKey = comparisonOwnerId ? `venturex:compare:${comparisonOwnerId}` : null;
  const [fallbackIds, setFallbackIds] = useState<readonly string[]>([]);
  const storedComparison = useSyncExternalStore(
    callback => { window.addEventListener("venturex-comparison", callback); return () => window.removeEventListener("venturex-comparison", callback); },
    () => { try { return comparisonKey ? sessionStorage.getItem(comparisonKey) ?? "[]" : "[]"; } catch { return "[]"; } },
    () => "[]",
  );
  const compareIds = useMemo(() => {
    try {
      const value: unknown = JSON.parse(storedComparison);
      return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id)))].slice(0, 3) : [];
    } catch { return []; }
  }, [storedComparison]);
  const selectedForCompare = comparisonKey && storedComparison !== "[]" ? compareIds : fallbackIds;
  function updateComparison(next: readonly string[]) {
    setFallbackIds(next);
    try { if (comparisonKey) sessionStorage.setItem(comparisonKey, JSON.stringify(next)); } catch { /* Retain page selection. */ }
    window.dispatchEvent(new Event("venturex-comparison"));
  }
  const [period, setPeriod] = useState<TrendRadarPreset>("24h");
  const [property, setProperty] = useState<TrendRadarProperty>("web");
  const [geography, setGeography] = useState<GoogleTrendsGeoOption | null>(WORLDWIDE_TREND_GEO);
  const [topOptions, setTopOptions] = useState<readonly SearchApiOpportunitySignalOption[]>([]);
  const [risingOptions, setRisingOptions] = useState<readonly SearchApiOpportunitySignalOption[]>([]);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [consent, setConsent] = useState(false);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PrivateOpportunityIdeaDto | null>(null);
  const [error, setError] = useState<string | null>(initialLoadFailed ? "Penyimpanan hipotesis belum siap. Terapkan migrasi database 018 sebelum menggunakan Finder." : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<StatusNoticeTone>("success");
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const sourceOptions = useMemo(() => [...topOptions, ...risingOptions], [topOptions, risingOptions]);
  const selectedSource = sourceOptions.find((source) => source.id === selectedSourceId) ?? null;

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteCandidate && !dialog.open) dialog.showModal();
    else if (!deleteCandidate && dialog.open) dialog.close();
  }, [deleteCandidate]);

  function clearLoadedSources() {
    setTopOptions([]);
    setRisingOptions([]);
    setLoadedQuery(null);
    setSelectedSourceId("");
    setConsent(false);
    setNotice(null);
  }

  async function loadSignals() {
    if (!searchApiAvailable || !evidenceSigningAvailable || !geography || loadingSignals) return;
    setLoadingSignals(true);
    setError(null);
    setNotice(null);
    clearLoadedSources();
    try {
      const response = await fetch("/api/v1/opportunities/signals", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, property, geo: geography.geo, ...(queryKey ? { queryKey } : {}) }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok) {
        setError(apiError(payload) ?? "Sinyal Google Trends belum dapat dimuat.");
        return;
      }
      const parsed = searchApiOpportunitySignalsResponseSchema.safeParse(
        typeof payload === "object" && payload !== null && "data" in payload ? payload.data : null,
      );
      if (!parsed.success) {
        setError("Respons sinyal Google Trends tidak memenuhi kontrak. Tidak ada sinyal yang ditampilkan.");
        return;
      }
      if (parsed.data.appliedFilters.period !== period
        || parsed.data.appliedFilters.property !== property
        || parsed.data.appliedFilters.geo !== geography.geo
        || [...parsed.data.top, ...parsed.data.rising].some((option) => option.geo !== geography.geo)) {
        setError("Filter sinyal berubah selama pemuatan. Muat ulang dengan wilayah dan filter yang sama.");
        return;
      }
      setTopOptions(parsed.data.top);
      setRisingOptions(parsed.data.rising);
      setLoadedQuery(parsed.data.productQuery);
      const firstSource = parsed.data.top[0] ?? parsed.data.rising[0];
      if (firstSource) setSelectedSourceId(firstSource.id);
      setNotice(firstSource
        ? `Sinyal aktual dimuat untuk “${parsed.data.productQuery}”. Pilih satu kueri dan tinjau buktinya.`
        : `Belum ada kueri terkait untuk “${parsed.data.productQuery}” pada filter ini.`);
    } catch {
      setError("Sinyal gagal dimuat. Coba lagi.");
    } finally {
      setLoadingSignals(false);
    }
  }

  async function generate() {
    if (!providerAvailable || !sourceProcessingApproved || initialLoadFailed || !selectedSource || !consent || generating) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/v1/opportunities/ideas", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceToken: selectedSource.sourceToken,
          consent: true,
          disclosureVersion: OPPORTUNITY_SEARCHAPI_DISCLOSURE_VERSION,
        }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok) {
        setError(apiError(payload) ?? "Hipotesis AI belum tersedia.");
        return;
      }
      const parsedResponse = privateOpportunityGenerationResponseSchema.safeParse(payload);
      if (!parsedResponse.success) {
        setError("Respons AI tidak memenuhi kontrak tampilan. Tidak ada hasil simulasi yang ditampilkan.");
        return;
      }
      if (parsedResponse.data.outcome === "INSUFFICIENT_EVIDENCE") {
        setNoticeTone("warning");
        setNotice(`Bukti belum cukup untuk membentuk hipotesis yang dapat dipertanggungjawabkan. ${parsedResponse.data.reason} ${parsedResponse.data.limitations.join(" ")}`);
        setConsent(false);
        return;
      }
      const generatedItems = parsedResponse.data.data;
      setItems((current) => [...generatedItems, ...current].slice(0, 50));
      setNoticeTone("success");
      setNotice(`${generatedItems.length} hipotesis tersimpan. Tinjau sebelum digunakan.`);
      setConsent(false);
      router.refresh();
    } catch {
      setError("Koneksi ke layanan AI terputus. Periksa Opportunity Finder sebelum mencoba kembali.");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleSaved(item: PrivateOpportunityIdeaDto) {
    setSavingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/v1/opportunities/ideas", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, saved: !item.saved }),
      });
      const payload = await response.json() as unknown;
      if (!response.ok) {
        setError(apiError(payload) ?? "Penyimpanan hipotesis gagal diperbarui.");
        return;
      }
      const parsed = privateOpportunityIdeaResponseSchema.safeParse(
        typeof payload === "object" && payload !== null && "data" in payload ? payload.data : null,
      );
      if (!parsed.success) {
        setError("Respons pembaruan penyimpanan tidak valid.");
        return;
      }
      setItems((current) => current
        .map((candidate) => candidate.id === parsed.data.id ? parsed.data : candidate)
        .filter((candidate) => view !== "saved" || candidate.saved));
      setNotice(parsed.data.saved ? "Hipotesis tersimpan di akun Anda." : "Hipotesis dihapus dari daftar simpanan.");
    } catch {
      setError("Koneksi untuk menyimpan hipotesis gagal.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteHypothesis(item: PrivateOpportunityIdeaDto) {
    if (deletingId || savingId === item.id) return;
    setDeletingId(item.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/v1/opportunities/ideas", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!response.ok) {
        let payload: unknown = null;
        try { payload = await response.json() as unknown; } catch { /* Use the safe fallback below. */ }
        setError(apiError(payload) ?? "Hipotesis belum dapat dihapus. Coba lagi.");
        return;
      }
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setNotice("Hipotesis dihapus dari akun Anda.");
    } catch {
      setError("Koneksi untuk menghapus hipotesis gagal. Hipotesis tetap tersimpan.");
    } finally {
      setDeletingId(null);
    }
  }

  async function confirmDeleteHypothesis() {
    const item = deleteCandidate;
    if (!item || deletingId || savingId === item.id) return;
    await deleteHypothesis(item);
    setDeleteCandidate(null);
  }

  return (
    <PageContainer>
      <div className="grid gap-20 py-24 sm:gap-24 sm:py-32 lg:py-48">
        <header className="grid max-w-[760px] gap-8 border-b border-soft-mist pb-16 sm:gap-12 sm:pb-24">
          <div className="flex flex-wrap items-center gap-12">
            <h1 className="text-subheading font-w460 leading-subheading tracking-[-0.4px] text-ink-charcoal sm:text-heading-lg sm:leading-heading-lg sm:tracking-heading-lg lg:text-display lg:leading-display lg:tracking-display">
              {view === "saved" ? "Saved Opportunities" : "Opportunity Finder"}
            </h1>
          </div>
          <p className="text-body leading-relaxed text-stone-gray">
            {view === "saved"
              ? "Kumpulan hipotesis yang Anda simpan. Tinjau kembali bukti, bandingkan peluang yang sudah dianalisis, atau hapus jika tidak lagi diperlukan."
              : "Pilih sinyal Google Trends untuk menyusun hipotesis."}
          </p>
        </header>

        {view === "finder" ? (
          <Card aria-labelledby="generate-ideas-title" className="grid w-full gap-16 border-soft-mist bg-paper-white p-16 sm:p-20">
            <div className="flex flex-wrap items-baseline justify-between gap-8 border-b border-soft-mist pb-12">
              <h2 className="text-label-bold font-w540 text-ink-charcoal sm:text-heading-sm sm:font-w460" id="generate-ideas-title">
                Buat hipotesis dari sinyal Google Trends
              </h2>
            </div>

            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="grid min-w-0 gap-6 text-body-sm font-w540 text-ink-charcoal" htmlFor="opportunity-signal-period">
                Rentang waktu
                <select
                  className="min-h-[44px] min-w-0 rounded-small-buttons border border-soft-mist bg-paper-white px-12 text-body-sm font-w460 focus:border-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
                  disabled={loadingSignals}
                  id="opportunity-signal-period"
                  onChange={(event) => { setPeriod(event.target.value as TrendRadarPreset); clearLoadedSources(); setError(null); }}
                  value={period}
                >
                  {periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-6 text-body-sm font-w540 text-ink-charcoal" htmlFor="opportunity-signal-property">
                Properti penelusuran
                <select
                  className="min-h-[44px] min-w-0 rounded-small-buttons border border-soft-mist bg-paper-white px-12 text-body-sm font-w460 focus:border-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet"
                  disabled={loadingSignals}
                  id="opportunity-signal-property"
                  onChange={(event) => { setProperty(event.target.value as TrendRadarProperty); clearLoadedSources(); setError(null); }}
                  value={property}
                >
                  {propertyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <GoogleTrendsGeographySelect
                disabled={loadingSignals}
                id="opportunity-signal-geography"
                onChange={(value) => { setGeography(value); clearLoadedSources(); setError(null); }}
                value={geography}
              />
              <Button disabled={!searchApiAvailable || !evidenceSigningAvailable || !geography || loadingSignals} loading={loadingSignals} onClick={() => void loadSignals()} type="button" variant="secondary">
                {loadingSignals ? "Memuat..." : "Muat sinyal"}
              </Button>
            </div>

            {!searchApiAvailable ? (
              <p className="text-body-sm text-stone-gray" role="status">Sinyal tren belum tersedia saat ini.</p>
            ) : null}
            {searchApiAvailable && !evidenceSigningAvailable ? (
              <p className="text-body-sm text-stone-gray" role="status">Fitur belum siap digunakan. Coba lagi nanti.</p>
            ) : null}

            {sourceOptions.length > 0 ? (
              <div className="grid gap-16 border-t border-soft-mist pt-16">
                <div className="grid gap-4 text-body-sm text-stone-gray">
                  <p>Kueri profil: <strong className="font-w540 text-ink-charcoal">{loadedQuery}</strong></p>
                <p>Google Trends · {geography?.label ?? "Wilayah"} · {periodOptions.find((item) => item.value === period)?.label}.</p>
                </div>
                <fieldset className="grid gap-10">
                  <legend className="mb-10 text-body-sm font-w540 text-ink-charcoal">Pilih satu sinyal untuk ditinjau</legend>
                  <div className="grid gap-16 lg:grid-cols-2">
                    {[
                      { title: "Kueri terpopuler", options: topOptions },
                      { title: "Kueri yang makin populer", options: risingOptions },
                    ].map((group) => (
                      <section className="grid min-w-0 content-start gap-10" key={group.title}>
                        <h3 className="text-body-sm font-w540 text-ink-charcoal">{group.title} <span className="font-w400 text-stone-gray">({group.options.length})</span></h3>
                        {group.options.length > 0 ? (
                          <div className="grid max-h-[420px] gap-8 overflow-y-auto rounded-cards border border-soft-mist bg-warm-parchment p-8">
                            {group.options.map((option) => (
                              <SignalOption key={option.id} onSelect={(id) => { setSelectedSourceId(id); setConsent(false); }} option={option} selected={selectedSourceId === option.id} />
                            ))}
                          </div>
                        ) : <p className="rounded-cards border border-soft-mist bg-paper-white p-12 text-body-sm text-stone-gray">Tidak ada kueri pada kelompok ini.</p>}
                      </section>
                    ))}
                  </div>
                </fieldset>
              </div>
            ) : loadedQuery ? (
              <p className="border-t border-soft-mist pt-16 text-body-sm text-stone-gray" role="status">Belum ada kueri untuk “{loadedQuery}” pada filter ini. Coba rentang waktu lain.</p>
            ) : (
              <p className="border-t border-soft-mist pt-16 text-body-sm text-stone-gray">
                Atur wilayah dan filter, lalu muat sinyal Google Trends.
              </p>
            )}

            {selectedSource ? (
              <div className="grid gap-16 border-t border-soft-mist pt-16">
                <div className="flex items-center gap-8">
                  <span className="flex size-28 items-center justify-center rounded-full border border-midnight-wine bg-midnight-wine text-caption font-w540 text-paper-white">1</span>
                  <h3 className="text-body-sm font-w540 text-ink-charcoal">Tinjau sinyal terpilih</h3>
                </div>
                <div className="grid gap-4 rounded-small-buttons border border-[#ded8cb] bg-warm-parchment p-12 text-body-sm text-stone-gray">
                  <p><strong className="font-w540 text-ink-charcoal">{selectedSource.query}</strong> · {sourceTypeLabel(selectedSource.sourceType)} · {sourceMetricLabel(selectedSource)}</p>
                  <p>{geography?.label ?? "Wilayah"} · {periodOptions.find((item) => item.value === period)?.label}.</p>
                  <p>Sinyal ini dan konteks profil yang relevan digunakan setelah Anda menyetujui analisis.</p>
                  <a className="w-fit font-w540 text-royal-violet underline underline-offset-2" href={selectedSource.url} rel="noreferrer" target="_blank">Google Trends Explore</a>
                </div>
              </div>
            ) : null}

            <div className="grid gap-12 border-t border-soft-mist pt-16">
              <div className="flex items-center gap-8">
                <span className="flex size-28 items-center justify-center rounded-full border border-midnight-wine bg-midnight-wine text-caption font-w540 text-paper-white">2</span>
                <h3 className="text-body-sm font-w540 text-ink-charcoal">Persetujuan pemrosesan AI</h3>
              </div>
              {profileContextAvailable ? (
                <div className="grid gap-8 rounded-small-buttons border border-soft-mist bg-paper-white p-14">
                  <p className="text-caption font-w540 text-ink-charcoal">Kategori konteks profil yang akan digunakan</p>
                  <ul className="flex flex-wrap gap-6" aria-label="Kategori konteks profil">
                    {profileContextCategories.map((category) => <li className="rounded-pills border border-soft-mist bg-warm-parchment px-10 py-4 text-caption text-ink-charcoal" key={category}>{category}</li>)}
                  </ul>
                  <p className="text-caption leading-relaxed text-stone-gray">Profil terbaru dibaca langsung dari server saat diproses.</p>
                </div>
              ) : (
                <p className="text-body-sm text-stone-gray" role="status">Konteks profil belum dapat diverifikasi. Periksa profil dan referensi datanya sebelum membuat hipotesis.</p>
              )}
              <label className={cx(
                "flex cursor-pointer items-start gap-12 rounded-cards border p-16 text-body-sm leading-body-sm text-ink-charcoal transition-colors focus-within:ring-2 focus-within:ring-royal-violet/40 sm:p-20",
                consent ? "border-midnight-wine bg-lilac-mist/40" : "border-soft-mist bg-warm-parchment/60 hover:border-stone-gray",
              )}>
                <input checked={consent} className="mt-[2px] size-16 shrink-0 accent-midnight-wine" disabled={!selectedSource || !profileContextAvailable} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
                <span>
                  Saya setuju konteks profil dan sinyal terpilih digunakan untuk menyusun hipotesis dengan AI.
                </span>
              </label>

              {providerBlockMessage ? <p className="text-body-sm text-stone-gray" role="status">{providerBlockMessage}</p> : null}
              {initialLoadFailed ? <p className="text-body-sm text-stone-gray" role="status">Penyimpanan belum siap. Coba lagi nanti.</p> : null}
            </div>

            <div className="grid gap-8 border-t border-soft-mist pt-16">
              <div className="flex items-center gap-8">
                <span className="flex size-28 items-center justify-center rounded-full border border-midnight-wine bg-midnight-wine text-caption font-w540 text-paper-white">3</span>
                <h3 className="text-body-sm font-w540 text-ink-charcoal">Buat hipotesis AI</h3>
              </div>
              <Button disabled={!providerAvailable || !sourceProcessingApproved || initialLoadFailed || !profileContextAvailable || !consent || generating || !selectedSource} loading={generating} loadingText="AI sedang menganalisis..." onClick={() => void generate()} type="button" variant="primary">
                Buat Hipotesis dengan AI
              </Button>
            </div>
          </Card>
        ) : null}

        {profileActionRequired && view === "finder" ? <StatusNotice tone="info">Lengkapi produk yang ingin dieksplorasi sebelum memuat sinyal. <Link href="/profile" className="inline-flex min-h-button items-center text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet">Edit profil</Link></StatusNotice> : null}
        {error ? <StatusNotice aria-live="polite" role="alert" tone="error"><span className="text-midnight-wine">{error}</span></StatusNotice> : null}
        {notice ? <StatusNotice aria-live="polite" role="status" tone={noticeTone}>{notice}</StatusNotice> : null}

        {items.length === 0 && initialLoadFailed ? (
          <EmptyState action={<Link className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href="/opportunities">Coba kembali</Link>} description="Penyimpanan hipotesis belum siap. Periksa ketersediaan database sebelum menggunakan daftar ini." title="Penyimpanan belum tersedia" />
        ) : items.length === 0 ? (
          <EmptyState action={view === "saved" ? <Link className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-royal-violet" href="/opportunities">Buka Opportunity Finder</Link> : null} description={view === "saved" ? "Belum ada hipotesis yang disimpan." : "Muat sinyal tren, lalu pilih satu untuk membuat hipotesis."} title={view === "saved" ? "Belum ada simpanan" : "Belum ada hipotesis pribadi"} />
        ) : (
          <ul aria-label={view === "saved" ? "Hipotesis tersimpan pribadi" : "Hipotesis peluang pribadi"} className="grid gap-16">
            {items.map((item) => (
              <li className="scroll-mt-96" data-hypothesis-id={item.id} id={`hypothesis-${item.id}`} key={item.id}>
                <Card className="grid min-w-0 gap-20 border-soft-mist bg-paper-white p-16 sm:gap-24 sm:p-24">
                  <article className="grid min-w-0 gap-20">
                    <div className="flex flex-wrap items-center justify-between gap-8">
                      <div className="flex flex-wrap gap-6"><Badge tone="wash">Ide awal · perlu dicoba</Badge>{opportunityTypeLabel(item.hypothesis.opportunityType) ? <Badge tone="neutral">{opportunityTypeLabel(item.hypothesis.opportunityType)}</Badge> : null}</div>
                    </div>
                    <h2 className="wrap-anywhere text-label-bold font-w540 text-ink-charcoal sm:text-heading-sm sm:font-w460">{item.hypothesis.title}</h2>
                    <p className="wrap-anywhere max-w-[72ch] text-body leading-relaxed text-ink-charcoal">{item.hypothesis.concept}</p>
                    <PrivateHypothesisContent hypothesis={item.hypothesis} />
                    <details className="border-t border-soft-mist text-caption leading-relaxed text-stone-gray">
                      <summary className="min-h-button cursor-pointer py-12 text-body-sm font-w540 text-ink-charcoal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-violet">Sumber</summary>
                      <div className="grid gap-8 pb-8 wrap-anywhere">
                        <SavedSource item={item} />
                      </div>
                    </details>
                    <div className="flex flex-wrap gap-8 pt-4">
                      {showScoreDetails ? <label className="inline-flex min-h-button items-center gap-8 text-body-sm"><input type="checkbox" className="size-16 accent-midnight-wine focus-visible:outline-2 focus-visible:outline-royal-violet" checked={selectedForCompare.includes(item.id)} disabled={(businessMode && !hasVerifiedBusinessConcept(item.hypothesis.businessAnalysis)) || !(businessMode ? item.hypothesis.businessAnalysis : item.hypothesis.analysis) || (businessMode ? item.hypothesis.businessAnalysis : item.hypothesis.analysis)?.opportunity.score === null || (businessMode ? item.hypothesis.businessAnalysis : item.hypothesis.analysis)?.fit.score === null || (!selectedForCompare.includes(item.id) && selectedForCompare.length >= 3)} onChange={event => updateComparison(event.target.checked ? [...new Set([...selectedForCompare, item.id])].slice(0, 3) : selectedForCompare.filter(id => id !== item.id))} /><span>Bandingkan<span className="sr-only"> {item.hypothesis.title}</span></span></label> : null}
                      {showScoreDetails ? <Link className="inline-flex min-h-button items-center justify-center rounded-buttons bg-midnight-wine px-16 text-body-sm font-w540 text-paper-white hover:bg-midnight-wine/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href={`/opportunities/hypotheses/${item.id}`} prefetch={false}>Lihat Detail Score</Link> : null}
                      {!showScoreDetails || businessMode ? <Button disabled={savingId === item.id || deletingId === item.id} loading={savingId === item.id} onClick={() => void toggleSaved(item)} type="button" variant="secondary">{savingId === item.id ? "Menyimpan..." : item.saved ? "Hapus dari simpanan" : "Simpan hipotesis"}</Button> : null}
                      {showScoreDetails && !businessMode && item.saved ? <span className="inline-flex min-h-button items-center text-body-sm text-stone-gray">Tersimpan permanen</span> : <button aria-label={`Hapus hipotesis: ${item.hypothesis.title}`} className="inline-flex size-[44px] items-center justify-center rounded-small-buttons border border-red-300 text-red-700 transition-colors hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600" disabled={Boolean(deletingId) || savingId === item.id} onClick={() => setDeleteCandidate(item)} title="Hapus hipotesis" type="button"><svg aria-hidden="true" className="size-20" fill="none" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l.8 12h8.4L17 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" /></svg></button>}
                    </div>
                  </article>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {showScoreDetails && (items.length || selectedForCompare.length) ? <div className="flex flex-wrap items-center justify-between gap-12 rounded-cards border border-soft-mist bg-paper-white p-16"><p className="text-body-sm text-stone-gray">Pilih 2–3 peluang yang sudah dianalisis ({selectedForCompare.length}/3).</p>{selectedForCompare.length ? <Button variant="ghost" onClick={() => updateComparison([])}>Kosongkan pilihan</Button> : null}{selectedForCompare.length >= 2 ? <Link className="inline-flex min-h-button items-center rounded-buttons bg-midnight-wine px-16 text-body-sm text-paper-white focus-visible:outline-2 focus-visible:outline-royal-violet" prefetch={false} href={`/opportunities/compare?ids=${selectedForCompare.join(",")}&from=${view === "saved" ? "saved" : "finder"}`}>Lihat perbandingan</Link> : null}</div> : null}
        {pagination ? <PrivatePagination {...pagination} href={view === "saved" ? "/saved" : businessMode && queryKey ? `/opportunities?queryKey=${encodeURIComponent(queryKey)}` : "/opportunities"} /> : null}
        <dialog
          aria-describedby="delete-hypothesis-description"
          aria-labelledby="delete-hypothesis-title"
          aria-modal="true"
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[480px] overflow-y-auto rounded-cards border border-midnight-wine bg-paper-white p-0 text-ink-charcoal shadow-lg backdrop:bg-midnight-wine/50"
          onCancel={(event) => {
            event.preventDefault();
            if (!deletingId) setDeleteCandidate(null);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !deletingId) setDeleteCandidate(null);
          }}
          ref={deleteDialogRef}
          role="alertdialog"
        >
          {deleteCandidate ? (
            <div className="grid gap-20 p-20 sm:p-24">
              <div className="grid gap-8">
                <h2 className="text-heading-sm font-w460 text-ink-charcoal" id="delete-hypothesis-title">Hapus hipotesis?</h2>
                <p className="wrap-anywhere text-body-sm leading-relaxed text-stone-gray" id="delete-hypothesis-description">
                  Hipotesis “{deleteCandidate.hypothesis.title}” akan dihapus dari akun Anda. Tindakan ini tidak bisa dibatalkan.
                </p>
                {deleteCandidate.saved ? (
                  <p className="rounded-small-buttons border border-soft-mist bg-warm-parchment px-12 py-10 text-body-sm text-ink-charcoal">
                    Hipotesis ini juga akan dihapus dari Saved Opportunities.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-8 sm:flex-row sm:justify-end">
                <Button autoFocus disabled={Boolean(deletingId)} onClick={() => setDeleteCandidate(null)} type="button" variant="secondary">Batal</Button>
                <Button disabled={Boolean(deletingId)} loading={Boolean(deletingId)} loadingText="Menghapus..." onClick={() => void confirmDeleteHypothesis()} type="button" variant="primary">
                  Hapus hipotesis
                </Button>
              </div>
            </div>
          ) : null}
        </dialog>
      </div>
    </PageContainer>
  );
}
