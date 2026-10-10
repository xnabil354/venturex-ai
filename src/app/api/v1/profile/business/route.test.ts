import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { parseUserId, type SafeUser } from "../../../../../auth/user-types";
import { BusinessProfileForbiddenError } from "../../../../../profile/business-errors";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../../../../auth/current-user", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("../../../../../profile/business-service", () => ({
  BusinessProfileService: class {
    save = mocks.save;
  },
}));

import { PUT } from "./route";

const currentUser: SafeUser = {
  id: parseUserId("00000000-0000-4000-8000-000000000201"),
  email: "owner@example.com",
  userType: "UMKM_EXISTING",
  onboardingStatus: "USER_TYPE_SELECTED",
};

function request(body: unknown): Request {
  return new Request("http://localhost/api/v1/profile/business", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/v1/profile/business", () => {
  it("returns 401 for a guest", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue(null);

    // When
    const response = await PUT(request({}));

    // Then
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 for invalid payload", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue(currentUser);
    mocks.save.mockRejectedValue(
      new ZodError([{ code: "custom", path: ["products"], message: "Required" }]),
    );

    // When
    const response = await PUT(request({ products: [] }));

    // Then
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns the safe completion result", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue(currentUser);
    mocks.save.mockResolvedValue({ profileVersion: 1, profileComplete: true });

    // When
    const response = await PUT(request({ businessName: "Kopi Nusantara" }));

    // Then
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      profileVersion: 1,
      profileComplete: true,
    });
    expect(mocks.save).toHaveBeenCalledWith(
      { businessName: "Kopi Nusantara" },
      currentUser.id,
    );
  });

  it("returns 403 for an entrepreneur", async () => {
    // Given
    mocks.getCurrentUser.mockResolvedValue(currentUser);
    mocks.save.mockRejectedValue(new BusinessProfileForbiddenError());

    // When
    const response = await PUT(request({}));

    // Then
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("FORBIDDEN");
  });
});
