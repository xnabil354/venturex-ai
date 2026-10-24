import Link from "next/link";
import { Card, PageContainer, StatusNotice } from "@/components/ui";
import type { PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { EntrepreneurRiskView } from "./entrepreneur-risk-view";

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
export function PrivateComparison({ items, from = "saved", removedCount = 0 }: { readonly items: readonly PrivateOpportunityIdeaDto[]; readonly from?: "saved" | "finder"; readonly removedCount?: number }) {
  return <PageContainer><div className="mx-auto grid max-w-[1120px] gap-24 py-32 sm:py-48">
    <Link href={from === "finder" ? "/opportunities" : "/saved"} className="inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet"><span className="px-1" aria-hidden="true">←</span>Kembali ke daftar peluang</Link>
    <header className="grid gap-12"><h1 className="text-heading-sm font-w460 sm:text-heading-lg">Bandingkan peluang</h1><p className="max-w-[72ch] text-body-sm leading-relaxed text-stone-gray">Tinjau skor, risiko, dan bukti sebelum menentukan konsep yang ingin diuji.</p></header>
    {removedCount > 0 ? <StatusNotice tone="info" role="status">Pilihan yang tidak tersedia atau belum memiliki skor lengkap telah dikeluarkan. {items.length < 2 ? "Pilih peluang lain dari daftar untuk membandingkan minimal dua peluang." : "Anda dapat melanjutkan dengan pilihan yang tersedia."}</StatusNotice> : null}
    <div className={`grid min-w-0 gap-16 ${items.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>{items.map(item => {
      const analysis = item.hypothesis.analysis;
      if (!analysis) return null;
      return <Card className="grid min-w-0 content-start gap-16 p-20" key={item.id}>
        <h2 className="wrap-anywhere text-subheading font-w460">{item.hypothesis.title}</h2>
        <dl className="grid gap-12 border-y border-soft-mist py-16 text-body-sm">{[{ label: "Opportunity Score", result: analysis.opportunity }, { label: "Fit Score", result: analysis.fit }].map(({ label, result }) => {
          return <div key={label} className="flex flex-wrap justify-between gap-8"><dt>{label}</dt><dd className="font-w540">{result.score === null ? "—" : number.format(result.score)}/100<span className="block text-caption font-w460 text-stone-gray">Cakupan {result.coverage}%</span></dd></div>;
        })}</dl>

        <EntrepreneurRiskView analysis={analysis} />
        <dl className="grid gap-16 text-body-sm"><div className="grid gap-4"><dt className="font-w540">Modal minimum terkonfirmasi</dt><dd>{analysis.capitalMin === null ? "Belum diisi" : `Rp ${number.format(analysis.capitalMin)}`}</dd></div><div className="grid gap-4"><dt className="font-w540">Target konsumen</dt><dd className="wrap-anywhere leading-relaxed text-stone-gray">{analysis.targetConsumer}</dd></div><div className="grid gap-4"><dt className="font-w540">Kompetisi</dt><dd className="wrap-anywhere leading-relaxed text-stone-gray">{analysis.competition}</dd></div><div className="grid gap-4"><dt className="font-w540">Kebutuhan awal</dt><dd><ul className="grid list-disc gap-6 pl-16 text-stone-gray">{analysis.requirements?.initialNeeds.map(need => <li className="wrap-anywhere" key={need}>{need}</li>)}</ul></dd></div></dl>
        <p className="text-caption leading-relaxed text-stone-gray">{analysis.warnings.length ? "Ada keterbatasan bukti. Tinjau catatan pada detail." : "Skor awal belum membuktikan respons pembeli atau hasil usaha."}</p>
        <a className="inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet" href={item.source.url} target="_blank" rel="noreferrer">Bukti Google Trends</a>
        <Link className="inline-flex min-h-button items-center rounded-small-buttons border border-soft-mist px-12 text-body-sm text-midnight-wine focus-visible:outline-2 focus-visible:outline-royal-violet" href={`/opportunities/hypotheses/${item.id}`}>Lihat detail peluang</Link>
      </Card>;
    })}</div>
    <p className="text-caption text-stone-gray">Skor adalah panduan awal. Tidak ada pemenang otomatis.</p>
  </div></PageContainer>;
}
