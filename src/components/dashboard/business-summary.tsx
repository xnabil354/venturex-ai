import type { UmkmDashboardDto } from "../../dashboard/dto";

import { SummaryField, SummaryReferences } from "./profile-summary";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  currency: "IDR",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatRange(min: number, max: number): string {
  return `${currencyFormatter.format(min)} – ${currencyFormatter.format(max)}`;
}

export type BusinessSummaryProps = {
  readonly profile: UmkmDashboardDto["profile"];
};

export function BusinessSummary({ profile }: BusinessSummaryProps) {
  return (
    <dl className="grid gap-px bg-[#ded8cb] sm:grid-cols-2 lg:grid-cols-4 [&>*]:bg-[#faf9f6]">
      <SummaryField label="Nama bisnis">{profile.businessName}</SummaryField>
      <SummaryField label="Kategori bisnis">{profile.businessCategory.name}</SummaryField>
      <SummaryField label="Lokasi">{profile.location.text}</SummaryField>
      <SummaryField label="Kisaran harga rata-rata">
        {formatRange(profile.averagePrice.min, profile.averagePrice.max)}
      </SummaryField>
      <SummaryField label="Jumlah produk">{profile.productCount} produk</SummaryField>
      <SummaryField label="Segmen pelanggan">
        <SummaryReferences items={profile.customerSegments} />
      </SummaryField>
      <SummaryField label="Saluran penjualan">
        <SummaryReferences items={profile.salesChannels} />
      </SummaryField>
    </dl>
  );
}
