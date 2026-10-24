"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Card, StatusNotice } from "@/components/ui";
import { mapSearchApiRegionToBoundaryCode } from "@/trend/indonesia-region-boundaries";
import type { TrendRadarInterestResponse, TrendTimePoint, TrendTimeSeries } from "@/trend/trend-radar-interest-contract";
import { timeSeriesAverage, trendInterestColor } from "@/trend/trend-radar-visualization";

type Geometry = {
  readonly type: "Polygon" | "MultiPolygon";
  readonly coordinates: readonly unknown[];
};
type BoundaryFeature = {
  readonly type: "Feature";
  readonly properties: { readonly shapeName?: unknown; readonly shapeISO?: unknown };
  readonly geometry: Geometry;
};
type BoundaryCollection = { readonly type: "FeatureCollection"; readonly features: readonly BoundaryFeature[] };
const emptyTimePoints: readonly TrendTimePoint[] = [];

function isPosition(value: unknown): value is readonly [number, number] {
  return Array.isArray(value) && typeof value[0] === "number" && Number.isFinite(value[0])
    && typeof value[1] === "number" && Number.isFinite(value[1]);
}

function walkPositions(value: unknown, callback: (position: readonly [number, number]) => void): void {
  if (isPosition(value)) {
    callback(value);
    return;
  }
  if (Array.isArray(value)) for (const child of value) walkPositions(child, callback);
}

function validBoundaries(value: unknown): BoundaryCollection | null {
  if (typeof value !== "object" || value === null) return null;
  const collection = value as { type?: unknown; features?: unknown };
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) return null;
  const features: BoundaryFeature[] = [];
  for (const candidate of collection.features) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const feature = candidate as Record<string, unknown>;
    const properties = feature.properties as Record<string, unknown> | null;
    const geometry = feature.geometry as Record<string, unknown> | null;
    if (feature.type !== "Feature" || !properties || !geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) continue;
    if (typeof properties.shapeISO !== "string" || typeof properties.shapeName !== "string") continue;
    let positions = 0;
    walkPositions(geometry.coordinates, () => { positions += 1; });
    if (!positions) continue;
    features.push({
      type: "Feature",
      properties: { shapeISO: properties.shapeISO, shapeName: properties.shapeName },
      geometry: geometry as Geometry,
    });
  }
  return features.length ? { type: "FeatureCollection", features } : null;
}

function coordinatesOf(feature: BoundaryFeature): readonly (readonly [number, number])[] {
  const positions: Array<readonly [number, number]> = [];
  walkPositions(feature.geometry.coordinates, (position) => positions.push(position));
  return positions;
}

type ProjectedMap = {
  readonly features: readonly { readonly code: string; readonly name: string; readonly path: string }[];
  readonly viewBox: string;
};

function projectMap(collection: BoundaryCollection): ProjectedMap {
  const sourceFeatures = collection.features.flatMap((feature) => {
    const code = String(feature.properties.shapeISO);
    const positions = coordinatesOf(feature);
    return mapSearchApiRegionToBoundaryCode(code) && positions.length
      ? [{ feature, code, positions }]
      : [];
  });
  const all = sourceFeatures.flatMap((item) => item.positions);
  if (!all.length) return { features: [], viewBox: "0 0 1000 450" };
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (const [longitude, latitude] of all) {
    minLon = Math.min(minLon, longitude);
    maxLon = Math.max(maxLon, longitude);
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
  }
  const meanLat = (minLat + maxLat) / 2;
  const cosLat = Math.cos(meanLat * Math.PI / 180);
  const rawWidth = (maxLon - minLon) * cosLat;
  const rawHeight = maxLat - minLat;
  const scale = Math.min(960 / rawWidth, 410 / rawHeight);
  const offsetX = (1000 - rawWidth * scale) / 2;
  const offsetY = (450 - rawHeight * scale) / 2;
  const project = (point: readonly [number, number]) => [
    offsetX + (point[0] - minLon) * cosLat * scale,
    offsetY + (maxLat - point[1]) * scale,
  ] as const;

  const features = sourceFeatures.map(({ feature, code }) => {
    const pathSegments: string[] = [];
    const ringPath = (ring: unknown) => {
      if (!Array.isArray(ring) || ring.length < 3 || !ring.every(isPosition)) return "";
      const projected = ring.map(project);
      return "M" + projected.map((point) => point[0].toFixed(2) + " " + point[1].toFixed(2)).join("L") + "Z";
    };
    const addRings = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (value.length > 0 && value.every(isPosition)) {
        const path = ringPath(value);
        if (path) pathSegments.push(path);
        return;
      }
      for (const child of value) addRings(child);
    };
    addRings(feature.geometry.coordinates);
    return { code, name: String(feature.properties.shapeName), path: pathSegments.join("") };
  }).filter((feature) => feature.path.length > 0);
  return { features, viewBox: "0 0 1000 450" };
}

function localDateLabel(timestamp: number, range: number): string {
  const date = new Date(timestamp * 1_000);
  const format: Intl.DateTimeFormatOptions = range < 2 * 24 * 60 * 60
    ? { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }
    : range < 180 * 24 * 60 * 60
      ? { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }
      : { timeZone: "Asia/Jakarta", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat("id-ID", format).format(date);
}

function localDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1_000));
}

function interestSubtitle(response: TrendRadarInterestResponse, geoLabel: string): string {
  const propertyLabels: Record<TrendRadarInterestResponse["appliedFilters"]["property"], string> = {
    web: "Penelusuran web",
    images: "Penelusuran gambar",
    news: "Penelusuran berita",
    shopping: "Google Shopping",
    youtube: "Penelusuran YouTube",
  };
  return `${geoLabel} · ${response.appliedFilters.period} · ${propertyLabels[response.appliedFilters.property]}`;
}

function ChartSection({ geoLabel, response }: { readonly geoLabel: string; readonly response: TrendRadarInterestResponse }) {
  const [selected, setSelected] = useState(0);
  const [chartWidth, setChartWidth] = useState(760);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const data = response.timeSeries;
  const points = data?.points ?? emptyTimePoints;

  useEffect(() => {
    const updateWidth = () => setChartWidth(Math.max(240, Math.min(960, window.innerWidth - 72)));
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const chart = useMemo(() => {
    const valid = points.filter((point) => point.interestIndex !== null);
    if (!valid.length) return null;
    const minTime = points[0]?.timestamp ?? valid[0]!.timestamp;
    const maxTime = points.at(-1)?.timestamp ?? valid.at(-1)!.timestamp;
    const range = Math.max(1, maxTime - minTime);
    const left = 52;
    const right = chartWidth - 16;
    const top = 14;
    const bottom = 236;
    const coordinates = points.map((point) => ({
      point,
      x: left + (point.timestamp - minTime) / range * (right - left),
      y: point.interestIndex === null ? null : bottom - point.interestIndex / 100 * (bottom - top),
    }));
    const segments: string[] = [];
    let active: string[] = [];
    for (const coordinate of coordinates) {
      if (coordinate.y === null) {
        if (active.length) segments.push(active.join(" "));
        active = [];
      } else active.push((active.length ? "L" : "M") + coordinate.x.toFixed(2) + " " + coordinate.y.toFixed(2));
    }
    if (active.length) segments.push(active.join(" "));
    return { coordinates, path: segments.join(" "), minTime, maxTime, range, left, right, top, bottom };
  }, [points, chartWidth]);

  const average = data ? timeSeriesAverage(data) : null;
  const activeIndex = hoverIndex ?? selected;
  const active = points[activeIndex] ?? null;
  const activeCoordinate = chart?.coordinates[activeIndex];

  function handleKeyDown(event: React.KeyboardEvent<SVGSVGElement>) {
    if (!points.length) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "Home" || event.key === "End") event.preventDefault();
    if (event.key === "ArrowRight") setSelected((index) => Math.min(points.length - 1, index + 1));
    if (event.key === "ArrowLeft") setSelected((index) => Math.max(0, index - 1));
    if (event.key === "Home") setSelected(0);
    if (event.key === "End") setSelected(points.length - 1);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!chart || !points.length) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * chartWidth;
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (const [index, coordinate] of chart.coordinates.entries()) {
      const candidate = Math.abs(coordinate.x - x);
      if (candidate < distance) { nearest = index; distance = candidate; }
    }
    setHoverIndex(nearest);
  }

  return (
    <Card className="grid min-w-0 gap-14 border-soft-mist bg-paper-white p-16 sm:p-20">
      <div>
        <h2 className="text-label-bold font-w540 text-ink-charcoal sm:text-heading-sm sm:font-w460">Minat Seiring Waktu</h2>
        <p className="mt-6 text-caption leading-body-sm text-stone-gray">{interestSubtitle(response, geoLabel)} · Indeks relatif 0–100 untuk {response.productQuery}.</p>
      </div>
      {response.availability.timeSeries === "failed" ? (
        <StatusNotice role="status" tone="error">{response.datasets.timeSeries.error?.message ?? "Data minat seiring waktu belum dapat dimuat."}</StatusNotice>
      ) : response.availability.timeSeries === "empty" || !data || points.length === 0 ? (
        <StatusNotice role="status" tone="info">Belum ada data minat seiring waktu untuk filter ini. Data Google Trends mungkin belum cukup. Coba rentang waktu lebih panjang atau wilayah lebih luas.</StatusNotice>
      ) : !chart ? (
        <StatusNotice role="status" tone="info">Nilai minat tidak tersedia pada pengamatan yang diterima.</StatusNotice>
      ) : (
        <div className="grid gap-8">
          <p className="flex flex-wrap items-center gap-x-14 gap-y-4 text-caption text-stone-gray">
            <span>{average?.basis === "SOURCE" ? "Rata-rata sumber" : "Rata-rata pengamatan"}: {average?.value == null ? "Tidak tersedia" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(average.value)}</span>
            <span>{average?.validCount ?? 0} pengamatan valid</span>
          </p>
          <svg
            aria-label={`Grafik minat penelusuran untuk ${data.query}; sumbu indeks 0 sampai 100. Gunakan tombol panah untuk menelusuri pengamatan.`}
            className="h-auto w-full touch-pan-y overflow-visible focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-violet"
            onKeyDown={handleKeyDown}
            onPointerLeave={() => setHoverIndex(null)}
            onPointerMove={handlePointerMove}
            role="img"
            tabIndex={0}
            viewBox={`0 0 ${chartWidth} 280`}
          >
            {[0, 50, 100].map((tick) => {
              const y = chart.bottom - tick / 100 * (chart.bottom - chart.top);
              return <g aria-hidden="true" key={tick}><line stroke="#ded9d3" strokeDasharray={tick === 0 ? undefined : "3 5"} x1={chart.left} x2={chart.right} y1={y} y2={y} /><text fill="#66615e" fontSize="12" textAnchor="end" x="42" y={y + 4}>{tick}</text></g>;
            })}
            <path d={chart.path} fill="none" stroke="#5c1e31" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
            {activeCoordinate?.y !== null && activeCoordinate?.y !== undefined ? <circle cx={activeCoordinate.x} cy={activeCoordinate.y} fill="#5c1e31" r="5" stroke="white" strokeWidth="2" /> : null}
            <text fill="#66615e" fontSize="12" textAnchor="start" x={chart.left} y="266">{localDateLabel(chart.minTime, chart.range)}</text>
            <text fill="#66615e" fontSize="12" textAnchor="end" x={chart.right} y="266">{localDateLabel(chart.maxTime, chart.range)}</text>
          </svg>
          <p aria-live="polite" className="min-h-20 text-body-sm text-ink-charcoal">
            {active ? `${localDateTime(active.timestamp)} WIB · Indeks ${active.interestIndex ?? "Tidak tersedia"} · Label sumber: ${active.label}` : "Pilih pengamatan pada grafik."}
          </p>
          <p className="text-caption leading-body-sm text-stone-gray">
            Sumber: <a className="text-royal-violet underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="https://trends.google.com/trends/" rel="noreferrer" target="_blank">Google Trends</a>.
            {data.omittedInvalidPoints ? ` ${data.omittedInvalidPoints} titik tidak valid diabaikan.` : ""}
          </p>
        </div>
      )}
    </Card>
  );
}

function regionColor(index: number | null): string {
  return trendInterestColor(index);
}

function RegionalSection({ geoLabel, response, onRetry, retrying, retryError }: {
  readonly geoLabel: string;
  readonly response: TrendRadarInterestResponse;
  readonly onRetry?: () => void;
  readonly retrying: boolean;
  readonly retryError: string | null;
}) {
  const [boundaries, setBoundaries] = useState<ProjectedMap | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const rows = response.regionalInterest?.regions ?? [];
  const showIndonesiaMap = response.appliedFilters.geo === "ID";
  const visibleRows = rows.slice((page - 1) * 10, page * 10);
  const regionMap = new Map(rows.map((row) => [mapSearchApiRegionToBoundaryCode(row.geoCode) ?? row.geoCode, row]));
  const activeCode = hoverCode ?? selectedCode;
  const activeRegion = activeCode ? regionMap.get(activeCode) : null;

  useEffect(() => {
    if (!showIndonesiaMap || response.availability.regionalInterest !== "available" || !response.regionalInterest) return;
    const controller = new AbortController();
    void fetch("/maps/indonesia-geoboundaries-adm1-2017-simplified.geojson", { signal: controller.signal, cache: "force-cache" })
      .then((response) => response.ok ? response.json() as Promise<unknown> : Promise.reject(new Error("map unavailable")))
      .then((json) => {
        const validated = validBoundaries(json);
        if (!validated) throw new Error("map invalid");
        setBoundaries(projectMap(validated));
      })
      .catch(() => { if (!controller.signal.aborted) setMapFailed(true); });
    return () => controller.abort();
  }, [response.appliedFilters.geo, response.availability.regionalInterest, response.regionalInterest, showIndonesiaMap]);

  const maxIndex = Math.max(0, ...rows.map((row) => row.interestIndex ?? 0));

  return (
    <Card className="grid min-w-0 gap-14 border-soft-mist bg-paper-white p-16 sm:p-20">
      <div>
        <h2 className="text-label-bold font-w540 text-ink-charcoal sm:text-heading-sm sm:font-w460">Minat Menurut Wilayah</h2>
        <p className="mt-6 text-caption leading-body-sm text-stone-gray">{interestSubtitle(response, geoLabel)} · minat relatif per wilayah · {response.productQuery}</p>
      </div>
      {response.availability.regionalInterest === "failed" ? (
        <div className="grid justify-items-start gap-10">
          <StatusNotice role="status" tone="error">{response.datasets.regionalInterest.error?.message ?? "Data minat wilayah belum dapat dimuat."}</StatusNotice>
          {retryError ? <StatusNotice role="status" tone="error">{retryError}</StatusNotice> : null}
          {onRetry ? <Button disabled={retrying} loading={retrying} loadingText="Memuat data wilayah..." onClick={onRetry} variant="secondary">Coba lagi</Button> : null}
        </div>
      ) : response.availability.regionalInterest === "empty" || !response.regionalInterest || rows.length === 0 ? (
        <StatusNotice role="status" tone="info">Belum ada data minat wilayah untuk filter ini. Data Google Trends mungkin belum cukup. Coba rentang waktu lebih panjang atau wilayah lebih luas.</StatusNotice>
      ) : (
        <div className={`grid min-w-0 gap-18 ${showIndonesiaMap ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]" : ""}`}>
          {showIndonesiaMap ? (
          <div className="grid min-w-0 content-start gap-10">
            {mapFailed ? <StatusNotice role="status" tone="error">Peta batas wilayah tidak dapat dimuat. Tabel peringkat tetap tersedia.</StatusNotice> : null}
            {!boundaries && !mapFailed ? <StatusNotice role="status" tone="info">Memuat batas wilayah...</StatusNotice> : null}
            {boundaries ? (
              <>
                <svg aria-label="Peta indeks minat wilayah Indonesia. Wilayah tanpa nilai memiliki warna netral." className="h-auto w-full rounded-small-buttons border border-soft-mist bg-warm-parchment/35" role="group" viewBox={boundaries.viewBox}>
                  <title>Minat penelusuran menurut wilayah</title>
                  {boundaries.features.map((feature) => {
                    const region = regionMap.get(feature.code);
                    const selected = activeCode === feature.code;
                    return (
                      <path
                        aria-label={`${feature.name}, ${region?.interestIndex === null || !region ? "data tidak tersedia" : `indeks ${region.interestIndex}`}`}
                        className="cursor-pointer outline-none focus-visible:stroke-black focus-visible:stroke-[2.5]"
                        d={feature.path}
                        fill={regionColor(region?.interestIndex ?? null)}
                        key={feature.code}
                        onBlur={() => setHoverCode(null)}
                        onClick={() => setSelectedCode(feature.code)}
                        onFocus={() => setHoverCode(feature.code)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedCode(feature.code);
                          }
                        }}
                        onMouseEnter={() => setHoverCode(feature.code)}
                        onMouseLeave={() => setHoverCode(null)}
                        role="button"
                        stroke={selected ? "#141211" : "#fffdfa"}
                        strokeWidth={selected ? "1.8" : "0.7"}
                        tabIndex={0}
                      >
                        <title>{feature.name}: {region?.interestIndex ?? "Data tidak tersedia"}</title>
                      </path>
                    );
                  })}
                </svg>
                <div aria-label="Legenda indeks minat" className="flex flex-wrap gap-x-12 gap-y-6 text-caption text-stone-gray" role="group">
                  {[{ label: "0", value: 0 }, { label: "1–20", value: 20 }, { label: "21–40", value: 40 }, { label: "41–60", value: 60 }, { label: "61–80", value: 80 }, { label: "81–100", value: 100 }].map((item) => (
                    <span className="inline-flex items-center gap-5" key={item.label}><span aria-hidden="true" className="size-[12px] rounded-[2px] border border-black/10" style={{ backgroundColor: regionColor(item.value) }} />{item.label}</span>
                  ))}
                  <span className="inline-flex items-center gap-5"><span aria-hidden="true" className="size-[12px] rounded-[2px] border border-black/10" style={{ backgroundColor: regionColor(null) }} />Tidak tersedia</span>
                </div>
                <p aria-live="polite" className="min-h-18 text-body-sm text-ink-charcoal">
                  {activeRegion ? `${activeRegion.name} · ${activeRegion.interestIndex ?? "Data tidak tersedia"}` : "Arahkan atau pilih wilayah pada peta atau tabel."}
                </p>
              </>
            ) : null}
            <p className="text-caption leading-body-sm text-stone-gray">Wilayah yang tidak tampil pada peta tetap tersedia di tabel.</p>
          </div>
          ) : null}

          <div className="grid min-w-0 content-start gap-10">
            <div aria-label="Tabel peringkat minat wilayah, dapat digulir mendatar" className="overflow-x-auto rounded-small-buttons border border-soft-mist" role="region" tabIndex={0}>
              <table aria-label="Peringkat minat wilayah" className="w-full min-w-[340px] border-collapse text-left text-body-sm">
                <thead className="bg-warm-parchment text-caption font-w540 text-ink-charcoal"><tr><th className="px-10 py-10" scope="col">Posisi</th><th className="px-10 py-10" scope="col">Wilayah</th><th className="px-10 py-10" scope="col">Minat penelusuran</th></tr></thead>
                <tbody className="divide-y divide-soft-mist">
                  {visibleRows.map((row) => (
                    <tr className={selectedCode === (mapSearchApiRegionToBoundaryCode(row.geoCode) ?? row.geoCode) ? "bg-warm-parchment/60" : undefined} key={row.geoCode} onMouseEnter={() => setHoverCode(mapSearchApiRegionToBoundaryCode(row.geoCode) ?? row.geoCode)} onMouseLeave={() => setHoverCode(null)}>
                      <td className="whitespace-nowrap px-10 py-10 align-middle text-ink-charcoal">{row.position}</td>
                      <td className="px-10 py-8 align-middle">
                        <button aria-pressed={selectedCode === (mapSearchApiRegionToBoundaryCode(row.geoCode) ?? row.geoCode)} className="block w-full rounded-small-buttons py-2 text-left text-ink-charcoal underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" onBlur={() => setHoverCode(null)} onClick={() => setSelectedCode(mapSearchApiRegionToBoundaryCode(row.geoCode) ?? row.geoCode)} onFocus={() => setHoverCode(mapSearchApiRegionToBoundaryCode(row.geoCode) ?? row.geoCode)} type="button">{row.name}</button>
                        <span className="mt-5 block h-4 overflow-hidden rounded-full bg-warm-parchment" aria-hidden="true"><span className="block h-full rounded-full" style={{ backgroundColor: regionColor(row.interestIndex), width: row.interestIndex === null || maxIndex === 0 ? "0%" : `${row.interestIndex / maxIndex * 100}%` }} /></span>
                      </td>
                      <td className="whitespace-nowrap px-10 py-10 align-middle text-ink-charcoal">{row.interestIndex ?? "Tidak tersedia"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 10 ? (
              <div className="flex flex-wrap items-center justify-between gap-8 text-caption text-ink-charcoal">
                <span aria-live="polite">{(page - 1) * 10 + 1}–{Math.min(page * 10, rows.length)} dari {rows.length} wilayah</span>
                <div className="flex gap-6">
                  <button aria-label="Halaman sebelumnya untuk wilayah" className="min-h-[44px] rounded-small-buttons border border-soft-mist px-12 focus-visible:outline-2 focus-visible:outline-royal-violet disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">Sebelumnya</button>
                  <button aria-label="Halaman berikutnya untuk wilayah" className="min-h-[44px] rounded-small-buttons border border-soft-mist px-12 focus-visible:outline-2 focus-visible:outline-royal-violet disabled:opacity-40" disabled={page >= Math.ceil(rows.length / 10)} onClick={() => setPage((value) => value + 1)} type="button">Berikutnya</button>
                </div>
              </div>
            ) : null}
            <p className="text-caption leading-body-sm text-stone-gray">
              Sumber: <a className="text-royal-violet underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href="https://trends.google.com/trends/" rel="noreferrer" target="_blank">Google Trends</a>.
              {response.regionalInterest.omittedInvalidRegions ? ` ${response.regionalInterest.omittedInvalidRegions} baris wilayah tidak valid diabaikan.` : ""}
            </p>
          </div>
        </div>
      )}
      {showIndonesiaMap ? (
        <p className="text-caption leading-body-sm text-stone-gray">
          Indeks minat bukan jumlah pencarian atau ukuran pasar.
        </p>
      ) : null}
    </Card>
  );
}

export function TrendRadarInterestVisualizations({ geoLabel, response, onRetryRegional, retryingRegional = false, regionalRetryError = null }: {
  readonly geoLabel: string;
  readonly response: TrendRadarInterestResponse;
  readonly onRetryRegional?: () => void;
  readonly retryingRegional?: boolean;
  readonly regionalRetryError?: string | null;
}) {
  return (
    <div className="grid min-w-0 gap-16">
      <ChartSection geoLabel={geoLabel} response={response} />
      <RegionalSection
        geoLabel={geoLabel}
        response={response}
        {...(onRetryRegional ? { onRetry: onRetryRegional } : {})}
        retrying={retryingRegional}
        retryError={regionalRetryError}
      />
    </div>
  );
}
