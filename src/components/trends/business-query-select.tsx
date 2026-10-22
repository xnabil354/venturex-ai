"use client";
import { usePathname, useRouter } from "next/navigation";
import type { BusinessQueryOption } from "@/trend/business-query-options";
import { PageContainer } from "@/components/ui";

export function BusinessQuerySelect({ options, selected }: { options: readonly BusinessQueryOption[]; selected: string }) {
  const router = useRouter(), pathname = usePathname();
  return <PageContainer><div className="mx-auto grid max-w-[1120px] gap-8 pt-24"><label htmlFor="business-query" className="text-body-sm font-w540">Fokus pencarian bisnis</label><select id="business-query" className="min-h-button w-full min-w-0 rounded-small-buttons border border-soft-mist bg-paper-white px-12 text-body-sm focus-visible:outline-2 focus-visible:outline-royal-violet sm:max-w-[560px]" value={selected} onChange={e => router.push(`${pathname}?queryKey=${encodeURIComponent(e.target.value)}`)}>{options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select><p className="max-w-[72ch] text-caption leading-relaxed text-stone-gray">Nama bisnis membaca minat merek; produk atau kategori membantu eksplorasi pasar. Perubahan fokus membersihkan hasil aktif. Tekan tombol muat untuk mengambil data.</p></div></PageContainer>;
}
