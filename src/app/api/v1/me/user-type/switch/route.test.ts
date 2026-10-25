import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  switchUserType: vi.fn(),
}));

vi.mock("../../../../../../auth/current-user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("../../../../../../auth/service", () => ({
  AuthService: class { switchUserType = mocks.switchUserType; },
}));

import { parseUserId, type SafeUser } from "../../../../../../auth/user-types";
import { POST } from "./route";

const currentUser: SafeUser = {
  id: parseUserId("00000000-0000-4000-8000-000000000101"),
  email: "owner@example.com",
  userType: "ENTREPRENEUR",
  onboardingStatus: "COMPLETED",
};
const switchedUser: SafeUser = { ...currentUser, userType: "UMKM_EXISTING", onboardingStatus: "USER_TYPE_SELECTED" };

function request(body: string, origin = "http://localhost:3000", headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/v1/me/user-type/switch", {
    method: "POST",
    headers: { origin, host: "localhost:3000", "content-type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/v1/me/user-type/switch", () => {
  it("rejects cross-origin mutations before reading the session", async () => {
    const response = await POST(request('{"userType":"UMKM_EXISTING"}', "https://attacker.example"));
    expect(response.status).toBe(403);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("accepts the public HTTPS origin forwarded by ngrok when the internal URL is HTTP", async () => {
    mocks.getCurrentUser.mockResolvedValue(currentUser);
    mocks.switchUserType.mockResolvedValue(switchedUser);
    const response = await POST(request('{"userType":"UMKM_EXISTING"}', "https://riverboat-eternity-ramp.ngrok-free.dev", {
      host: "riverboat-eternity-ramp.ngrok-free.dev", "x-forwarded-proto": "https",
    }));
    expect(response.status).toBe(200);
  });

  it("rejects a different public host or protocol behind the proxy", async () => {
    for (const origin of ["https://attacker.example", "http://riverboat-eternity-ramp.ngrok-free.dev"]) {
      const response = await POST(request('{"userType":"UMKM_EXISTING"}', origin, {
        host: "riverboat-eternity-ramp.ngrok-free.dev", "x-forwarded-proto": "https",
      }));
      expect(response.status).toBe(403);
    }
  });

  it("requires authentication", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(request('{"userType":"UMKM_EXISTING"}'));
    expect(response.status).toBe(401);
  });

  it("switches the authenticated account and returns no-store data", async () => {
    mocks.getCurrentUser.mockResolvedValue(currentUser);
    mocks.switchUserType.mockResolvedValue(switchedUser);
    const response = await POST(request('{"userType":"UMKM_EXISTING"}'));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect((await response.json()).data).toEqual(switchedUser);
    expect(mocks.switchUserType).toHaveBeenCalledWith({ userType: "UMKM_EXISTING" }, currentUser.id);
  });

  it("rejects unknown fields and invalid persona values", async () => {
    mocks.getCurrentUser.mockResolvedValue(currentUser);
    for (const body of ['{"userType":"OTHER"}', '{"userType":"UMKM_EXISTING","userId":"other"}']) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    }
    expect(mocks.switchUserType).not.toHaveBeenCalled();
  });
});
