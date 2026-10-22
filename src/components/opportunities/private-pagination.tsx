import Link from "next/link";

export function PrivatePagination({ page, hasMore, href }: { readonly page: number; readonly hasMore: boolean; readonly href: string }) {
  if (page === 1 && !hasMore) return null;
  const style = "inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet";
  return <nav aria-label="Halaman arsip" className="flex flex-wrap items-center justify-between gap-16 border-t border-soft-mist pt-16">
    {page > 1 ? <Link prefetch={false} className={style} href={`${href}${href.includes("?") ? "&" : "?"}page=${page - 1}`}>Sebelumnya</Link> : <span />}
    <span className="text-caption text-stone-gray">Halaman {page}</span>
    {hasMore ? <Link prefetch={false} className={style} href={`${href}${href.includes("?") ? "&" : "?"}page=${page + 1}`}>Selanjutnya</Link> : <span />}
  </nav>;
}
