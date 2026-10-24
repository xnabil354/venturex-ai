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
    <dl aria-label={`Profil usaha ${profile.businessName}`} className="grid gap-10 bg-[#ded8cb] p-10 md:grid-cols-2 lg:grid-cols-12">
      <div className="grid gap-20 rounded-small-buttons bg-midnight-wine p-20 text-paper-white md:col-span-2 lg:col-span-5">
        <div>
          <dt className="text-caption font-w540 text-paper-white/70">Nama usaha</dt>
          <dd className="mt-6 break-words text-subheading font-w460 leading-tight">{profile.businessName}</dd>
        </div>
        <div className="grid gap-16 md:grid-cols-2">
          <div>
            <dt className="text-caption font-w540 text-paper-white/70">Bidang usaha</dt>
            <dd className="mt-4 text-body-sm font-w540">{profile.businessCategory.name}</dd>
          </div>
          <div>
            <dt className="text-caption font-w540 text-paper-white/70">Lokasi</dt>
            <dd className="mt-4 break-words text-body-sm font-w540">{profile.location.text}</dd>
          </div>
        </div>
      </div>
      <div className="grid gap-10 md:col-span-2 md:grid-cols-2 lg:col-span-7">
        <div className="rounded-small-buttons bg-[#faf9f6]">
          <SummaryField label="Kisaran harga rata-rata">
            {formatRange(profile.averagePrice.min, profile.averagePrice.max)}
          </SummaryField>
        </div>
        <div className="rounded-small-buttons bg-[#faf9f6]">
          <SummaryField label="Produk yang dijual">{profile.productCount} produk</SummaryField>
        </div>
      </div>
      <div className="rounded-small-buttons bg-[#faf9f6] lg:col-span-6">
        <SummaryField label="Pelanggan utama">
          <SummaryReferences items={profile.customerSegments} />
        </SummaryField>
      </div>
      <div className="rounded-small-buttons bg-[#faf9f6] lg:col-span-6">
        <SummaryField label="Saluran penjualan">
          <SummaryReferences items={profile.salesChannels} />
        </SummaryField>
      </div>
    </dl>
  );
}
