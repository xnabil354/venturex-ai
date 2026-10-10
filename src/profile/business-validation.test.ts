import { describe, expect, it } from "vitest";

import { businessProfileSchema } from "./business-validation";

const CATEGORY_ID = "10000000-0000-4000-8000-000000000001";
const SEGMENT_ID = "20000000-0000-4000-8000-000000000001";
const CHANNEL_ID = "30000000-0000-4000-8000-000000000001";

function validInput() {
  return {
    businessName: "Kopi Nusantara",
    businessCategoryId: CATEGORY_ID,
    location: { text: "Jakarta Pusat", city: "", province: "DKI Jakarta" },
    averagePrice: { min: 20_000, max: 40_000 },
    products: [
      { name: "  Kopi   Susu ", categoryId: CATEGORY_ID, price: 25_000 },
      { name: "Teh Lemon", categoryId: null, price: null },
    ],
    customerSegmentIds: [SEGMENT_ID, SEGMENT_ID],
    salesChannelIds: [CHANNEL_ID, CHANNEL_ID],
    businessDescription: "  Kedai minuman. ",
    notes: " ",
  };
}

describe("business profile validation", () => {
  it("normalizes product names, optional text, and reference sets", () => {
    // Given
    const input = validInput();

    // When
    const result = businessProfileSchema.parse(input);

    // Then
    expect(result.products[0]?.name).toBe("Kopi Susu");
    expect(result.location.city).toBeNull();
    expect(result.customerSegmentIds).toEqual([SEGMENT_ID]);
    expect(result.salesChannelIds).toEqual([CHANNEL_ID]);
    expect(result.businessDescription).toBe("Kedai minuman.");
    expect(result.notes).toBeNull();
  });

  it("rejects product names that duplicate after normalization", () => {
    // Given
    const input = {
      ...validInput(),
      products: [
        { name: "Kopi Susu", categoryId: null, price: null },
        { name: " kopi   susu ", categoryId: null, price: null },
      ],
    };

    // When
    const result = businessProfileSchema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });

  it("rejects oversized reference arrays", () => {
    // Given
    const customerSegmentIds = Array.from({ length: 101 }, () => SEGMENT_ID);

    // When
    const result = businessProfileSchema.safeParse({ ...validInput(), customerSegmentIds });

    // Then
    expect(result.success).toBe(false);
  });

  it("rejects more than twenty current products", () => {
    // Given
    const products = Array.from({ length: 21 }, (_, index) => ({
      name: `Product ${index}`,
      categoryId: null,
      price: null,
    }));

    // When
    const result = businessProfileSchema.safeParse({ ...validInput(), products });

    // Then
    expect(result.success).toBe(false);
  });

  it("rejects an empty product collection and fractional Rupiah prices", () => {
    // Given / When
    const emptyProducts = businessProfileSchema.safeParse({ ...validInput(), products: [] });
    const fractionalPrice = businessProfileSchema.safeParse({
      ...validInput(),
      products: [{ name: "Kopi Susu", categoryId: CATEGORY_ID, price: 25_000.5 }],
    });

    // Then
    expect(emptyProducts.success).toBe(false);
    expect(fractionalPrice.success).toBe(false);
  });
});
