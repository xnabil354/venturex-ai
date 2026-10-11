import Link from "next/link";

import type { RoadmapPage } from "@/roadmap/domain";
import { Card, PageContainer } from "@/components/ui";

export function RoadmapList({ page, roadmapType }: { readonly page: RoadmapPage; readonly roadmapType: "STARTUP" | "GROWTH" }) {
  const roadmapLabel = roadmapType === "GROWTH" ? "Growth Roadmap" : "Startup Roadmap";
  return (
    <PageContainer>
      <div className="grid gap-24 py-32 sm:py-48 lg:py-64">
        <header className="grid gap-8">
          <p className="text-label-bold text-royal-violet">{roadmapLabel}</p>
          <h1 className="text-heading-lg font-w460 text-ink-charcoal sm:text-display">Roadmap tersimpan</h1>
          <p className="max-w-[76ch] text-body-sm leading-body-sm text-stone-gray">
            {roadmapType === "GROWTH"
              ? "Roadmap membantu menyusun uji pertumbuhan untuk bisnis yang berjalan. Isinya bukan prediksi atau jaminan hasil usaha."
              : "Roadmap membantu menyusun langkah validasi. Isi langkah bukan jaminan pasar atau keberhasilan usaha."}
          </p>
        </header>
        {page.items.length === 0 ? (
          <Card className="grid gap-8 p-20 sm:p-24">
            <h2 className="text-label-bold text-ink-charcoal">Belum ada {roadmapLabel}</h2>
            <p className="text-body-sm leading-body-sm text-stone-gray">Buka Opportunity yang memenuhi syarat untuk membuat rencana validasi pertama.</p>
            <Link className="w-fit text-body-sm font-w540 text-royal-violet underline underline-offset-4" href="/opportunities">Jelajahi Opportunity</Link>
          </Card>
        ) : (
          <ul className="grid gap-12">
            {page.items.map((item) => (
              <li key={item.id}>
                <Card className="grid gap-8 p-16 sm:p-20">
                  <p className="text-caption text-stone-gray">Dibuat {new Date(item.createdAt).toLocaleDateString("id-ID", { dateStyle: "long" })}</p>
                  <h2 className="text-label-bold text-ink-charcoal">{item.opportunity.name}</h2>
                  <Link className="w-fit text-body-sm font-w540 text-royal-violet underline underline-offset-4" href={`/roadmaps/${item.id}`}>Buka roadmap</Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {page.totalPages > 1 ? (
          <nav aria-label="Navigasi halaman Roadmap" className="flex flex-wrap items-center gap-16">
            {page.page > 1 ? <Link className="text-body-sm font-w540 text-royal-violet underline underline-offset-4" href={`/roadmaps?page=${page.page - 1}`}>Sebelumnya</Link> : null}
            <p aria-live="polite" className="text-caption text-stone-gray">Halaman {page.page} dari {page.totalPages}.</p>
            {page.page < page.totalPages ? <Link className="text-body-sm font-w540 text-royal-violet underline underline-offset-4" href={`/roadmaps?page=${page.page + 1}`}>Selanjutnya</Link> : null}
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
