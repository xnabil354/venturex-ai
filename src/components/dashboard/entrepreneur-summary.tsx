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
    <dl aria-label="Profil calon usaha" className="grid gap-10 bg-[#ded8cb] p-10 sm:grid-cols-2 lg:grid-cols-12">
      <div className="grid gap-20 rounded-small-buttons bg-midnight-wine p-20 text-paper-white sm:col-span-2 lg:col-span-5">
        <div>
          <dt className="text-caption font-w540 text-paper-white/70">Jenis produk pilihan</dt>
          <dd className="mt-6 break-words text-subheading font-w460 leading-tight">
            {profile.preferredProductType ?? "Belum ditentukan"}
          </dd>
        </div>
        <div className="grid gap-16 sm:grid-cols-2">
          <div>
            <dt className="text-caption font-w540 text-paper-white/70">Lokasi</dt>
            <dd className="mt-4 break-words text-body-sm font-w540">{profile.location.text}</dd>
          </div>
          <div>
            <dt className="text-caption font-w540 text-paper-white/70">Pengalaman</dt>
            <dd className="mt-4 break-words text-body-sm font-w540">
              {getLabel(EXPERIENCE_LABELS, profile.experienceLevel)}
            </dd>
          </div>
        </div>
      </div>
      <div className="grid gap-10 sm:col-span-2 sm:grid-cols-2 lg:col-span-7">
        <div className="rounded-small-buttons bg-[#faf9f6]">
          <SummaryField label="Kisaran budget">
            {formatRange(profile.budget.min, profile.budget.max)}
          </SummaryField>
        </div>
        <div className="rounded-small-buttons bg-[#faf9f6]">
          <SummaryField label="Komitmen waktu">
            {getLabel(TIME_COMMITMENT_LABELS, profile.timeCommitment)}
          </SummaryField>
        </div>
      </div>
      <div className="rounded-small-buttons bg-[#faf9f6] lg:col-span-4">
        <SummaryField label="Minat F&B">
          <SummaryReferences items={profile.interests} />
        </SummaryField>
      </div>
      <div className="rounded-small-buttons bg-[#faf9f6] lg:col-span-4">
        <SummaryField label="Segmen pelanggan">
          <SummaryReferences items={profile.customerSegments} />
        </SummaryField>
      </div>
      <div className="rounded-small-buttons bg-[#faf9f6] lg:col-span-4">
        <SummaryField label="Saluran penjualan">
          <SummaryReferences items={profile.salesChannels} />
        </SummaryField>
      </div>
    </dl>
  );
}
