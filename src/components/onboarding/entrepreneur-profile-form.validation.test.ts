import { describe, expect, it } from "vitest";

import {
  createInitialEntrepreneurFormState,
  toEntrepreneurFormState,
  toEntrepreneurProfilePayload,
  validateStep,
} from "./entrepreneur-profile-form.validation";

describe("entrepreneur profile form validation", () => {
  it("prefills all editable fields from the persisted profile values", () => {
    expect(toEntrepreneurFormState({
      location: {
        text: "Jl. Asia Afrika No. 10, Bandung",
        city: "Bandung",
        province: "Jawa Barat",
        district: null,
        subdistrict: null,
        countryCode: "ID",
      },
      budget: { min: 2_000_000, max: 8_000_000 },
      experienceLevel: "SOME_EXPERIENCE",
      timeCommitment: "FULL_TIME",
      interestCategoryIds: ["10000000-0000-4000-8000-000000000001"],
      customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
      salesChannelIds: ["30000000-0000-4000-8000-000000000001"],
      preferredProductType: null,
      businessObjective: "Menguji usaha makanan.",
      notes: null,
    })).toEqual({
      locationText: "Jl. Asia Afrika No. 10, Bandung",
      city: "Bandung",
      cityId: "",
      province: "Jawa Barat",
      provinceId: "",
      district: "",
      districtId: "",
      subdistrict: "",
      subdistrictId: "",
      interestCategoryIds: ["10000000-0000-4000-8000-000000000001"],
      budgetMin: "2000000",
      budgetMax: "8000000",
      customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
      salesChannelIds: ["30000000-0000-4000-8000-000000000001"],
      experienceLevel: "SOME_EXPERIENCE",
      timeCommitment: "FULL_TIME",
      preferredProductType: "",
      businessObjective: "Menguji usaha makanan.",
      notes: "",
    });
  });

  it("blocks step one until location and an interest are present", () => {
    // Given
    const state = createInitialEntrepreneurFormState();

    // When
    const errors = validateStep(1, state);

    // Then
    expect(errors).toMatchObject({
      locationText: expect.any(String),
      province: expect.any(String),
      city: expect.any(String),
      district: expect.any(String),
      subdistrict: expect.any(String),
      interestCategoryIds: expect.any(String),
    });
  });

  it("rejects a budget maximum below the minimum", () => {
    // Given
    const state = {
      ...createInitialEntrepreneurFormState(),
      locationText: "Jakarta Pusat",
      interestCategoryIds: ["10000000-0000-4000-8000-000000000001"],
      budgetMin: "10000000",
      budgetMax: "5000000",
      customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
    };

    // When
    const errors = validateStep(2, state);

    // Then
    expect(errors.budgetMax).toBe("Budget maksimum harus lebih besar atau sama dengan minimum.");
  });

  it("validates region name lengths to match the persisted contract", () => {
    const state = {
      ...createInitialEntrepreneurFormState(),
      locationText: "Jakarta",
      city: "Kota".repeat(41),
      cityId: "city-id",
      province: "Provinsi".repeat(16),
      provinceId: "province-id",
      district: "Menteng",
      districtId: "district-id",
      subdistrict: "Pegangsaan",
      subdistrictId: "subdistrict-id",
      interestCategoryIds: ["10000000-0000-4000-8000-000000000001"],
    };

    expect(validateStep(1, state)).toMatchObject({
      city: "Kota/Kabupaten maksimal 120 karakter.",
      province: "Provinsi maksimal 120 karakter.",
    });
  });

  it("maps the complete form to the backend payload without client-only fields", () => {
    // Given
    const state = {
      ...createInitialEntrepreneurFormState(),
      locationText: "Jl. Menteng Raya No. 12, Jakarta Pusat",
      city: "Jakarta Pusat",
      cityId: "city-id",
      province: "DKI Jakarta",
      provinceId: "province-id",
      district: "Menteng",
      districtId: "district-id",
      subdistrict: "Pegangsaan",
      subdistrictId: "subdistrict-id",
      interestCategoryIds: ["10000000-0000-4000-8000-000000000001"],
      budgetMin: "5000000",
      budgetMax: "10000000",
      customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
      salesChannelIds: ["30000000-0000-4000-8000-000000000001"],
      experienceLevel: "BEGINNER" as const,
      timeCommitment: "PART_TIME" as const,
      preferredProductType: "Kopi susu",
      businessObjective: "Menguji konsep usaha.",
      notes: "Mulai dari skala kecil.",
    };

    // When
    const result = toEntrepreneurProfilePayload(state);

    // Then
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        location: {
          text: "Jl. Menteng Raya No. 12, Jakarta Pusat",
          city: "Jakarta Pusat",
          province: "DKI Jakarta",
          district: "Menteng",
          subdistrict: "Pegangsaan",
        },
        budget: { min: 5000000, max: 10000000 },
        experienceLevel: "BEGINNER",
        timeCommitment: "PART_TIME",
        interestCategoryIds: ["10000000-0000-4000-8000-000000000001"],
        customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
        salesChannelIds: ["30000000-0000-4000-8000-000000000001"],
        preferredProductType: "Kopi susu",
        businessObjective: "Menguji konsep usaha.",
        notes: "Mulai dari skala kecil.",
      });
      expect("countryCode" in result.data.location).toBe(false);
    }
  });
});
