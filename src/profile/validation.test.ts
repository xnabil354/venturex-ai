import { describe, expect, it } from "vitest";

import { entrepreneurProfileSchema } from "./validation";

describe("entrepreneur profile validation", () => {
  it("normalizes optional text and selection sets", () => {
    // Given
    const input = {
      location: {
        text: "  Jakarta Pusat ",
        city: " ",
        province: "DKI Jakarta",
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
      preferredProductType: " ",
      businessObjective: null,
      notes: " notes ",
    };

    // When
    const result = entrepreneurProfileSchema.parse(input);

    // Then
    expect(result.location.text).toBe("Jakarta Pusat");
    expect(result.location.city).toBeNull();
    expect(result.interestCategoryIds).toEqual([
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
    ]);
    expect(result.preferredProductType).toBeNull();
    expect(result.notes).toBe("notes");
  });

  it("rejects a budget range where maximum is below minimum", () => {
    // Given
    const input = {
      location: { text: "Jakarta" },
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
