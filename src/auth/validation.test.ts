import { describe, expect, it } from "vitest";

import {
  normalizeEmail,
  registrationSchema,
} from "./validation";

describe("authentication input validation", () => {
  it("normalizes an email before persistence", () => {
    // Given
    const email = "  User@Example.COM ";

    // When
    const normalized = normalizeEmail(email);

    // Then
    expect(normalized).toBe("user@example.com");
  });

  it("rejects an invalid email", () => {
    // Given
    const input = {
      email: "not-an-email",
      password: "StrongPassword",
      passwordConfirmation: "StrongPassword",
    };

    // When / Then
    expect(registrationSchema.safeParse(input).success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    // Given
    const input = {
      email: "user@example.com",
      password: "StrongPassword",
      passwordConfirmation: "DifferentPassword",
    };

    // When / Then
    expect(registrationSchema.safeParse(input).success).toBe(false);
  });
});