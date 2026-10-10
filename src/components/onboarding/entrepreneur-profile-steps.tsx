import type { ChangeEvent } from "react";

import {
  EXPERIENCE_LEVELS,
  TIME_COMMITMENTS,
  type ExperienceLevel,
  type TimeCommitment,
} from "@/profile/validation";
import { Button, Input, Select, type SelectOption } from "@/components/ui";

import { CheckboxGroup, FormSection } from "./entrepreneur-profile-options";
import type { EntrepreneurFormState } from "./entrepreneur-profile-form.validation";
import type { ReferenceData } from "./entrepreneur-profile-form.types";

type FormErrors = Readonly<Record<string, string>>;
type UpdateForm = (patch: Partial<EntrepreneurFormState>) => void;

type StepProps = {
  readonly errors: FormErrors;
  readonly references: ReferenceData;
  readonly state: EntrepreneurFormState;
  readonly updateForm: UpdateForm;
};

const experienceOptions: readonly SelectOption[] = [
  { value: "", label: "Pilih pengalaman", disabled: true },
  { value: EXPERIENCE_LEVELS.BEGINNER, label: "Baru memulai" },
  { value: EXPERIENCE_LEVELS.SOME_EXPERIENCE, label: "Pernah mencoba" },
  { value: EXPERIENCE_LEVELS.EXPERIENCED, label: "Berpengalaman" },
];

const timeCommitmentOptions: readonly SelectOption[] = [
  { value: "", label: "Pilih komitmen waktu", disabled: true },
  { value: TIME_COMMITMENTS.LIMITED, label: "Waktu terbatas" },
  { value: TIME_COMMITMENTS.PART_TIME, label: "Paruh waktu" },
  { value: TIME_COMMITMENTS.FULL_TIME, label: "Fokus penuh waktu" },
];

export function EntrepreneurProfileStepOne({
  errors,
  references,
  state,
  updateForm,
}: StepProps) {
  return (
    <div className="grid gap-24">
      <FormSection
        description="Gunakan lokasi yang ingin Anda jadikan konteks saat menilai peluang usaha."
        title="Lokasi utama"
      >
        <div className="grid gap-16 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              autoComplete="address-level2"
              error={errors.locationText}
              hint="Contoh: Jakarta Pusat. Tidak perlu alamat lengkap."
              id="location-text"
              label="Lokasi utama *"
              maxLength={255}
              onChange={(event) => updateForm({ locationText: event.target.value })}
              placeholder="Jakarta Pusat"
              value={state.locationText}
            />
          </div>
          <Input
            autoComplete="address-level2"
            error={errors.city}
            id="location-city"
            label="Kota/Kabupaten"
            maxLength={120}
            onChange={(event) => updateForm({ city: event.target.value })}
            placeholder="Jakarta Pusat"
            value={state.city}
          />
          <Input
            autoComplete="address-level1"
            error={errors.province}
            id="location-province"
            label="Provinsi"
            maxLength={120}
            onChange={(event) => updateForm({ province: event.target.value })}
            placeholder="DKI Jakarta"
            value={state.province}
          />
        </div>
      </FormSection>

      <FormSection
        description="Pilih kategori yang ingin Anda pertimbangkan. Anda dapat memilih lebih dari satu."
        title="Minat F&B"
      >
        <CheckboxGroup
          error={errors.interestCategoryIds}
          id="interest-categories"
          legend="Kategori yang diminati *"
          onChange={(interestCategoryIds) => updateForm({ interestCategoryIds })}
          options={references.categories.map(({ id, name }) => ({ id, label: name }))}
          selectedIds={state.interestCategoryIds}
        />
      </FormSection>
    </div>
  );
}

export function EntrepreneurProfileStepTwo({
  errors,
  references,
  state,
  updateForm,
}: StepProps) {
  return (
    <div className="grid gap-24">
      <FormSection
        description="Masukkan rentang dana yang ingin Anda siapkan dalam angka Rupiah."
        title="Budget awal"
      >
        <div className="grid gap-16 sm:grid-cols-2">
          <Input
            error={errors.budgetMin}
            hint="Masukkan angka tanpa titik atau koma."
            id="budget-min"
            inputMode="numeric"
            label="Budget minimum (Rupiah) *"
            onChange={(event) => updateForm({ budgetMin: digitsOnly(event.target.value) })}
            placeholder="5000000"
            type="text"
            value={state.budgetMin}
          />
          <Input
            error={errors.budgetMax}
            hint="Tidak boleh lebih kecil dari budget minimum."
            id="budget-max"
            inputMode="numeric"
            label="Budget maksimum (Rupiah) *"
            onChange={(event) => updateForm({ budgetMax: digitsOnly(event.target.value) })}
            placeholder="10000000"
            type="text"
            value={state.budgetMax}
          />
        </div>
      </FormSection>

      <FormSection
        description="Pilih kelompok pelanggan yang ingin Anda layani."
        title="Target pelanggan"
      >
        <CheckboxGroup
          error={errors.customerSegmentIds}
          id="customer-segments"
          legend="Kelompok pelanggan *"
          onChange={(customerSegmentIds) => updateForm({ customerSegmentIds })}
          options={references.segments.map(({ description, id, name }) => ({
            description,
            id,
            label: name,
          }))}
          selectedIds={state.customerSegmentIds}
        />
      </FormSection>
    </div>
  );
}

export function EntrepreneurProfileStepThree({
  errors,
  references,
  state,
  updateForm,
}: StepProps) {
  return (
    <div className="grid gap-24">
      <FormSection
        description="Pilih cara menjalankan usaha yang paling sesuai dengan kondisi Anda saat ini."
        title="Cara menjalankan usaha"
      >
        <div className="grid gap-20">
          <CheckboxGroup
            error={errors.salesChannelIds}
            id="sales-channels"
            legend="Cara penjualan *"
            onChange={(salesChannelIds) => updateForm({ salesChannelIds })}
            options={references.channels.map(({ id, name }) => ({ id, label: name }))}
            selectedIds={state.salesChannelIds}
          />
          <div className="grid gap-16 sm:grid-cols-2">
            <Select
              error={errors.experienceLevel}
              id="experience-level"
              label="Pengalaman *"
              onChange={(event) => updateForm({ experienceLevel: parseExperienceLevel(event.target.value) })}
              options={experienceOptions}
              value={state.experienceLevel}
            />
            <Select
              error={errors.timeCommitment}
              id="time-commitment"
              label="Komitmen waktu *"
              onChange={(event) => updateForm({ timeCommitment: parseTimeCommitment(event.target.value) })}
              options={timeCommitmentOptions}
              value={state.timeCommitment}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        description="Tambahkan konteks singkat jika sudah ada gambaran awal. Semua bagian di bawah ini bersifat opsional."
        title="Konteks tambahan"
      >
        <div className="grid gap-16">
          <Input
            error={errors.preferredProductType}
            hint="Contoh: kopi susu, frozen dimsum, healthy snack."
            id="preferred-product-type"
            label="Jenis produk yang diminati"
            maxLength={100}
            onChange={(event) => updateForm({ preferredProductType: event.target.value })}
            value={state.preferredProductType}
          />
          <TextareaField
            id="business-objective"
            label="Tujuan bisnis"
            onChange={(event) => updateForm({ businessObjective: event.target.value })}
            value={state.businessObjective}
          />
          <TextareaField
            id="notes"
            label="Catatan tambahan"
            onChange={(event) => updateForm({ notes: event.target.value })}
            value={state.notes}
          />
        </div>
      </FormSection>
    </div>
  );
}

function TextareaField({
  id,
  label,
  onChange,
  value,
}: {
  readonly id: string;
  readonly label: string;
  readonly onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly value: string;
}) {
  return (
    <div className="grid gap-8">
      <label className="text-body-sm font-w540 text-ink-charcoal" htmlFor={id}>
        {label}
      </label>
      <textarea
        className="min-h-32 w-full resize-y rounded-small-buttons border border-stone-gray bg-paper-white px-12 py-12 text-body text-ink-charcoal transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-stone-gray focus:border-royal-violet focus:shadow-subtle"
        id={id}
        onChange={onChange}
        rows={4}
        value={value}
      />
    </div>
  );
}

function parseExperienceLevel(value: string): ExperienceLevel | "" {
  switch (value) {
    case EXPERIENCE_LEVELS.BEGINNER:
    case EXPERIENCE_LEVELS.SOME_EXPERIENCE:
    case EXPERIENCE_LEVELS.EXPERIENCED:
      return value;
    default:
      return "";
  }
}

function parseTimeCommitment(value: string): TimeCommitment | "" {
  switch (value) {
    case TIME_COMMITMENTS.LIMITED:
    case TIME_COMMITMENTS.PART_TIME:
    case TIME_COMMITMENTS.FULL_TIME:
      return value;
    default:
      return "";
  }
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}
