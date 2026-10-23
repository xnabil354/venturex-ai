import type { ChangeEvent } from "react";

import {
  EXPERIENCE_LEVELS,
  TIME_COMMITMENTS,
  type ExperienceLevel,
  type TimeCommitment,
} from "@/profile/validation";
import { Button, Input, RupiahInput, Select, type SelectOption } from "@/components/ui";
import { OTHER_FNB_CATEGORY_CODE } from "@/reference/constants";

import { CheckboxGroup, FormSection } from "./entrepreneur-profile-options";
import { IndonesiaRegionFields } from "./indonesia-region-fields";
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
  const otherCategory = references.categories.find(
    ({ code }) => code === OTHER_FNB_CATEGORY_CODE,
  );

  return (
    <div className="grid gap-32">
      <FormSection
        description="Pilih provinsi, kota/kabupaten, kecamatan, lalu kelurahan. Masukkan alamat jalan setelahnya."
        title="Lokasi utama"
      >
        <div className="grid gap-24">
          <IndonesiaRegionFields
            errors={errors}
            onChange={updateForm}
            values={{
              province: state.province,
              provinceId: state.provinceId,
              city: state.city,
              cityId: state.cityId,
              district: state.district,
              districtId: state.districtId,
              subdistrict: state.subdistrict,
              subdistrictId: state.subdistrictId,
            }}
          />
          <Input
            autoComplete="street-address"
            error={errors.locationText}
            hint="Masukkan nama jalan, area, atau patokan agar lokasi usaha lebih spesifik."
            id="location-text"
            label="Alamat detail *"
            maxLength={255}
            onChange={(event) => updateForm({ locationText: event.target.value })}
            placeholder="Jl. Melati No. 12, Menteng"
            required
            value={state.locationText}
          />
        </div>
      </FormSection>

      <FormSection
        description="Pilih satu atau lebih kategori yang ingin Anda pertimbangkan. Jika belum tersedia, pilih Lainnya dan tuliskan jenis usaha Anda."
        title="Minat F&B"
      >
        <CheckboxGroup
          error={errors.interestCategoryIds}
          id="interest-categories"
          legend="Kategori yang diminati *"
          onChange={(interestCategoryIds) => updateForm({ interestCategoryIds })}
          otherOption={
            otherCategory
              ? {
                  checked: state.interestCategoryIds.includes(otherCategory.id),
                  error: errors.preferredProductType,
                  onCheckedChange: (checked) =>
                    updateForm({
                      interestCategoryIds: checked
                        ? [...new Set([...state.interestCategoryIds, otherCategory.id])]
                        : state.interestCategoryIds.filter((id) => id !== otherCategory.id),
                    }),
                  onValueChange: (preferredProductType) =>
                    updateForm({ preferredProductType }),
                  value: state.preferredProductType,
                }
              : undefined
          }
          options={references.categories
            .filter(({ code }) => code !== OTHER_FNB_CATEGORY_CODE)
            .map(({ id, name }) => ({ id, label: name }))}
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
    <div className="grid gap-32">
      <FormSection
        description="Masukkan rentang dana yang ingin Anda siapkan dalam angka Rupiah."
        title="Budget awal"
      >
        <div className="grid gap-16 sm:grid-cols-2">
          <RupiahInput
            error={errors.budgetMin}
            hint="Pemisah ribuan ditambahkan otomatis."
            id="budget-min"
            label="Budget minimum (Rupiah) *"
            onValueChange={(budgetMin) => updateForm({ budgetMin })}
            placeholder="5.000.000"
            value={state.budgetMin}
          />
          <RupiahInput
            error={errors.budgetMax}
            hint="Tidak boleh lebih kecil dari budget minimum."
            id="budget-max"
            label="Budget maksimum (Rupiah) *"
            onValueChange={(budgetMax) => updateForm({ budgetMax })}
            placeholder="10.000.000"
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
  const otherCategory = references.categories.find(
    ({ code }) => code === OTHER_FNB_CATEGORY_CODE,
  );
  const hasOtherCategory = Boolean(
    otherCategory && state.interestCategoryIds.includes(otherCategory.id),
  );

  return (
    <div className="grid gap-32">
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
        description="Tentukan produk untuk eksplorasi tren. Tujuan dan catatan boleh dikosongkan."
        title="Arah usaha"
      >
        <div className="grid gap-16">
          {hasOtherCategory ? null : (
            <Input
              error={errors.preferredProductType}
              hint="Contoh: kopi susu, frozen dimsum, healthy snack."
              id="preferred-product-type"
              label="Produk yang ingin dieksplorasi *"
              required
              maxLength={100}
              onChange={(event) => updateForm({ preferredProductType: event.target.value })}
              value={state.preferredProductType}
            />
          )}
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
        className="min-h-32 w-full resize-y rounded-small-buttons border border-stone-gray bg-paper-white px-12 py-12 text-body text-ink-charcoal transition-[border-color,border-width] duration-200 ease-out placeholder:text-stone-gray focus:border-2 focus:border-royal-violet focus-visible:outline-none"
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
