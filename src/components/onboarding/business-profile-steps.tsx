import type { ChangeEvent } from "react";

import { Button, Input, RupiahInput, Select, type SelectOption } from "@/components/ui";
import { cx } from "@/lib/cx";

import { CheckboxGroup, FormSection } from "./entrepreneur-profile-options";
import { BusinessProductEditor } from "./business-product-editor";
import type { BusinessFormErrors, ReferenceData } from "./business-profile-form.types";
import { type BusinessFormState } from "./business-profile-form.validation";
import { IndonesiaRegionFields } from "./indonesia-region-fields";

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
    <div className="grid gap-32">
      <FormSection
        description="Nama dan kategori bisnis membantu VENTUREX menyiapkan konteks peluang yang sesuai."
        title="Identitas bisnis"
      >
        <div className="grid gap-24">
          <div className="grid gap-12">
            <h3 className="text-label-bold font-w540 leading-label-bold text-ink-charcoal">
              Profil usaha
            </h3>
            <div className="grid gap-16 sm:grid-cols-2 sm:items-start">
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
            </div>
          </div>

          <div className="grid gap-12 border-t border-soft-mist pt-24">
            <div className="grid gap-4">
              <h3 className="text-label-bold font-w540 leading-label-bold text-ink-charcoal">
                Area usaha
              </h3>
              <p className="text-body-sm leading-body-sm text-stone-gray">
                Wilayah dapat dipilih berurutan dari provinsi hingga kelurahan. Alamat detail wajib diisi.
              </p>
            </div>
            <div className="grid gap-16 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <IndonesiaRegionFields
                  errors={errors}
                  onChange={updateForm}
                  required={false}
                  values={{
                    city: state.city,
                    cityId: state.cityId,
                    district: state.district,
                    districtId: state.districtId,
                    province: state.province,
                    provinceId: state.provinceId,
                    subdistrict: state.subdistrict,
                    subdistrictId: state.subdistrictId,
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  autoComplete="street-address"
                  error={errors.locationText}
                  hint="Contoh: Jl. Melati No. 12, Menteng."
                  id="business-location"
                  label="Alamat detail *"
                  maxLength={255}
                  onChange={(event) => updateForm({ locationText: event.target.value })}
                  placeholder="Nama jalan, nomor bangunan, atau patokan lokasi"
                  value={state.locationText}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-12 border-t border-soft-mist pt-24">
            <h3 className="text-label-bold font-w540 leading-label-bold text-ink-charcoal">
              Gambaran usaha
            </h3>
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
        </div>
      </FormSection>
    </div>
  );
}

export function BusinessProfileStepTwo({ errors, references, state, updateForm }: StepProps) {
  return (
    <div className="grid gap-32">
      <FormSection
        description="Tambahkan produk yang dijual dan rentang harga rata-rata dalam Rupiah. Anda dapat menambahkan hingga 20 produk."
        title="Produk dan harga"
      >
        <div className="grid gap-24">
          <div className="grid gap-16">
            <h3 className="text-label-bold font-w540 leading-label-bold text-ink-charcoal">
              Daftar produk
            </h3>
            <BusinessProductEditor
              categories={references.categories}
              errors={errors}
              onChange={(products) => updateForm({ products })}
              products={state.products}
            />
          </div>
          <div className="grid gap-16 border-t border-soft-mist pt-24">
            <div className="grid gap-4">
              <h3 className="text-label-bold font-w540 leading-label-bold text-ink-charcoal">
                Harga rata-rata
              </h3>
              <p className="text-body-sm leading-body-sm text-stone-gray">
                Masukkan rentang harga rata-rata produk Anda dalam angka Rupiah.
              </p>
            </div>
            <div className="grid gap-16 sm:grid-cols-2 sm:items-start">
              <RupiahInput
                error={errors.averagePriceMin}
                hint="Pemisah ribuan ditambahkan otomatis."
                id="average-price-min"
                label="Harga minimum (Rupiah) *"
                onValueChange={(averagePriceMin) => updateForm({ averagePriceMin })}
                placeholder="20.000"
                value={state.averagePriceMin}
              />
              <RupiahInput
                error={errors.averagePriceMax}
                hint="Tidak boleh lebih kecil dari harga minimum."
                id="average-price-max"
                label="Harga maksimum (Rupiah) *"
                onValueChange={(averagePriceMax) => updateForm({ averagePriceMax })}
                placeholder="40.000"
                value={state.averagePriceMax}
              />
            </div>
          </div>
        </div>
      </FormSection>
    </div>
  );
}

export function BusinessProfileStepThree({ errors, references, state, updateForm }: StepProps) {
  return (
    <div className="grid gap-32">
      <FormSection
        description="Pilih kelompok pelanggan yang Anda layani dan satu atau lebih cara Anda menjual produk saat ini."
        title="Pelanggan dan cara menjual"
      >
        <div className="grid gap-24 lg:grid-cols-2 lg:gap-32">
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
          <div className="border-t border-soft-mist pt-24 lg:border-l lg:border-t-0 lg:pl-24 lg:pt-0">
            <CheckboxGroup
              error={errors.salesChannelIds}
              id="business-sales-channels"
              legend="Cara penjualan *"
              onChange={(salesChannelIds) => updateForm({ salesChannelIds })}
              options={references.channels.map(({ id, name }) => ({ id, label: name }))}
              selectedIds={state.salesChannelIds}
            />
          </div>
        </div>
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
          "min-h-32 w-full resize-y rounded-small-buttons border bg-paper-white px-12 py-12 text-body text-ink-charcoal transition-[border-color,border-width] duration-200 ease-out placeholder:text-stone-gray focus:border-2 focus:border-royal-violet focus-visible:outline-none",
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
