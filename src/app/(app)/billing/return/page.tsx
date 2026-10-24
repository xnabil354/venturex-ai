import Link from "next/link";
import { BillingSurface } from "@/components/billing/billing-surface";
import { Card } from "@/components/ui";

export default function BillingReturnPage() {
  return (
    <BillingSurface>
      <div className="py-24 sm:py-40">
        <Card className="mx-auto max-w-[42rem] p-20 sm:p-28">
          <p className="text-caption font-w540 uppercase tracking-[0.12em] text-royal-violet">Pembayaran diproses</p>
          <h1 className="mt-8 text-heading-sm font-w460 tracking-heading-sm text-ink-charcoal">Kami sedang memverifikasi pembayaran Anda.</h1>
          <p className="mt-12 text-body-sm leading-relaxed text-stone-gray">Status hanya berubah setelah callback Duitku tervalidasi di server. Kembali ke Billing untuk memeriksa paket dan kredit Anda.</p>
          <Link href="/billing" className="mt-20 inline-flex min-h-button items-center rounded-buttons bg-midnight-wine px-16 text-body-sm font-w540 text-paper-white transition-colors hover:bg-midnight-wine/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet">Kembali ke Billing</Link>
        </Card>
      </div>
    </BillingSurface>
  );
}
