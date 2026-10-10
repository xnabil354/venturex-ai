import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("stores a different value and verifies the original password", async () => {
    // Given
    const password = "StrongPassword";

    // When
    const passwordHash = await hashPassword(password);

    // Then
    expect(passwordHash).not.toBe(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    // Given
    const passwordHash = await hashPassword("StrongPassword");

    // When / Then
    await expect(verifyPassword("WrongPassword", passwordHash)).resolves.toBe(
      false,
    );
  });
});