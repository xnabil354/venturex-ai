import type { ChangeEvent } from "react";

import { Button, Input, Select, type SelectOption } from "@/components/ui";
import { cx } from "@/lib/cx";

import { CheckboxGroup, FormSection } from "./entrepreneur-profile-options";
import { BusinessProductEditor } from "./business-product-editor";
import type { BusinessFormErrors, ReferenceData } from "./business-profile-form.types";
import { digitsOnly, type BusinessFormState } from "./business-profile-form.validation";

type UpdateForm = (patch: Partial<BusinessFormState>) => void;

type StepProps = {
  readonly errors: BusinessFormErrors;
  readonly references: ReferenceData;
  readonly state: BusinessFormState;
  readonly updateForm: UpdateForm;
};

export function BusinessProfileStepOne({ errors, references, state, updateForm }: StepProps) {
  const categoryOptions: readonly SelectOption[] = [
    { disabled: true, label: "Pilih kategori", value: "" },
    ...references.categories.map(({ id, name }) => ({ label: name, value: id })),
  ];

  return (
    <div className="grid gap-24">
      <FormSection
        description="Nama dan kategori bisnis membantu VENTUREX menyiapkan konteks peluang yang sesuai."
        title="Identitas bisnis"
      >
        <div className="grid gap-16">
          <Input
            autoComplete="organization"
            error={errors.businessName}
            hint="Nama dagang atau nama usaha yang dikenal pelanggan."
            id="business-name"
            label="Nama bisnis *"
            maxLength={180}
            onChange={(event) => updateForm({ businessName: event.target.value })}
            placeholder="Kopi Nusantara"
            value={state.businessName}
          />
          <Select
            error={errors.businessCategoryId}
            id="business-category"
            label="Kategori bisnis *"
            onChange={(event) => updateForm({ businessCategoryId: event.target.value })}
            options={categoryOptions}
            value={state.businessCategoryId}
          />
          <Input
            autoComplete="address-level2"
            error={errors.locationText}
            hint="Contoh: Jakarta Pusat. Tidak perlu alamat lengkap."
            id="business-location"
            label="Lokasi bisnis *"
            maxLength={255}
            onChange={(event) => updateForm({ locationText: event.target.value })}
            placeholder="Jakarta Pusat"
            value={state.locationText}
          />
          <div className="grid gap-16 sm:grid-cols-2">
            <Input
              autoComplete="address-level2"
              error={errors.city}
              id="business-city"
              label="Kota/Kabupaten"
              maxLength={120}
              onChange={(event) => updateForm({ city: event.target.value })}
              placeholder="Jakarta Pusat"
              value={state.city}
            />
            <Input
              autoComplete="address-level1"
              error={errors.province}
              id="business-province"
              label="Provinsi"
              maxLength={120}
              onChange={(event) => updateForm({ province: event.target.value })}
              placeholder="DKI Jakarta"
              value={state.province}
            />
          </div>
          <TextareaField
            error={errors.businessDescription}
            hint="Maksimal 1000 karakter. Tidak perlu format khusus."
            id="business-description"
            label="Deskripsi bisnis"
            maxLength={1000}
            onChange={(event) => updateForm({ businessDescription: event.target.value })}
            value={state.businessDescription}
          />
        </div>
      </FormSection>
    </div>
  );
}

export function BusinessProfileStepTwo({ errors, references, state, updateForm }: StepProps) {
  return (
    <div className="grid gap-24">
      <FormSection
        description="Masukkan produk yang Anda jual saat ini. Anda dapat menambahkan hingga 20 produk."
        title="Produk dan harga"
      >
        <BusinessProductEditor
          categories={references.categories}
          errors={errors}
          onChange={(products) => updateForm({ products })}
          products={state.products}
        />
      </FormSection>
      <FormSection
        description="Masukkan rentang harga rata-rata produk Anda dalam angka Rupiah."
        title="Harga rata-rata"
      >
        <div className="grid gap-16 sm:grid-cols-2">
          <Input
            error={errors.averagePriceMin}
            hint="Masukkan angka tanpa titik atau koma."
            id="average-price-min"
            inputMode="numeric"
            label="Harga minimum (Rupiah) *"
            onChange={(event) => updateForm({ averagePriceMin: digitsOnly(event.target.value) })}
            placeholder="20000"
            type="text"
            value={state.averagePriceMin}
          />
          <Input
            error={errors.averagePriceMax}
            hint="Tidak boleh lebih kecil dari harga minimum."
            id="average-price-max"
            inputMode="numeric"
            label="Harga maksimum (Rupiah) *"
            onChange={(event) => updateForm({ averagePriceMax: digitsOnly(event.target.value) })}
            placeholder="40000"
            type="text"
            value={state.averagePriceMax}
          />
        </div>
      </FormSection>
    </div>
  );
}

export function BusinessProfileStepThree({ errors, references, state, updateForm }: StepProps) {
  return (
    <div className="grid gap-24">
      <FormSection
        description="Pilih kelompok pelanggan yang Anda layani saat ini."
        title="Pelanggan"
      >
        <CheckboxGroup
          error={errors.customerSegmentIds}
          id="business-customer-segments"
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
      <FormSection
        description="Pilih cara Anda menjual produk saat ini. Anda dapat memilih lebih dari satu."
        title="Cara menjual"
      >
        <CheckboxGroup
          error={errors.salesChannelIds}
          id="business-sales-channels"
          legend="Cara penjualan *"
          onChange={(salesChannelIds) => updateForm({ salesChannelIds })}
          options={references.channels.map(({ id, name }) => ({ id, label: name }))}
          selectedIds={state.salesChannelIds}
        />
      </FormSection>
      <FormSection
        description="Tambahkan catatan singkat jika diperlukan. Catatan tidak mengubah versi profil."
        title="Catatan tambahan"
      >
        <TextareaField
          error={errors.notes}
          hint="Maksimal 2000 karakter."
          id="business-notes"
          label="Catatan"
          maxLength={2000}
          onChange={(event) => updateForm({ notes: event.target.value })}
          value={state.notes}
        />
      </FormSection>
    </div>
  );
}

type TextareaFieldProps = {
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly id: string;
  readonly label: string;
  readonly maxLength: number;
  readonly onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  readonly value: string;
};

function TextareaField({ error, hint, id, label, maxLength, onChange, value }: TextareaFieldProps) {
  const describedBy = error ? (hint ? `${id}-hint ${id}-error` : `${id}-error`) : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-8">
      <label className="text-body-sm font-w540 text-ink-charcoal" htmlFor={id}>
        {label}
      </label>
      <textarea
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cx(
          "min-h-32 w-full resize-y rounded-small-buttons border bg-paper-white px-12 py-12 text-body text-ink-charcoal transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-stone-gray focus:border-royal-violet focus:shadow-subtle",
          error ? "border-midnight-wine" : "border-stone-gray",
        )}
        id={id}
        maxLength={maxLength}
        onChange={onChange}
        rows={4}
        value={value}
      />
      {hint ? <p className="text-body-sm text-stone-gray" id={`${id}-hint`}>{hint}</p> : null}
      {error ? <p className="text-body-sm font-w540 text-midnight-wine" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}
