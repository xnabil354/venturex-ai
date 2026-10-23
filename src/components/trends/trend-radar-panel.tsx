"use client";

import { useState, type ReactNode } from "react";
import { activateRadarHistory, recordRadarHistory, type RadarHistoryEntry } from "@/trend/trend-radar-history";
import { useRadarHistory } from "./use-radar-history";
import { TrendRadarHistory } from "./trend-radar-history";

import { Badge, Button, Card, StatusNotice } from "@/components/ui";
import {
  getJakartaCurrentYear,
  getJakartaToday,
  trendRadarResponseSchema,
  type TrendRadarPreset,
  type TrendRadarProperty,
  type TrendRadarRequest,
  type TrendRadarResponse,
  type GoogleTrendsGeoOption,
  WORLDWIDE_TREND_GEO,
} from "@/trend/trend-radar-contract";
import { downloadTrendRadarCsv } from "@/trend/trend-radar-csv";
import { trendRadarInterestResponseSchema, type TrendRadarInterestResponse } from "@/trend/trend-radar-interest-contract";
import { TrendRadarInterestVisualizations } from "./trend-radar-interest-visualizations";
import { GoogleTrendsGeographySelect } from "./google-trends-geography-select";

type ErrorEnvelope = {
  readonly success?: false;
  readonly error?: { readonly message?: string };
};

type EndpointPayload = { readonly data: unknown; readonly error?: never } | { readonly data?: never; readonly error: string };

async function requestTrendEndpoint(url: string, request: Record<string, unknown>): Promise<EndpointPayload> {
  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { error: "Respons Trend Radar tidak dapat dibaca." };
    }
    const envelope = payload as ErrorEnvelope & { readonly success?: boolean; readonly data?: unknown };
    if (!response.ok || envelope.success === false) return { error: envelope.error?.message ?? "Trend Radar sementara tidak tersedia." };
    if (envelope.success !== true || envelope.data === undefined) return { error: "Respons Trend Radar tidak memenuhi format yang diharapkan." };
    return { data: envelope.data };
  } catch {
    return { error: "Koneksi ke Trend Radar gagal. Coba lagi saat layanan tersedia." };
  }
}

const presetOptions: readonly { readonly value: TrendRadarPreset; readonly label: string }[] = [
  { value: "1h", label: "1 jam terakhir" },
  { value: "4h", label: "4 jam terakhir" },
  { value: "24h", label: "24 jam terakhir" },
  { value: "7d", label: "7 hari terakhir" },
  { value: "1m", label: "1 bulan terakhir" },
  { value: "3m", label: "3 bulan terakhir" },
  { value: "1y", label: "1 tahun terakhir" },
  { value: "5y", label: "5 tahun terakhir" },
  { value: "all", label: "Semua data tersedia" },
];

const propertyOptions: readonly { readonly value: TrendRadarProperty; readonly label: string }[] = [
  { value: "web", label: "Penelusuran web" },
  { value: "images", label: "Penelusuran gambar" },
  { value: "news", label: "Penelusuran berita" },
  { value: "shopping", label: "Google Shopping" },
  { value: "youtube", label: "Penelusuran YouTube" },
];





const tablePageSize = 10;

function pageRows<T>(rows: readonly T[], currentPage: number): readonly T[] {
  const start = (currentPage - 1) * tablePageSize;
  return rows.slice(start, start + tablePageSize);
}

function TablePagination({
  currentPage,
  onPageChange,
  tableName,
  totalRows,
}: {
  readonly currentPage: number;
  readonly onPageChange: (page: number) => void;
  readonly tableName: string;
  readonly totalRows: number;
}) {
  if (totalRows === 0) return null;

  const pageCount = Math.ceil(totalRows / tablePageSize);
  const firstRow = (currentPage - 1) * tablePageSize + 1;
  const lastRow = Math.min(currentPage * tablePageSize, totalRows);
  const buttonClass = "inline-flex size-[44px] items-center justify-center rounded-small-buttons border border-soft-mist text-black transition-colors hover:bg-warm-parchment disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet";

  return (
    <div className="flex flex-wrap items-center justify-between gap-8">
      <span aria-live="polite" className="text-caption text-black">
        Menampilkan {firstRow}–{lastRow} dari {totalRows} kueri
      </span>
      <div aria-label={`Navigasi halaman ${tableName}`} className="flex items-center gap-6" role="group">
        <button
          aria-label={`Halaman sebelumnya untuk ${tableName}`}
          className={buttonClass}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <svg aria-hidden="true" className="size-18" fill="none" viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </button>
        <button
          aria-label={`Halaman berikutnya untuk ${tableName}`}
          className={buttonClass}
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          <svg aria-hidden="true" className="size-18" fill="none" viewBox="0 0 24 24">
            <path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function TopQueriesTable({
  currentPage,
  data,
  onPageChange,
}: {
  readonly currentPage: number;
  readonly data: TrendRadarResponse["top"];
  readonly onPageChange: (page: number) => void;
}) {
  const visibleRows = pageRows(data, currentPage);

  return (
    <>
      <div aria-label="Tabel kueri terpopuler, dapat digulir mendatar" className="overflow-x-auto rounded-small-buttons border border-soft-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" role="region" tabIndex={0}>
        <table aria-label="Kueri terpopuler" className="w-full min-w-[400px] table-fixed border-collapse text-left text-body-sm">
          <colgroup>
            <col className="w-[56px]" />
            <col />
            <col className="w-[96px]" />
            <col className="w-[112px]" />
          </colgroup>
          <thead className="bg-warm-parchment text-caption font-w540 text-black">
            <tr>
              <th className="px-10 py-10" scope="col">Posisi</th>
              <th className="px-10 py-10" scope="col">Kueri</th>
              <th className="px-10 py-10" scope="col">Indeks minat</th>
              <th className="px-10 py-10" scope="col">Sumber</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-soft-mist">
            {data.length === 0 ? (
              <tr><td className="px-10 py-16 text-stone-gray" colSpan={4}>Belum ada kueri teratas untuk filter ini. Data Google Trends mungkin belum cukup. Coba rentang waktu lebih panjang atau wilayah lebih luas.</td></tr>
            ) : visibleRows.map((row) => (
              <tr key={row.position + "-" + row.query}>
                <td className="whitespace-nowrap px-10 py-10 align-top text-black">{row.position}</td>
                <td className="break-words px-10 py-10 align-top font-w540 text-black">{row.query}</td>
                <td className="break-words px-10 py-10 align-top text-black">{row.interestIndex ?? "Tidak tersedia"}</td>
                <td className="px-10 py-10 align-top">
                  {row.sourceUrl ? <a className="whitespace-nowrap text-royal-violet underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href={row.sourceUrl} rel="noreferrer" target="_blank">Google Trends</a> : <span className="text-stone-gray">Tidak tersedia</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination currentPage={currentPage} onPageChange={onPageChange} tableName="Kueri Terpopuler" totalRows={data.length} />
    </>
  );
}

function RisingQueriesTable({
  currentPage,
  data,
  onPageChange,
}: {
  readonly currentPage: number;
  readonly data: TrendRadarResponse["rising"];
  readonly onPageChange: (page: number) => void;
}) {
  const visibleRows = pageRows(data, currentPage);

  return (
    <>
      <div aria-label="Tabel kueri yang makin populer, dapat digulir mendatar" className="overflow-x-auto rounded-small-buttons border border-soft-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" role="region" tabIndex={0}>
        <table aria-label="Kueri yang makin populer" className="w-full min-w-[400px] table-fixed border-collapse text-left text-body-sm">
          <colgroup>
            <col className="w-[56px]" />
            <col />
            <col className="w-[96px]" />
            <col className="w-[112px]" />
          </colgroup>
          <thead className="bg-warm-parchment text-caption font-w540 text-black">
            <tr>
              <th className="px-10 py-10" scope="col">Posisi</th>
              <th className="px-10 py-10" scope="col">Kueri</th>
              <th className="px-10 py-10" scope="col">Pertumbuhan</th>
              <th className="px-10 py-10" scope="col">Sumber</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-soft-mist">
            {data.length === 0 ? (
              <tr><td className="px-10 py-16 text-stone-gray" colSpan={4}>Belum ada kueri meningkat untuk filter ini. Data Google Trends mungkin belum cukup. Coba rentang waktu lebih panjang atau wilayah lebih luas.</td></tr>
            ) : visibleRows.map((row) => (
              <tr key={row.position + "-" + row.query}>
                <td className="whitespace-nowrap px-10 py-10 align-top text-black">{row.position}</td>
                <td className="break-words px-10 py-10 align-top font-w540 text-black">{row.query}</td>
                <td className="break-words px-10 py-10 align-top text-black">
                  {row.isBreakout ? "Breakout" : row.growthLabel ?? (row.growthPercent === null || row.growthPercent === undefined ? "Tidak tersedia" : String(row.growthPercent) + "%")}
                </td>
                <td className="px-10 py-10 align-top">
                  {row.sourceUrl ? <a className="whitespace-nowrap text-royal-violet underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href={row.sourceUrl} rel="noreferrer" target="_blank">Google Trends</a> : <span className="text-stone-gray">Tidak tersedia</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination currentPage={currentPage} onPageChange={onPageChange} tableName="Kueri yang Makin Populer" totalRows={data.length} />
    </>
  );
}

type TrendRadarPanelProps = {
  readonly productQuery: string;
  readonly queryKey?: string;
  readonly viewerId?: string;
  readonly currentYear?: number;
  readonly today?: string;
};

export function TrendRadarPanel(props: TrendRadarPanelProps) {
  const history = useRadarHistory(props.viewerId);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = history?.entries.find(entry => entry.id === (selectedId ?? history.activeId)) ?? history?.entries[0];
  const active = props.queryKey && !selectedId && selected?.result.productQuery !== props.productQuery ? undefined : selected;
  return <TrendRadarSession {...props} key={`${props.viewerId ?? "guest"}:${active?.id ?? "new"}`} initialEntry={active ?? null} historySlot={history?.entries.length ? <TrendRadarHistory history={history} {...(active ? { selectedId: active.id } : {})} onOpen={id => {
    setSelectedId(id);
    if (props.viewerId) activateRadarHistory(props.viewerId, id);
  }} /> : null} onRecorded={setSelectedId} />;
}

function TrendRadarSession({
  productQuery,
  queryKey,
  viewerId,
  currentYear = getJakartaCurrentYear(),
  today = getJakartaToday(),
  initialEntry,
  historySlot,
  onRecorded,
}: TrendRadarPanelProps & {
  readonly initialEntry: RadarHistoryEntry | null;
  readonly historySlot: ReactNode;
  readonly onRecorded: (id: string) => void;
}) {
  const [period, setPeriod] = useState<TrendRadarRequest["period"]>(initialEntry?.request?.period ?? "24h");
  const [property, setProperty] = useState<TrendRadarProperty>(initialEntry?.result.appliedFilters.property ?? "web");
  const [geography, setGeography] = useState<GoogleTrendsGeoOption | null>(initialEntry ? { geo: initialEntry.result.appliedFilters.geo, label: initialEntry.geographyLabel } : WORLDWIDE_TREND_GEO);
  const [selectedYear, setSelectedYear] = useState(initialEntry?.request?.year ?? currentYear);
  const [startDate, setStartDate] = useState(initialEntry?.request?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialEntry?.request?.endDate ?? "");
  const [startDateTime, setStartDateTime] = useState(initialEntry?.request?.startDateTime ? `${initialEntry.request.startDateTime}:00` : "");
  const [endDateTime, setEndDateTime] = useState(initialEntry?.request?.endDateTime ? `${initialEntry.request.endDateTime}:00` : "");
  const [loading, setLoading] = useState(false);
  const [retryingRegional, setRetryingRegional] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrendRadarResponse | null>(initialEntry?.result ?? null);
  const [interestResult, setInterestResult] = useState<TrendRadarInterestResponse | null>(initialEntry?.interest ?? null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [regionalRetryError, setRegionalRetryError] = useState<string | null>(null);
  const [topPage, setTopPage] = useState(1);
  const [risingPage, setRisingPage] = useState(1);

  function clearResults(): void {
    setResult(null);
    setInterestResult(null);
    setError(null);
    setInterestError(null);
    setRegionalRetryError(null);
  }

  async function loadCurrentTrend(): Promise<void> {
    if (loading || retryingRegional || !productQuery.trim() || !geography) return;
    const request: Record<string, unknown> = { period, property, geo: geography.geo, ...(queryKey ? { queryKey } : {}) };
    if (period === "year") request.year = selectedYear;
    if (period === "custom-date") {
      request.startDate = startDate;
      request.endDate = endDate;
    }
    if (period === "custom-hour") {
      request.startDateTime = startDateTime.slice(0, 13);
      request.endDateTime = endDateTime.slice(0, 13);
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setInterestResult(null);
    setInterestError(null);
    setRegionalRetryError(null);
    try {
      const [relatedPayload, interestPayload] = await Promise.all([
        requestTrendEndpoint("/api/v1/trend-radar/related-queries", request),
        requestTrendEndpoint("/api/v1/trend-radar/interest", request),
      ]);
      const parsedRelated = relatedPayload.data === undefined ? null : trendRadarResponseSchema.safeParse(relatedPayload.data);
      const parsedInterest = interestPayload.data === undefined ? null : trendRadarInterestResponseSchema.safeParse(interestPayload.data);
      const expectedPeriod = period === "year" ? String(selectedYear) : period;
      if ((parsedRelated?.success && (
        parsedRelated.data.appliedFilters.period !== expectedPeriod
        || parsedRelated.data.appliedFilters.property !== property
        || parsedRelated.data.appliedFilters.geo !== geography.geo
      )) || (parsedInterest?.success && (
        parsedInterest.data.appliedFilters.period !== expectedPeriod
        || parsedInterest.data.appliedFilters.property !== property
        || parsedInterest.data.appliedFilters.geo !== geography.geo
      ))) {
        setError("Respons Trend Radar tidak sesuai dengan filter terpilih. Muat ulang sebelum menggunakan hasil ini.");
        setInterestError("Filter hasil tidak sesuai dengan pilihan saat ini.");
        return;
      }
      if (parsedRelated?.success && parsedInterest?.success && (
        parsedRelated.data.productQuery !== parsedInterest.data.productQuery
        || JSON.stringify(parsedRelated.data.appliedFilters) !== JSON.stringify(parsedInterest.data.appliedFilters)
      )) {
        setError("Konteks kueri atau filter berubah selama pemuatan. Muat ulang Trend Radar agar semua bagian menggunakan konteks yang sama.");
        setInterestError("Konteks data tidak konsisten; hasil minat disembunyikan demi menjaga kesesuaian filter.");
        return;
      }
      if (relatedPayload.error) setError(relatedPayload.error);
      else if (parsedRelated?.success) {
        setResult(parsedRelated.data);
        if (viewerId) {
          const saved = recordRadarHistory(viewerId, parsedRelated.data, parsedInterest?.success ? parsedInterest.data : null, request as TrendRadarRequest, geography.label);
          setStorageWarning(!saved);
          if (saved) onRecorded(parsedRelated.data.requestId);
        }
      }
      else setError("Data tren tidak dapat ditampilkan. Coba lagi.");
      if (interestPayload.error) setInterestError(interestPayload.error);
      else if (parsedInterest?.success) setInterestResult(parsedInterest.data);
      else setInterestError("Respons minat Trend Radar tidak memenuhi format yang diharapkan.");
      setTopPage(1);
      setRisingPage(1);
    } finally {
      setLoading(false);
    }
  }

  async function retryRegionalData(): Promise<void> {
    if (loading || retryingRegional || !result || !interestResult || !geography) return;
    const request: Record<string, unknown> = { period, property, geo: geography.geo, ...(queryKey ? { queryKey } : {}) };
    if (period === "year") request.year = selectedYear;
    if (period === "custom-date") {
      request.startDate = startDate;
      request.endDate = endDate;
    }
    if (period === "custom-hour") {
      request.startDateTime = startDateTime.slice(0, 13);
      request.endDateTime = endDateTime.slice(0, 13);
    }

    setRetryingRegional(true);
    setRegionalRetryError(null);
    try {
      const payload = await requestTrendEndpoint("/api/v1/trend-radar/interest", request);
      if (payload.error) {
        setRegionalRetryError(payload.error);
        return;
      }
      const parsed = payload.data === undefined ? null : trendRadarInterestResponseSchema.safeParse(payload.data);
      if (!parsed?.success) {
        setRegionalRetryError("Respons data wilayah tidak sesuai format. Coba lagi sebentar.");
        return;
      }
      const expectedPeriod = period === "year" ? String(selectedYear) : period;
      if (
        parsed.data.productQuery !== result.productQuery
        || parsed.data.appliedFilters.period !== expectedPeriod
        || parsed.data.appliedFilters.property !== property
        || parsed.data.appliedFilters.geo !== geography.geo
        || parsed.data.appliedFilters.time !== result.appliedFilters.time
      ) {
        setRegionalRetryError("Data wilayah tidak cocok dengan hasil tren ini. Muat ulang Trend Radar.");
        return;
      }
      setInterestResult(parsed.data);
      if (viewerId) {
        const saved = recordRadarHistory(viewerId, result, parsed.data, request as TrendRadarRequest, geography.label, initialEntry?.recordedAt ?? result.retrievedAt);
        setStorageWarning(!saved);
      }
    } finally {
      setRetryingRegional(false);
    }
  }

  const controlClass = "min-h-[44px] w-full rounded-small-buttons border border-soft-mist bg-paper-white px-12 text-body-sm font-w460 text-ink-charcoal focus:border-royal-violet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet";
  const years = Array.from({ length: Math.max(0, currentYear - 2004 + 1) }, (_, index) => currentYear - index);

  return (
    <section aria-label="Panel Trend Radar" className="grid gap-16">
      <Card className="mx-auto grid w-full max-w-[1120px] gap-16 border-soft-mist bg-paper-white p-16 sm:grid-cols-2 sm:p-20">
        <div className="sm:col-span-2">
          <div className="grid gap-6 rounded-small-buttons border border-soft-mist/70 bg-warm-parchment/60 px-12 py-10 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
            <span className="text-body-sm font-w540 text-ink-charcoal">Produk usaha dari profil</span>
            <output aria-label="Produk usaha dari profil" className="min-w-0 break-words text-body-sm text-ink-charcoal">
              {productQuery || "Produk usaha belum tersedia. Lengkapi profil untuk menggunakan Trend Radar."}
            </output>
          </div>
          <p className="mt-6 text-caption text-stone-gray">Produk usaha dibaca dari profil akun dan tidak dapat diubah di Trend Radar.</p>
        </div>

        <div className="grid gap-12 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid min-w-0 gap-6 text-body-sm font-w540 text-ink-charcoal">
            Rentang waktu
            <select className={controlClass} disabled={loading || retryingRegional} onChange={(event) => { setPeriod(event.target.value as TrendRadarRequest["period"]); clearResults(); }} value={period}>
              {presetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              <option value="year">Tahun tertentu</option>
              <option value="custom-date">Rentang tanggal khusus</option>
              <option value="custom-hour">Rentang jam khusus</option>
            </select>
          </label>

          <label className="grid min-w-0 gap-6 text-body-sm font-w540 text-ink-charcoal">
            Properti penelusuran
            <select className={controlClass} disabled={loading || retryingRegional} onChange={(event) => { setProperty(event.target.value as TrendRadarProperty); clearResults(); }} value={property}>
              {propertyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <GoogleTrendsGeographySelect
            disabled={loading || retryingRegional}
            id="trend-radar-geography"
            onChange={(value) => { setGeography(value); clearResults(); }}
            value={geography}
          />
        </div>

        {period === "year" ? (
          <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal sm:col-span-2">
            Tahun
            <select className={controlClass} disabled={loading || retryingRegional} onChange={(event) => { setSelectedYear(Number(event.target.value)); clearResults(); }} value={selectedYear}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
        ) : null}

        {period === "custom-date" ? (
          <div className="grid gap-12 sm:col-span-2 sm:grid-cols-2">
            <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal">
              Tanggal mulai
              <input className={controlClass} disabled={loading || retryingRegional} max={today} onChange={(event) => { setStartDate(event.target.value); clearResults(); }} type="date" value={startDate} />
            </label>
            <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal">
              Tanggal akhir
              <input className={controlClass} disabled={loading || retryingRegional} max={today} onChange={(event) => { setEndDate(event.target.value); clearResults(); }} type="date" value={endDate} />
            </label>
          </div>
        ) : null}

        {period === "custom-hour" ? (
          <div className="grid gap-12 sm:col-span-2 sm:grid-cols-2">
            <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal">
              Jam mulai · Asia/Jakarta
              <input className={controlClass} disabled={loading || retryingRegional} max={today + "T23:00"} onChange={(event) => { setStartDateTime(event.target.value); clearResults(); }} step={3_600} type="datetime-local" value={startDateTime} />
            </label>
            <label className="grid gap-6 text-body-sm font-w540 text-ink-charcoal">
              Jam akhir · Asia/Jakarta
              <input className={controlClass} disabled={loading || retryingRegional} max={today + "T23:00"} onChange={(event) => { setEndDateTime(event.target.value); clearResults(); }} step={3_600} type="datetime-local" value={endDateTime} />
            </label>
            <p className="text-caption leading-body-sm text-stone-gray sm:col-span-2">Pilih rentang waktu dalam tujuh hari terakhir.</p>
          </div>
        ) : null}

        <div className="grid gap-8 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <p className="text-caption leading-body-sm text-stone-gray">
            Data dimuat saat Anda menekan tombol. Indeks minat bukan jumlah pencarian.
          </p>
          <Button className="w-full sm:w-auto sm:min-w-[180px]" disabled={loading || retryingRegional || !productQuery.trim() || !geography} onClick={() => void loadCurrentTrend()} type="button" variant="primary">
            {loading ? "Memuat tren..." : "Tren Saat Ini"}
          </Button>
        </div>
      </Card>

      {historySlot ? <fieldset className="min-w-0" disabled={loading || retryingRegional}>{historySlot}</fieldset> : null}
      {storageWarning ? <StatusNotice role="status" tone="info">Hasil sudah dimuat, tetapi riwayat belum dapat disimpan di browser ini.</StatusNotice> : null}

      {loading ? (
        <div className="mx-auto w-full max-w-[1120px]">
          <StatusNotice aria-live="polite" role="status" tone="info">Memuat kueri terkait...</StatusNotice>
        </div>
      ) : null}
      {error ? (
        <div className="mx-auto w-full max-w-[1120px]">
          <StatusNotice aria-live="polite" role="alert" tone="error">{error}</StatusNotice>
        </div>
      ) : null}
      {interestError ? (
        <div className="mx-auto w-full max-w-[1120px]">
          <StatusNotice aria-live="polite" role="alert" tone="error">Data minat seiring waktu dan wilayah: {interestError}</StatusNotice>
        </div>
      ) : null}
      {!result && !interestResult && !loading && !error && !interestError ? (
        <div className="mx-auto w-full max-w-[1120px]">
          <StatusNotice tone="info">Atur wilayah dan filter, lalu pilih “Tren Saat Ini”.</StatusNotice>
        </div>
      ) : null}

      {result ? (
        <div aria-live="polite" className="mx-auto grid w-full max-w-[1120px] gap-16">
          <Card className="grid gap-8 border-deep-lagoon/25 bg-deep-lagoon/5 p-16 sm:p-20">
            <div className="flex flex-wrap items-center gap-8">
              <Badge tone="wash">Google Trends</Badge>
            </div>
            <p className="text-caption leading-body-sm text-stone-gray">
              Filter: {result.appliedFilters.period} · {result.appliedFilters.time} · {propertyOptions.find((option) => option.value === result.appliedFilters.property)?.label} · {geography?.label ?? "Wilayah"}.
            </p>
            {result.omittedInvalidRows.top + result.omittedInvalidRows.rising > 0 ? (
              <p className="text-caption text-stone-gray">Sebagian kueri tidak ditampilkan.</p>
            ) : null}
          </Card>

          <div className="grid min-w-0 gap-16 lg:grid-cols-2">
            <Card className="grid min-w-0 content-start gap-14 border-soft-mist bg-paper-white p-16 sm:p-20">
              <div className="flex flex-wrap items-start justify-between gap-10">
                <div className="min-w-0 flex-1">
                  <h2 className="text-heading-sm font-w460 text-black">Kueri Terpopuler</h2>
                  <p className="mt-6 text-caption leading-body-sm text-stone-gray">Kueri terkait yang ditampilkan oleh Google Trends untuk konteks terpilih.</p>
                </div>
                <Button
                  aria-label={`Unduh semua ${result.top.length} kueri terpopuler sebagai CSV`}
                  className="w-full px-10 text-body-sm sm:w-auto"
                  disabled={result.top.length === 0}
                  onClick={() => downloadTrendRadarCsv(result, "top")}
                  type="button"
                  variant="secondary"
                >
                  Unduh CSV ({result.top.length})
                </Button>
              </div>
              <TopQueriesTable currentPage={topPage} data={result.top} onPageChange={setTopPage} />
            </Card>

            <Card className="grid min-w-0 content-start gap-14 border-soft-mist bg-paper-white p-16 sm:p-20">
              <div className="flex flex-wrap items-start justify-between gap-10">
                <div className="min-w-0 flex-1">
                  <h2 className="text-heading-sm font-w460 text-black">Kueri yang Makin Populer</h2>
                  <p className="mt-6 text-caption leading-body-sm text-stone-gray">Label pertumbuhan mengikuti nilai yang disediakan sumber; Breakout tidak dikonversi menjadi persentase.</p>
                </div>
                <Button
                  aria-label={`Unduh semua ${result.rising.length} kueri yang makin populer sebagai CSV`}
                  className="w-full px-10 text-body-sm sm:w-auto"
                  disabled={result.rising.length === 0}
                  onClick={() => downloadTrendRadarCsv(result, "rising")}
                  type="button"
                  variant="secondary"
                >
                  Unduh CSV ({result.rising.length})
                </Button>
              </div>
              <RisingQueriesTable currentPage={risingPage} data={result.rising} onPageChange={setRisingPage} />
            </Card>
          </div>

          <p className="text-caption leading-body-sm text-stone-gray">
            Sumber: <a className="text-royal-violet underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="https://trends.google.com/trends/" rel="noreferrer" target="_blank">Google Trends</a>.
          </p>
        </div>
      ) : null}

      {interestResult ? (
        <div className="mx-auto w-full max-w-[1120px]">
          <Card className="mb-16 grid gap-8 border-deep-lagoon/25 bg-deep-lagoon/5 p-16 sm:p-20">
            <div className="flex flex-wrap items-center gap-8">
              <Badge tone="wash">Google Trends</Badge>
              <span className="text-caption text-stone-gray">Produk usaha: {interestResult.productQuery}</span>
            </div>
            <p className="text-caption leading-body-sm text-stone-gray">
              Filter: {interestResult.appliedFilters.period} · {interestResult.appliedFilters.time} · {propertyOptions.find((option) => option.value === interestResult.appliedFilters.property)?.label} · {geography?.label ?? "Wilayah"}.
            </p>
          </Card>
          <TrendRadarInterestVisualizations geoLabel={geography?.label ?? "Wilayah"} onRetryRegional={() => void retryRegionalData()} regionalRetryError={regionalRetryError} response={interestResult} retryingRegional={retryingRegional} />
        </div>
      ) : null}
    </section>
  );
}
