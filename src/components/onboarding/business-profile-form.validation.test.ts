import { describe, expect, it } from "vitest";

import {
  createInitialBusinessFormState,
  toBusinessFormState,
  toBusinessProfilePayload,
  validateStep,
  type BusinessFormState,
} from "./business-profile-form.validation";

const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";
const SEGMENT_ID = "20000000-0000-4000-8000-000000000001";
const CHANNEL_ID = "30000000-0000-4000-8000-000000000001";

function validState(): BusinessFormState {
  return {
    ...createInitialBusinessFormState(),
    businessName: "Kopi Nusantara",
    businessCategoryId: CATEGORY_ID,
    locationText: "Jakarta Pusat",
    city: "Jakarta Pusat",
    province: "DKI Jakarta",
    averagePriceMin: "20000",
    averagePriceMax: "40000",
    products: [
      {
        categoryId: CATEGORY_ID,
        key: "product-1",
        name: "  Kopi   Susu ",
        price: "25000",
      },
    ],
    customerSegmentIds: [SEGMENT_ID, SEGMENT_ID],
    salesChannelIds: [CHANNEL_ID, CHANNEL_ID],
    businessDescription: "  Kedai minuman. ",
    notes: " ",
  };
}

describe("business profile form validation", () => {
  it("creates a single editable product row", () => {
    // Given / When
    const state = createInitialBusinessFormState();

    // Then
    expect(state.products).toEqual([
      { categoryId: "", key: "product-1", name: "", price: "" },
    ]);
  });

  it("prefills all stored business fields and product rows without persistence-only fields", () => {
    // Given
    const profile = {
      businessName: "Kedai Pagi",
      businessCategoryId: CATEGORY_ID,
      location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
      averagePrice: { min: 15_000, max: 35_000 },
      products: [
        { name: "Kopi Susu", categoryId: CATEGORY_ID, price: 18_000 },
        { name: "Teh Lemon", categoryId: null, price: null },
      ],
      customerSegmentIds: [SEGMENT_ID],
      salesChannelIds: [CHANNEL_ID],
      businessDescription: "Kedai minuman keluarga.",
      notes: "Catatan pemilik.",
    };

    // When
    const state = toBusinessFormState(profile);

    // Then
    expect(state).toEqual({
      averagePriceMax: "35000",
      averagePriceMin: "15000",
      businessCategoryId: CATEGORY_ID,
      businessDescription: "Kedai minuman keluarga.",
      businessName: "Kedai Pagi",
      city: "Bandung",
      cityId: "",
      customerSegmentIds: [SEGMENT_ID],
      district: "",
      districtId: "",
      locationText: "Bandung",
      notes: "Catatan pemilik.",
      products: [
        { categoryId: CATEGORY_ID, key: "product-1", name: "Kopi Susu", price: "18000" },
        { categoryId: "", key: "product-2", name: "Teh Lemon", price: "" },
      ],
      province: "Jawa Barat",
      provinceId: "",
      salesChannelIds: [CHANNEL_ID],
      subdistrict: "",
      subdistrictId: "",
    });
    expect(JSON.stringify(state)).not.toContain("productId");
    expect(JSON.stringify(state)).not.toContain("isActive");
    expect(JSON.stringify(state)).not.toContain("operationModel");
  });

  it("reports required fields by step", () => {
    // Given
    const state = createInitialBusinessFormState();

    // When
    const identityErrors = validateStep(1, state);
    const productErrors = validateStep(2, state);
    const audienceErrors = validateStep(3, state);

    // Then
    expect(identityErrors.businessName).toBeDefined();
    expect(identityErrors.businessCategoryId).toBeDefined();
    expect(identityErrors.locationText).toBeDefined();
    expect(productErrors["products.0.name"]).toBeDefined();
    expect(productErrors.averagePriceMin).toBeDefined();
    expect(productErrors.averagePriceMax).toBeDefined();
    expect(audienceErrors.customerSegmentIds).toBeDefined();
    expect(audienceErrors.salesChannelIds).toBeDefined();
  });

  it("maps form state to the API payload and normalizes optional values", () => {
    // Given
    const state = validState();

    // When
    const result = toBusinessProfilePayload(state);

    // Then
    expect(result).toEqual({
      success: true,
      data: {
        businessName: "Kopi Nusantara",
        businessCategoryId: CATEGORY_ID,
        location: {
          text: "Jakarta Pusat",
          city: "Jakarta Pusat",
          district: "",
          province: "DKI Jakarta",
          subdistrict: "",
        },
        averagePrice: { min: 20000, max: 40000 },
        products: [
          { name: "Kopi Susu", categoryId: CATEGORY_ID, price: 25000 },
        ],
        customerSegmentIds: [SEGMENT_ID],
        salesChannelIds: [CHANNEL_ID],
        businessDescription: "Kedai minuman.",
        notes: null,
      },
    });
  });

  it("rejects normalized duplicate product names", () => {
    // Given
    const state = {
      ...validState(),
      products: [
        { categoryId: "", key: "product-1", name: "Kopi Susu", price: "" },
        { categoryId: "", key: "product-2", name: " kopi   susu ", price: "" },
      ],
    };

    // When
    const result = toBusinessProfilePayload(state);

    // Then
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["products.0.name"]).toBeDefined();
      expect(result.errors["products.1.name"]).toBeDefined();
    }
  });

  it("reports normalized duplicate names before leaving the product step", () => {
    // Given
    const state = {
      ...validState(),
      products: [
        { categoryId: "", key: "product-1", name: "Kopi Susu", price: "" },
        { categoryId: "", key: "product-2", name: " kopi   susu ", price: "" },
      ],
    };

    // When
    const errors = validateStep(2, state);

    // Then
    expect(errors["products.0.name"]).toBe("Nama produk tidak boleh duplikat setelah normalisasi.");
    expect(errors["products.1.name"]).toBe("Nama produk tidak boleh duplikat setelah normalisasi.");
  });

  it("rejects a price range whose maximum is below its minimum", () => {
    // Given
    const state = { ...validState(), averagePriceMax: "10000" };

    // When
    const errors = validateStep(2, state);

    // Then
    expect(errors.averagePriceMax).toBe("Harga maksimum harus lebih besar atau sama dengan minimum.");
  });
});
