import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "./route";

describe("POST /api/v1/auth/register", () => {
  it("returns a validation envelope before touching the database", async () => {
    // Given
    const request = new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "short",
        passwordConfirmation: "different",
      }),
    });

    // When
    const response = await POST(request);

    // Then
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" },
      requestId: expect.stringMatching(/^req_/),
    });
    expect(response.headers.get("x-request-id")).toMatch(/^req_/);
  });
});