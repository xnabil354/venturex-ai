import { describe, expect, it } from "vitest";

import { entrepreneurProfileSchema, entrepreneurProfileReadSchema } from "./validation";

describe("entrepreneur profile validation", () => {
  it("normalizes required location fields and selection sets", () => {
    // Given
    const input = {
      location: {
        text: "  Jl. Menteng Raya No. 12, Jakarta Pusat ",
        city: " Jakarta Pusat ",
        province: "DKI Jakarta",
        district: " Menteng ",
        subdistrict: "Pegangsaan",
        countryCode: "ID",
      },
      budget: { min: 0, max: 10_000 },
      experienceLevel: "BEGINNER",
      timeCommitment: "LIMITED",
      interestCategoryIds: [
        "10000000-0000-4000-8000-000000000002",
        "10000000-0000-4000-8000-000000000001",
        "10000000-0000-4000-8000-000000000002",
      ],
      customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
      salesChannelIds: ["30000000-0000-4000-8000-000000000001"],
      preferredProductType: " Bakso ayam ",
      businessObjective: null,
      notes: " notes ",
    };

    // When
    const result = entrepreneurProfileSchema.parse(input);

    // Then
    expect(result.location.text).toBe("Jl. Menteng Raya No. 12, Jakarta Pusat");
    expect(result.location.city).toBe("Jakarta Pusat");
    expect(result.location.district).toBe("Menteng");
    expect(result.interestCategoryIds).toEqual([
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
    ]);
    expect(result.preferredProductType).toBe("Bakso ayam");
    expect(result.notes).toBe("notes");
    expect(entrepreneurProfileSchema.safeParse({ ...input, preferredProductType: " " }).success).toBe(false);
    expect(entrepreneurProfileReadSchema.parse({ ...input, preferredProductType: null }).preferredProductType).toBeNull();
  });

  it("rejects a budget range where maximum is below minimum", () => {
    // Given
    const input = {
      location: {
        text: "Jl. Menteng Raya No. 12, Jakarta Pusat",
        city: "Jakarta Pusat",
        province: "DKI Jakarta",
        district: "Menteng",
        subdistrict: "Pegangsaan",
      },
      budget: { min: 10_000, max: 5_000 },
      experienceLevel: "BEGINNER",
      timeCommitment: "LIMITED",
      interestCategoryIds: ["10000000-0000-4000-8000-000000000001"],
      customerSegmentIds: ["20000000-0000-4000-8000-000000000001"],
      salesChannelIds: ["30000000-0000-4000-8000-000000000001"],
    };

    // When / Then
    expect(entrepreneurProfileSchema.safeParse(input).success).toBe(false);
  });
});
