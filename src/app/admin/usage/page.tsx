import { getBillingSettings } from "@/billing/admin";
import { UsageSettingsForm } from "@/components/admin/admin-settings-forms";
import { PageContainer } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminUsagePage() {
  const settings = await getBillingSettings();
  return <PageContainer className="py-32 sm:py-48"><p className="text-caption font-w540 uppercase tracking-[0.14em] text-royal-violet">Operator · tarif kredit</p><h1 className="mt-10 max-w-[16ch] text-heading-lg font-w460 tracking-heading-lg">Atur biaya untuk setiap aksi AI.</h1><p className="mt-12 max-w-[64ch] text-body-sm leading-relaxed text-stone-gray">Perubahan dipakai saat reservasi kredit baru dimulai. Tarif 0 tidak membuka akses AI bagi akun tanpa paket atau trial.</p><section className="mt-28"><UsageSettingsForm initial={settings.usage} /></section></PageContainer>;
}
