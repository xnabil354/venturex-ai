import Link from "next/link";
import { PageContainer, Card } from "@/components/ui";

export default function BillingReturnPage() {
  return <PageContainer className="py-48"><Card className="mx-auto max-w-[38rem] p-24"><p className="text-caption font-w540 uppercase tracking-[0.12em] text-royal-violet">Pembayaran diproses</p><h1 className="mt-8 text-heading-sm font-w460 tracking-heading-sm">Kami sedang memverifikasi pembayaran Anda.</h1><p className="mt-12 text-body-sm leading-relaxed text-stone-gray">Status hanya berubah setelah callback Duitku tervalidasi di server. Kembali ke Billing untuk memeriksa paket dan kredit Anda.</p><Link href="/billing" className="mt-20 inline-flex min-h-button items-center rounded-buttons bg-midnight-wine px-16 text-body-sm font-w540 text-paper-white">Kembali ke Billing</Link></Card></PageContainer>;
}
