import Link from "next/link";
import { Card, PageContainer } from "@/components/ui";
import { PrivatePagination } from "@/components/opportunities/private-pagination";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";

export function PrivateStartupLibrary({ items, page, hasMore }: { items: readonly PrivateOpportunityIdeaDto[]; page: number; hasMore: boolean }) {
  return <PageContainer><div className="mx-auto grid max-w-[960px] gap-24 py-32 sm:py-48"><header className="grid gap-12"><h1 className="text-heading-sm font-w460 sm:text-heading-lg">Roadmap tersimpan</h1><p className="text-body-sm text-stone-gray">Langkah awal dari peluang yang sudah Anda tinjau.</p></header>
    {items.length ? <ul className="grid gap-16">{items.map(item => <li key={item.id}><Card className="grid gap-12 p-20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="grid min-w-0 gap-6"><p className="text-caption text-stone-gray">Startup Roadmap · Enam tahap validasi</p><h2 className="wrap-anywhere text-subheading font-w460">{item.hypothesis.title}</h2></div><Link href={`/opportunities/hypotheses/${item.id}/roadmap`} className="inline-flex min-h-button items-center justify-center rounded-buttons bg-midnight-wine px-16 text-body-sm text-paper-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet">Buka roadmap</Link></Card></li>)}</ul> : <Card className="grid gap-12 p-24"><h2 className="text-body font-w540">Belum ada roadmap di halaman ini</h2><p className="text-body-sm text-stone-gray">Buka detail peluang tersimpan untuk menyusun langkah uji pertama.</p><Link href="/saved" className="inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet">Pilih peluang tersimpan</Link></Card>}
    <PrivatePagination page={page} hasMore={hasMore} href="/roadmaps" />
    <Link className="inline-flex min-h-button items-center text-caption text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet" href="/roadmaps?source=catalog">Arsip roadmap katalog sebelumnya</Link>
  </div></PageContainer>;
}
