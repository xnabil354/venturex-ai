import Papa from "papaparse";

import type { TrendRadarResponse } from "./trend-radar-contract";

type CsvValue = string | number | boolean;
type CsvRecord = Record<string, CsvValue>;
type TrendRadarCsvKind = "top" | "rising";

const propertyLabels: Record<TrendRadarResponse["appliedFilters"]["property"], string> = {
  web: "Penelusuran web",
  images: "Penelusuran gambar",
  news: "Penelusuran berita",
  shopping: "Google Shopping",
  youtube: "Penelusuran YouTube",
};

function formatRetrievedAt(value: string): string {
  return new Date(value).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatJakartaDate(value: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const datePart = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "00";

  return datePart("year") + "-" + datePart("month") + "-" + datePart("day");
}

function csvRecords(result: TrendRadarResponse, kind: TrendRadarCsvKind): CsvRecord[] {
  const context: CsvRecord = {
    "Kueri acuan": result.productQuery,
    "Rentang waktu": result.appliedFilters.time,
    "Properti penelusuran": propertyLabels[result.appliedFilters.property],
    Wilayah: "Indonesia",
    "Sumber data": result.provider + " / Google Trends",
    "Waktu diambil (WIB)": formatRetrievedAt(result.retrievedAt),
  };

  if (kind === "top") {
    return result.top.map((row) => ({
      Posisi: row.position,
      Kueri: row.query,
      "Indeks minat": row.interestIndex ?? "",
      Catatan: "Indeks minat adalah nilai relatif dalam konteks terpilih, bukan jumlah pencarian.",
      "Sumber Google Trends": row.sourceUrl ?? "",
      ...context,
    }));
  }

  return result.rising.map((row) => ({
    Posisi: row.position,
    Kueri: row.query,
    Pertumbuhan: row.isBreakout
      ? "Breakout"
      : row.growthLabel ?? (row.growthPercent === null || row.growthPercent === undefined ? "" : String(row.growthPercent) + "%"),
    "Pertumbuhan (%)": row.growthPercent ?? "",
    Breakout: row.isBreakout ? "Ya" : "Tidak",
    Catatan: row.isBreakout ? "Breakout tidak dikonversi menjadi persentase." : "Label pertumbuhan mengikuti nilai yang disediakan sumber.",
    "Sumber Google Trends": row.sourceUrl ?? "",
    ...context,
  }));
}

export function downloadTrendRadarCsv(result: TrendRadarResponse, kind: TrendRadarCsvKind): void {
  const fields = kind === "top"
    ? [
        "Posisi",
        "Kueri",
        "Indeks minat",
        "Catatan",
        "Sumber Google Trends",
        "Kueri acuan",
        "Rentang waktu",
        "Properti penelusuran",
        "Wilayah",
        "Sumber data",
        "Waktu diambil (WIB)",
      ]
    : [
        "Posisi",
        "Kueri",
        "Pertumbuhan",
        "Pertumbuhan (%)",
        "Breakout",
        "Catatan",
        "Sumber Google Trends",
        "Kueri acuan",
        "Rentang waktu",
        "Properti penelusuran",
        "Wilayah",
        "Sumber data",
        "Waktu diambil (WIB)",
      ];
  const csv = Papa.unparse(
    { fields, data: csvRecords(result, kind) },
    { escapeFormulae: true, newline: "\r\n" },
  );
  const label = kind === "top" ? "kueri-terpopuler" : "kueri-makin-populer";
  const filterSuffix = result.appliedFilters.period + "-" + result.appliedFilters.property;
  const filename = "venturex-trend-radar-" + label + "-" + filterSuffix + "-" + formatJakartaDate(result.retrievedAt) + ".csv";
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
