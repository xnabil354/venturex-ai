import { describe, expect, it, vi } from "vitest";

import { UserTypeAlreadySelectedError } from "../../../../../auth/errors";
import { parseUserId, type SafeUser } from "../../../../../auth/user-types";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  selectInitialUserType: vi.fn(),
}));

vi.mock("../../../../../auth/current-user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("../../../../../auth/service", () => ({
  AuthService: class {
    selectInitialUserType = mocks.selectInitialUserType;
  },
}));

import { PATCH } from "./route";

const currentUser: SafeUser = {
  id: parseUserId("00000000-0000-4000-8000-000000000001"),
  email: "user@example.com",
  userType: null,
  onboardingStatus: "NOT_STARTED",
};

const selectedUser: SafeUser = {
  ...currentUser,
  userType: "ENTREPRENEUR",
  onboardingStatus: "USER_TYPE_SELECTED",
};

describe("PATCH /api/v1/me/user-type", () => {
  it("returns 401 for a guest", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue(null);

    // When
    const response = await PATCH(
      new Request("http://localhost/api/v1/me/user-type", {
        body: JSON.stringify({ userType: "ENTREPRENEUR" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
    );

    // Then
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it.each(["ENTREPRENEUR", "UMKM_EXISTING"] as const)(
    "returns the selected state for %s",
    async (userType) => {
      // Given
      mocks.getCurrentUser.mockResolvedValue(currentUser);
      const result = { ...selectedUser, userType };
      mocks.selectInitialUserType.mockResolvedValue(result);

      // When
      const response = await PATCH(
        new Request("http://localhost/api/v1/me/user-type", {
          body: JSON.stringify({ userType }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }),
      );

      // Then
      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual(result);
      expect(mocks.selectInitialUserType).toHaveBeenCalledWith(
        { userType },
        currentUser.id,
      );
    },
  );

  it("returns 400 for an invalid selection", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue(currentUser);

    // When
    const response = await PATCH(
      new Request("http://localhost/api/v1/me/user-type", {
        body: JSON.stringify({ userType: "NOT_A_USER_TYPE" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
    );

    // Then
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mocks.selectInitialUserType).not.toHaveBeenCalled();
  });

  it("returns 409 when the type was already selected", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue({
      ...currentUser,
      userType: "UMKM_EXISTING",
      onboardingStatus: "USER_TYPE_SELECTED",
    });
    mocks.selectInitialUserType.mockRejectedValue(
      new UserTypeAlreadySelectedError(),
    );

    // When
    const response = await PATCH(
      new Request("http://localhost/api/v1/me/user-type", {
        body: JSON.stringify({ userType: "ENTREPRENEUR" }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
    );

    // Then
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("CONFLICT");
  });
});
