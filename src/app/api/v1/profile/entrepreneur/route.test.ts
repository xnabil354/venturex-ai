import { describe, expect, it, vi } from "vitest";

import { parseUserId, type SafeUser } from "../../../../../auth/user-types";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../../../../auth/current-user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("../../../../../profile/service", () => ({
  EntrepreneurProfileService: class {
    save = mocks.save;
  },
}));

import { PUT } from "./route";

const currentUser: SafeUser = {
  id: parseUserId("00000000-0000-4000-8000-000000000101"),
  email: "founder@example.com",
  userType: "ENTREPRENEUR",
  onboardingStatus: "USER_TYPE_SELECTED",
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/profile/entrepreneur", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/v1/profile/entrepreneur", () => {
  it("returns 401 for a guest", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue(null);

    // When
    const response = await PUT(request({}));

    // Then
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("returns the safe completion result", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue(currentUser);
    mocks.save.mockResolvedValue({ profileVersion: 1, profileComplete: true });

    // When
    const response = await PUT(request({ location: { text: "Jakarta" } }));

    // Then
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      profileVersion: 1,
      profileComplete: true,
    });
    expect(mocks.save).toHaveBeenCalledWith({ location: { text: "Jakarta" } }, currentUser.id);
  });
});
