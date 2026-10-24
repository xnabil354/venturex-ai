import type { TrendRadarResponse } from "@/trend/trend-radar-contract";

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
  const buttonClass = "inline-flex size-[44px] items-center justify-center rounded-small-buttons border border-soft-mist text-ink-charcoal transition-colors hover:bg-warm-parchment disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet";

  return (
    <div className="flex flex-wrap items-center justify-between gap-8">
      <span aria-live="polite" className="text-caption text-ink-charcoal">
        Menampilkan {firstRow}–{lastRow} dari {totalRows} kueri
      </span>
      <div aria-label={`Navigasi halaman ${tableName}`} className="flex items-center gap-6" role="group">
        <button aria-label={`Halaman sebelumnya untuk ${tableName}`} className={buttonClass} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} type="button">
          <svg aria-hidden="true" className="size-18" fill="none" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
        </button>
        <button aria-label={`Halaman berikutnya untuk ${tableName}`} className={buttonClass} disabled={currentPage >= pageCount} onClick={() => onPageChange(currentPage + 1)} type="button">
          <svg aria-hidden="true" className="size-18" fill="none" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
        </button>
      </div>
    </div>
  );
}

export function TopQueriesTable({ currentPage, data, onPageChange }: {
  readonly currentPage: number;
  readonly data: TrendRadarResponse["top"];
  readonly onPageChange: (page: number) => void;
}) {
  const visibleRows = pageRows(data, currentPage);
  return (
    <>
      <div aria-label="Tabel kueri terpopuler, dapat digulir mendatar" className="overflow-x-auto rounded-small-buttons border border-soft-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" role="region" tabIndex={0}>
        <table aria-label="Kueri terpopuler" className="w-full min-w-[400px] table-fixed border-collapse text-left text-body-sm">
          <colgroup><col className="w-[56px]" /><col /><col className="w-[96px]" /><col className="w-[112px]" /></colgroup>
          <thead className="bg-warm-parchment text-caption font-w540 text-ink-charcoal"><tr><th className="px-10 py-10" scope="col">Posisi</th><th className="px-10 py-10" scope="col">Kueri</th><th className="px-10 py-10" scope="col">Indeks minat</th><th className="px-10 py-10" scope="col">Sumber</th></tr></thead>
          <tbody className="divide-y divide-soft-mist">
            {data.length === 0 ? (
              <tr><td className="px-10 py-16 text-stone-gray" colSpan={4}>Belum ada kueri teratas untuk filter ini. Data Google Trends mungkin belum cukup. Coba rentang waktu lebih panjang atau wilayah lebih luas.</td></tr>
            ) : visibleRows.map((row) => (
              <tr key={row.position + "-" + row.query}>
                <td className="whitespace-nowrap px-10 py-10 align-top text-ink-charcoal">{row.position}</td>
                <td className="break-words px-10 py-10 align-top font-w540 text-ink-charcoal">{row.query}</td>
                <td className="break-words px-10 py-10 align-top text-ink-charcoal">{row.interestIndex ?? "Tidak tersedia"}</td>
                <td className="px-10 py-10 align-top">{row.sourceUrl ? <a className="whitespace-nowrap text-royal-violet underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href={row.sourceUrl} rel="noreferrer" target="_blank">Google Trends</a> : <span className="text-stone-gray">Tidak tersedia</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination currentPage={currentPage} onPageChange={onPageChange} tableName="Kueri Terpopuler" totalRows={data.length} />
    </>
  );
}

export function RisingQueriesTable({ currentPage, data, onPageChange }: {
  readonly currentPage: number;
  readonly data: TrendRadarResponse["rising"];
  readonly onPageChange: (page: number) => void;
}) {
  const visibleRows = pageRows(data, currentPage);
  return (
    <>
      <div aria-label="Tabel kueri yang makin populer, dapat digulir mendatar" className="overflow-x-auto rounded-small-buttons border border-soft-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" role="region" tabIndex={0}>
        <table aria-label="Kueri yang makin populer" className="w-full min-w-[400px] table-fixed border-collapse text-left text-body-sm">
          <colgroup><col className="w-[56px]" /><col /><col className="w-[96px]" /><col className="w-[112px]" /></colgroup>
          <thead className="bg-warm-parchment text-caption font-w540 text-ink-charcoal"><tr><th className="px-10 py-10" scope="col">Posisi</th><th className="px-10 py-10" scope="col">Kueri</th><th className="px-10 py-10" scope="col">Pertumbuhan</th><th className="px-10 py-10" scope="col">Sumber</th></tr></thead>
          <tbody className="divide-y divide-soft-mist">
            {data.length === 0 ? (
              <tr><td className="px-10 py-16 text-stone-gray" colSpan={4}>Belum ada kueri meningkat untuk filter ini. Data Google Trends mungkin belum cukup. Coba rentang waktu lebih panjang atau wilayah lebih luas.</td></tr>
            ) : visibleRows.map((row) => (
              <tr key={row.position + "-" + row.query}>
                <td className="whitespace-nowrap px-10 py-10 align-top text-ink-charcoal">{row.position}</td>
                <td className="break-words px-10 py-10 align-top font-w540 text-ink-charcoal">{row.query}</td>
                <td className="break-words px-10 py-10 align-top text-ink-charcoal">{row.isBreakout ? "Breakout" : row.growthLabel ?? (row.growthPercent === null || row.growthPercent === undefined ? "Tidak tersedia" : String(row.growthPercent) + "%")}</td>
                <td className="px-10 py-10 align-top">{row.sourceUrl ? <a className="whitespace-nowrap text-royal-violet underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet" href={row.sourceUrl} rel="noreferrer" target="_blank">Google Trends</a> : <span className="text-stone-gray">Tidak tersedia</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination currentPage={currentPage} onPageChange={onPageChange} tableName="Kueri yang Makin Populer" totalRows={data.length} />
    </>
  );
}
