import Link from "next/link";

import { Button, Card, EmptyState, PageContainer } from "@/components/ui";
import type { OpportunityFinderResult } from "@/opportunity/service";
import type { OpportunityCategoryOption } from "@/opportunity/domain";
import type { OpportunityScoreDisplayState } from "@/scoring/opportunity-score-service";
import { OpportunityScoreDisplay } from "./opportunity-score-display";

function StatusMessage({ status }: { readonly status: "ERROR" | "UNAVAILABLE" }) {
  const copy = status === "ERROR"
    ? {
        title: "Opportunity Finder belum dapat dimuat",
        description: "Katalog peluang belum dapat dimuat. Coba muat ulang halaman.",
      }
    : {
        title: "Opportunity Finder belum tersedia",
        description: "Katalog peluang belum tersedia untuk saat ini.",
      };

  return <EmptyState description={copy.description} title={copy.title} />;
}

function CategoryFilter({
  categories,
  selectedCategory,
}: {
  readonly categories: readonly OpportunityCategoryOption[];
  readonly selectedCategory: OpportunityCategoryOption | null;
}) {
  return (
    <form action="/opportunities" className="grid max-w-[520px] gap-8 border-b border-soft-mist pb-20" method="get">
      <label className="text-body-sm font-w540 text-ink-charcoal" htmlFor="opportunity-category">
        Filter kategori F&amp;B
      </label>
      <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
        <select
          className="min-h-button min-w-0 flex-1 rounded-small-buttons border border-soft-mist bg-paper-white px-12 text-body-sm text-ink-charcoal"
          defaultValue={selectedCategory?.code ?? ""}
          id="opportunity-category"
          name="category"
        >
          <option value="">Semua kategori</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>{category.name}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary">Terapkan filter</Button>
      </div>
    </form>
  );
}

function pageHref(page: number, categoryCode: string | null): string {
  const query = new URLSearchParams({ page: String(page) });
  if (categoryCode) query.set("category", categoryCode);
  return `/opportunities?${query.toString()}`;
}

export function OpportunityFinder({
  result,
  scoreByOpportunityId,
}: {
  readonly result: OpportunityFinderResult;
  readonly scoreByOpportunityId: Readonly<Record<string, OpportunityScoreDisplayState>>;
}) {
  const catalog = result.status === "AVAILABLE" ||
    result.status === "EMPTY" ||
    result.status === "INVALID_CATEGORY"
    ? result
    : null;

  return (
    <PageContainer>
      <div className="grid gap-32 py-32 sm:py-48 lg:py-64">
        <header className="grid max-w-[720px] gap-12">
          <p className="text-label-bold font-w460 text-royal-violet">Opportunity Intelligence</p>
          <h1 className="text-heading-lg font-w460 leading-heading-lg text-ink-charcoal sm:text-display sm:leading-display">
            Opportunity Finder
          </h1>
          <p className="text-body leading-body text-stone-gray">
            Katalog peluang usaha F&amp;B yang ditautkan ke tren terpublikasi untuk jenis akun ini.
          </p>
        </header>

        {catalog ? (
          <CategoryFilter categories={catalog.categories} selectedCategory={catalog.selectedCategory} />
        ) : null}

        {result.status === "AVAILABLE" ? (
          <>
            <ul aria-label="Katalog peluang F&B" className="grid gap-16">
              {result.items.map((item) => (
                <li key={item.id}>
                  <Card className="p-20 sm:p-24">
                    <article aria-labelledby={`opportunity-${item.id}`} className="grid gap-16">
                      <header className="grid gap-8">
                        <p className="wrap-anywhere text-body-sm font-w540 text-stone-gray">
                          {item.categoryName}
                        </p>
                        <h2
                          className="wrap-anywhere text-heading-sm font-w460 leading-heading-sm text-ink-charcoal"
                          id={`opportunity-${item.id}`}
                        >
                          <Link
                            aria-label={`Lihat detail ${item.name}`}
                            className="transition-colors hover:text-royal-violet hover:underline"
                            href={`/opportunities/${item.id}`}
                          >
                            {item.name}
                          </Link>
                        </h2>
                        <p className="max-w-[76ch] wrap-anywhere text-body-sm leading-body-sm text-stone-gray">
                          {item.summary}
                        </p>
                      </header>

                      <section aria-label={`Indikator untuk ${item.name}`} className="grid gap-8 border-t border-soft-mist pt-12 sm:grid-cols-3">
                        <div className="grid min-w-0 gap-4 text-body-sm text-stone-gray">
                          <span className="font-w540 text-ink-charcoal">Opportunity Score</span>
                          <OpportunityScoreDisplay compact result={scoreByOpportunityId[item.id] ?? { status: "ERROR" }} />
                        </div>
                        <p className="grid gap-4 text-body-sm text-stone-gray">
                          <span className="font-w540 text-ink-charcoal">Fit Score</span>
                          Data belum cukup
                        </p>
                        <p className="grid gap-4 text-body-sm text-stone-gray">
                          <span className="font-w540 text-ink-charcoal">Risiko</span>
                          Data belum cukup
                        </p>
                      </section>

                      <p className="border-t border-soft-mist pt-12 text-body-sm text-stone-gray">
                        Tren terkait:{" "}
                        <Link
                          className="font-w540 text-royal-violet underline-offset-2 hover:underline"
                          href={`/trends/${item.relatedTrend.id}`}
                        >
                          {item.relatedTrend.title}
                        </Link>
                      </p>
                    </article>
                  </Card>
                </li>
              ))}
            </ul>

            <nav aria-label="Navigasi halaman katalog peluang" className="flex flex-wrap items-center justify-between gap-12 border-t border-soft-mist pt-16">
              {result.page > 1 ? (
                <Link
                  className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet hover:underline"
                  href={pageHref(result.page - 1, result.selectedCategory?.code ?? null)}
                >
                  Sebelumnya
                </Link>
              ) : <span aria-disabled="true" className="text-body-sm text-stone-gray">Sebelumnya</span>}
              <p className="text-body-sm text-stone-gray">
                Halaman {result.page} dari {result.totalPages} · {result.totalCount} peluang
              </p>
              {result.page < result.totalPages ? (
                <Link
                  className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet hover:underline"
                  href={pageHref(result.page + 1, result.selectedCategory?.code ?? null)}
                >
                  Berikutnya
                </Link>
              ) : <span aria-disabled="true" className="text-body-sm text-stone-gray">Berikutnya</span>}
            </nav>
          </>
        ) : result.status === "EMPTY" ? (
          <EmptyState
            action={(
              <Link
                className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet hover:underline"
                href={result.selectedCategory ? "/opportunities" : "/trends"}
              >
                {result.selectedCategory ? "Hapus filter kategori" : "Lihat Trend Radar"}
              </Link>
            )}
            description={result.selectedCategory
              ? `Belum ada peluang yang tersedia pada kategori ${result.selectedCategory.name} untuk jenis akun ini.`
              : "Belum ada peluang tersimpan dengan tren terpublikasi untuk jenis akun ini."}
            title={result.selectedCategory ? "Belum ada peluang pada kategori ini" : "Belum ada peluang"}
          />
        ) : result.status === "INVALID_CATEGORY" ? (
          <EmptyState
            action={(
              <Link
                className="inline-flex min-h-button items-center text-body-sm font-w540 text-royal-violet hover:underline"
                href="/opportunities"
              >
                Hapus filter
              </Link>
            )}
            description="Pilih kategori F&B aktif dari daftar yang tersedia."
            title="Kategori tidak tersedia"
          />
        ) : (
          <StatusMessage status={result.status} />
        )}
      </div>
    </PageContainer>
  );
}
