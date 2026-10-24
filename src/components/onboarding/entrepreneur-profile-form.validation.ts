import {
  entrepreneurProfileSchema,
  type EntrepreneurProfileEditValues,
  type EntrepreneurProfileInput,
  type ExperienceLevel,
  type TimeCommitment,
} from "../../profile/validation";
import { OTHER_FNB_CATEGORY_ID } from "../../reference/constants";
import { fieldErrorsFromIssues } from "../../lib/field-errors";

export type EntrepreneurFormStep = 1 | 2 | 3;

export type EntrepreneurFormState = {
  readonly locationText: string;
  readonly city: string;
  readonly cityId: string;
  readonly province: string;
  readonly provinceId: string;
  readonly district: string;
  readonly districtId: string;
  readonly subdistrict: string;
  readonly subdistrictId: string;
  readonly interestCategoryIds: readonly string[];
  readonly budgetMin: string;
  readonly budgetMax: string;
  readonly customerSegmentIds: readonly string[];
  readonly salesChannelIds: readonly string[];
  readonly experienceLevel: ExperienceLevel | "";
  readonly timeCommitment: TimeCommitment | "";
  readonly preferredProductType: string;
  readonly businessObjective: string;
  readonly notes: string;
};

export type EntrepreneurProfilePayload = Omit<EntrepreneurProfileInput, "location"> & {
  readonly location: Omit<EntrepreneurProfileInput["location"], "countryCode">;
};

type PayloadResult =
  | { readonly success: true; readonly data: EntrepreneurProfilePayload }
  | { readonly success: false; readonly errors: Readonly<Record<string, string>> };

export function createInitialEntrepreneurFormState(): EntrepreneurFormState {
  return {
    locationText: "",
    city: "",
    cityId: "",
    province: "",
    provinceId: "",
    district: "",
    districtId: "",
    subdistrict: "",
    subdistrictId: "",
    interestCategoryIds: [],
    budgetMin: "",
    budgetMax: "",
    customerSegmentIds: [],
    salesChannelIds: [],
    experienceLevel: "",
    timeCommitment: "",
    preferredProductType: "",
    businessObjective: "",
    notes: "",
  };
}

export function toEntrepreneurFormState(
  profile: EntrepreneurProfileEditValues,
): EntrepreneurFormState {
  return {
    locationText: profile.location.text,
    city: profile.location.city ?? "",
    cityId: "",
    province: profile.location.province ?? "",
    provinceId: "",
    district: profile.location.district ?? "",
    districtId: "",
    subdistrict: profile.location.subdistrict ?? "",
    subdistrictId: "",
    interestCategoryIds: profile.interestCategoryIds,
    budgetMin: String(profile.budget.min),
    budgetMax: String(profile.budget.max),
    customerSegmentIds: profile.customerSegmentIds,
    salesChannelIds: profile.salesChannelIds,
    experienceLevel: profile.experienceLevel,
    timeCommitment: profile.timeCommitment,
    preferredProductType: profile.preferredProductType ?? "",
    businessObjective: profile.businessObjective ?? "",
    notes: profile.notes ?? "",
  };
}

function parseAmount(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function validateStep(
  step: EntrepreneurFormStep,
  state: EntrepreneurFormState,
): Readonly<Record<string, string>> {
  switch (step) {
    case 1: {
      const errors: Record<string, string> = {};
      const location = state.locationText.trim();
      if (!location) {
        errors.locationText = "Masukkan alamat detail lokasi usaha.";
      } else if (location.length > 255) {
        errors.locationText = "Alamat detail maksimal 255 karakter.";
      }
      if (!state.provinceId || !state.province) {
        errors.province = "Pilih provinsi.";
      }
      if (!state.cityId || !state.city) {
        errors.city = "Pilih kota atau kabupaten.";
      }
      if (!state.districtId || !state.district) {
        errors.district = "Pilih kecamatan.";
      }
      if (!state.subdistrictId || !state.subdistrict) {
        errors.subdistrict = "Pilih kelurahan.";
      }
      if (state.city.length > 120) {
        errors.city = "Kota/Kabupaten maksimal 120 karakter.";
      }
      if (state.province.length > 120) {
        errors.province = "Provinsi maksimal 120 karakter.";
      }
      if (state.district.length > 120) {
        errors.district = "Kecamatan maksimal 120 karakter.";
      }
      if (state.subdistrict.length > 120) {
        errors.subdistrict = "Kelurahan maksimal 120 karakter.";
      }
      if (state.interestCategoryIds.length === 0) {
        errors.interestCategoryIds = "Pilih minimal satu kategori F&B.";
      }
      if (state.interestCategoryIds.includes(OTHER_FNB_CATEGORY_ID)) {
        if (!state.preferredProductType.trim()) {
          errors.preferredProductType = "Tuliskan jenis usaha lainnya.";
        } else if (state.preferredProductType.trim().length > 100) {
          errors.preferredProductType = "Jenis usaha maksimal 100 karakter.";
        }
      }
      return errors;
    }
    case 2: {
      const errors: Record<string, string> = {};
      const minimum = parseAmount(state.budgetMin);
      const maximum = parseAmount(state.budgetMax);
      if (minimum === null) {
        errors.budgetMin = "Masukkan budget minimum dalam angka Rupiah.";
      }
      if (maximum === null) {
        errors.budgetMax = "Masukkan budget maksimum dalam angka Rupiah.";
      }
      if (minimum !== null && maximum !== null && maximum < minimum) {
        errors.budgetMax = "Budget maksimum harus lebih besar atau sama dengan minimum.";
      }
      if (state.customerSegmentIds.length === 0) {
        errors.customerSegmentIds = "Pilih minimal satu target pelanggan.";
      }
      return errors;
    }
    case 3: {
      const errors: Record<string, string> = {};
      if (state.salesChannelIds.length === 0) {
        errors.salesChannelIds = "Pilih minimal satu cara penjualan.";
      }
      if (!state.experienceLevel) {
        errors.experienceLevel = "Pilih tingkat pengalaman Anda.";
      }
      if (!state.timeCommitment) {
        errors.timeCommitment = "Pilih komitmen waktu Anda.";
      }
      if (!state.preferredProductType.trim()) {
        errors.preferredProductType = "Tuliskan produk yang ingin Anda eksplorasi.";
      } else if (state.preferredProductType.trim().length > 100) {
        errors.preferredProductType = "Jenis produk maksimal 100 karakter.";
      }
      return errors;
    }
    default:
      return assertNever(step);
  }
}

export function toEntrepreneurProfilePayload(
  state: EntrepreneurFormState,
): PayloadResult {
  const result = entrepreneurProfileSchema.safeParse({
    location: {
      text: state.locationText,
      city: state.city,
      province: state.province,
      district: state.district,
      subdistrict: state.subdistrict,
    },
    budget: {
      min: parseAmount(state.budgetMin),
      max: parseAmount(state.budgetMax),
    },
    experienceLevel: state.experienceLevel,
    timeCommitment: state.timeCommitment,
    interestCategoryIds: state.interestCategoryIds,
    customerSegmentIds: state.customerSegmentIds,
    salesChannelIds: state.salesChannelIds,
    preferredProductType: state.preferredProductType,
    businessObjective: state.businessObjective,
    notes: state.notes,
  });

  if (!result.success) {
    return { success: false, errors: fieldErrorsFromIssues(result.error.issues) };
  }

  return {
    success: true,
    data: {
      ...result.data,
      location: {
        text: result.data.location.text,
        city: result.data.location.city,
        province: result.data.location.province,
        district: result.data.location.district,
        subdistrict: result.data.location.subdistrict,
      },
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected entrepreneur form step: ${String(value)}`);
}
