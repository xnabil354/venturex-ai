import { getBillingSettings } from "@/billing/admin";
import { ProductSettingsForm } from "@/components/admin/admin-settings-forms";
import { PageContainer } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const settings = await getBillingSettings();
  return <PageContainer className="py-32 sm:py-48"><p className="text-caption font-w540 uppercase tracking-[0.14em] text-royal-violet">Operator · pricing</p><h1 className="mt-10 max-w-[16ch] text-heading-lg font-w460 tracking-heading-lg">Harga yang berlaku untuk checkout berikutnya.</h1><p className="mt-12 max-w-[64ch] text-body-sm leading-relaxed text-stone-gray">Harga dan jatah kredit setiap paket dapat diperbarui di sini. Pembayaran yang sudah dibuat mempertahankan nilai penawaran awalnya.</p><section className="mt-28"><ProductSettingsForm initial={settings.products} /></section></PageContainer>;
}
