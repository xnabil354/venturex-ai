import { z } from "zod";

import {
  businessProfileSchema,
  normalizeProductName,
  type BusinessProfileInput,
} from "../../profile/business-validation";

export type BusinessFormStep = 1 | 2 | 3;

export type BusinessProductForm = {
  readonly categoryId: string;
  readonly key: string;
  readonly name: string;
  readonly price: string;
};

export type BusinessFormState = {
  readonly averagePriceMax: string;
  readonly averagePriceMin: string;
  readonly businessCategoryId: string;
  readonly businessDescription: string;
  readonly businessName: string;
  readonly city: string;
  readonly cityId: string;
  readonly customerSegmentIds: readonly string[];
  readonly district: string;
  readonly districtId: string;
  readonly locationText: string;
  readonly notes: string;
  readonly products: readonly BusinessProductForm[];
  readonly province: string;
  readonly provinceId: string;
  readonly salesChannelIds: readonly string[];
  readonly subdistrict: string;
  readonly subdistrictId: string;
};

type PayloadResult =
  | { readonly data: BusinessProfileInput; readonly success: true }
  | { readonly errors: Readonly<Record<string, string>>; readonly success: false };

const uuidSchema = z.string().uuid();

export function createInitialBusinessFormState(): BusinessFormState {
  return {
    averagePriceMax: "",
    averagePriceMin: "",
    businessCategoryId: "",
    businessDescription: "",
    businessName: "",
    city: "",
    cityId: "",
    customerSegmentIds: [],
    district: "",
    districtId: "",
    locationText: "",
    notes: "",
    products: [createInitialBusinessProduct("product-1")],
    province: "",
    provinceId: "",
    salesChannelIds: [],
    subdistrict: "",
    subdistrictId: "",
  };
}

export function createInitialBusinessProduct(key: string): BusinessProductForm {
  return { categoryId: "", key, name: "", price: "" };
}

export function toBusinessFormState(profile: BusinessProfileInput): BusinessFormState {
  return {
    averagePriceMax: String(profile.averagePrice.max),
    averagePriceMin: String(profile.averagePrice.min),
    businessCategoryId: profile.businessCategoryId,
    businessDescription: profile.businessDescription ?? "",
    businessName: profile.businessName,
    city: profile.location.city ?? "",
    cityId: "",
    customerSegmentIds: profile.customerSegmentIds,
    district: profile.location.district ?? "",
    districtId: "",
    locationText: profile.location.text,
    notes: profile.notes ?? "",
    products: profile.products.map((product, index) => ({
      categoryId: product.categoryId ?? "",
      key: `product-${index + 1}`,
      name: product.name,
      price: product.price === null ? "" : String(product.price),
    })),
    province: profile.location.province ?? "",
    provinceId: "",
    salesChannelIds: profile.salesChannelIds,
    subdistrict: profile.location.subdistrict ?? "",
    subdistrictId: "",
  };
}

export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/gu, "");
}

function parseAmount(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/u.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? amount : null;
}

function getPayloadErrors(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join(".") || "form";
    errors[field] ??= issue.message;
  }
  return errors;
}

function validateProduct(product: BusinessProductForm, index: number): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = normalizeProductName(product.name);
  if (!name) {
    errors[`products.${index}.name`] = "Masukkan nama produk.";
  } else if (name.length > 180) {
    errors[`products.${index}.name`] = "Nama produk maksimal 180 karakter.";
  }

  if (product.categoryId && !uuidSchema.safeParse(product.categoryId).success) {
    errors[`products.${index}.categoryId`] = "Pilih kategori produk yang tersedia.";
  }

  if (product.price.trim() && parseAmount(product.price) === null) {
    errors[`products.${index}.price`] = "Masukkan harga produk dalam angka Rupiah.";
  }

  return errors;
}

export function validateStep(
  step: BusinessFormStep,
  state: BusinessFormState,
): Readonly<Record<string, string>> {
  switch (step) {
    case 1: {
      const errors: Record<string, string> = {};
      if (!state.businessName.trim()) {
        errors.businessName = "Masukkan nama bisnis Anda.";
      } else if (state.businessName.trim().length > 180) {
        errors.businessName = "Nama bisnis maksimal 180 karakter.";
      }
      if (!state.businessCategoryId) {
        errors.businessCategoryId = "Pilih kategori bisnis.";
      }
      if (!state.locationText.trim()) {
        errors.locationText = "Masukkan lokasi bisnis.";
      } else if (state.locationText.trim().length > 255) {
        errors.locationText = "Lokasi bisnis maksimal 255 karakter.";
      }
      if (state.city.trim().length > 120) {
        errors.city = "Kota atau kabupaten maksimal 120 karakter.";
      }
      if (state.province.trim().length > 120) {
        errors.province = "Provinsi maksimal 120 karakter.";
      }
      if (state.district.trim().length > 120) {
        errors.district = "Kecamatan maksimal 120 karakter.";
      }
      if (state.subdistrict.trim().length > 120) {
        errors.subdistrict = "Kelurahan maksimal 120 karakter.";
      }
      if (state.businessDescription.trim().length > 1000) {
        errors.businessDescription = "Deskripsi bisnis maksimal 1000 karakter.";
      }
      return errors;
    }
    case 2: {
      const errors: Record<string, string> = {};
      if (state.products.length < 1) {
        errors.products = "Tambahkan minimal satu produk.";
      }
      if (state.products.length > 20) {
        errors.products = "Maksimal 20 produk dapat disimpan.";
      }
      const productNames = new Map<string, number>();
      for (const [index, product] of state.products.entries()) {
        Object.assign(errors, validateProduct(product, index));
        const normalizedName = normalizeProductName(product.name).toLowerCase();
        if (!normalizedName) {
          continue;
        }
        const previousIndex = productNames.get(normalizedName);
        if (previousIndex !== undefined) {
          const message = "Nama produk tidak boleh duplikat setelah normalisasi.";
          errors[`products.${index}.name`] = message;
          errors[`products.${previousIndex}.name`] ??= message;
        } else {
          productNames.set(normalizedName, index);
        }
      }

      const minimum = parseAmount(state.averagePriceMin);
      const maximum = parseAmount(state.averagePriceMax);
      if (minimum === null) {
        errors.averagePriceMin = "Masukkan harga minimum dalam angka Rupiah.";
      }
      if (maximum === null) {
        errors.averagePriceMax = "Masukkan harga maksimum dalam angka Rupiah.";
      }
      if (minimum !== null && maximum !== null && maximum < minimum) {
        errors.averagePriceMax = "Harga maksimum harus lebih besar atau sama dengan minimum.";
      }
      return errors;
    }
    case 3: {
      const errors: Record<string, string> = {};
      if (state.customerSegmentIds.length === 0) {
        errors.customerSegmentIds = "Pilih minimal satu kelompok pelanggan.";
      }
      if (state.salesChannelIds.length === 0) {
        errors.salesChannelIds = "Pilih minimal satu cara penjualan.";
      }
      if (state.notes.trim().length > 2000) {
        errors.notes = "Catatan maksimal 2000 karakter.";
      }
      return errors;
    }
    default:
      return assertNever(step);
  }
}

export function toBusinessProfilePayload(state: BusinessFormState): PayloadResult {
  const result = businessProfileSchema.safeParse({
    averagePrice: {
      max: parseAmount(state.averagePriceMax) ?? state.averagePriceMax,
      min: parseAmount(state.averagePriceMin) ?? state.averagePriceMin,
    },
    businessCategoryId: state.businessCategoryId,
    businessDescription: state.businessDescription,
    businessName: state.businessName,
    customerSegmentIds: state.customerSegmentIds,
    location: {
      city: state.city,
      district: state.district,
      province: state.province,
      subdistrict: state.subdistrict,
      text: state.locationText,
    },
    notes: state.notes,
    products: state.products.map((product) => ({
      categoryId: product.categoryId || null,
      name: product.name,
      price: product.price.trim() ? parseAmount(product.price) ?? product.price : null,
    })),
    salesChannelIds: state.salesChannelIds,
  });

  if (!result.success) {
    return { errors: getPayloadErrors(result.error.issues), success: false };
  }

  return { data: result.data, success: true };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected business form step: ${String(value)}`);
}
