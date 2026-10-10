import type { EntrepreneurDashboardDto } from "../../dashboard/dto";

import { SummaryField, SummaryReferences } from "./profile-summary";

const EXPERIENCE_LABELS: Readonly<Record<string, string>> = {
  BEGINNER: "Baru memulai",
  SOME_EXPERIENCE: "Pernah mencoba",
  EXPERIENCED: "Berpengalaman",
};

const TIME_COMMITMENT_LABELS: Readonly<Record<string, string>> = {
  LIMITED: "Waktu terbatas",
  PART_TIME: "Paruh waktu",
  FULL_TIME: "Fokus penuh waktu",
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  currency: "IDR",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatRange(min: number, max: number): string {
  return `${currencyFormatter.format(min)} – ${currencyFormatter.format(max)}`;
}

function getLabel(labels: Readonly<Record<string, string>>, value: string): string {
  return labels[value] ?? "Belum ditentukan";
}

export type EntrepreneurSummaryProps = {
  readonly profile: EntrepreneurDashboardDto["profile"];
};

export function EntrepreneurSummary({ profile }: EntrepreneurSummaryProps) {
  return (
    <dl className="grid gap-16 md:grid-cols-2">
      <SummaryField label="Lokasi">{profile.location.text}</SummaryField>
      <SummaryField label="Kisaran budget">
        {formatRange(profile.budget.min, profile.budget.max)}
      </SummaryField>
      <SummaryField label="Tingkat pengalaman">
        {getLabel(EXPERIENCE_LABELS, profile.experienceLevel)}
      </SummaryField>
      <SummaryField label="Komitmen waktu">
        {getLabel(TIME_COMMITMENT_LABELS, profile.timeCommitment)}
      </SummaryField>
      {profile.preferredProductType ? (
        <SummaryField label="Jenis produk pilihan">
          {profile.preferredProductType}
        </SummaryField>
      ) : null}
      <SummaryField label="Minat F&B">
        <SummaryReferences items={profile.interests} />
      </SummaryField>
      <SummaryField label="Segmen pelanggan">
        <SummaryReferences items={profile.customerSegments} />
      </SummaryField>
      <SummaryField label="Saluran penjualan">
        <SummaryReferences items={profile.salesChannels} />
      </SummaryField>
    </dl>
  );
}
