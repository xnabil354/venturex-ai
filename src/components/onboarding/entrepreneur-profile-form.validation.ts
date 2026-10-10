import {
  entrepreneurProfileSchema,
  type EntrepreneurProfileInput,
  type ExperienceLevel,
  type TimeCommitment,
} from "../../profile/validation";

export type EntrepreneurFormStep = 1 | 2 | 3;

export type EntrepreneurFormState = {
  readonly locationText: string;
  readonly city: string;
  readonly province: string;
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
    province: "",
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
  profile: EntrepreneurProfileInput,
): EntrepreneurFormState {
  return {
    locationText: profile.location.text,
    city: profile.location.city ?? "",
    province: profile.location.province ?? "",
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

function getPayloadErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join(".") || "form";
    errors[field] ??= issue.message;
  }
  return errors;
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
        errors.locationText = "Masukkan lokasi utama yang akan menjadi konteks usaha.";
      } else if (location.length > 255) {
        errors.locationText = "Lokasi utama maksimal 255 karakter.";
      }
      if (state.city.length > 120) {
        errors.city = "Kota/Kabupaten maksimal 120 karakter.";
      }
      if (state.province.length > 120) {
        errors.province = "Provinsi maksimal 120 karakter.";
      }
      if (state.interestCategoryIds.length === 0) {
        errors.interestCategoryIds = "Pilih minimal satu kategori F&B.";
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
      if (state.preferredProductType.trim().length > 100) {
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
    return { success: false, errors: getPayloadErrors(result.error.issues) };
  }

  return {
    success: true,
    data: {
      ...result.data,
      location: {
        text: result.data.location.text,
        city: result.data.location.city,
        province: result.data.location.province,
      },
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected entrepreneur form step: ${String(value)}`);
}
