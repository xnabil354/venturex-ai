import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  preferences: vi.fn(),
  setEnabled: vi.fn(),
  inbox: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./repository", () => ({
  NotificationRepository: class {
    preferences = mocks.preferences;
    setEnabled = mocks.setEnabled;
    inbox = mocks.inbox;
    subscribe = mocks.subscribe;
    unsubscribe = mocks.unsubscribe;
  },
}));
vi.mock("./push", () => ({ pushConfig: () => ({ publicKey: "public" }) }));

import { notificationHttp } from "./http";

function request(method = "GET", body?: unknown, origin = "http://localhost:3000", contentType = "application/json") {
  return new Request("http://localhost:3000/api/v1/notifications", {
    method,
    headers: { origin, "Content-Type": contentType },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("notification API boundaries", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("accepts the public origin behind the production proxy", async () => {
    vi.stubEnv("APP_URL", "https://venturex.web.id");
    const response = await notificationHttp(new Request("https://0.0.0.0:3000/api/v1/notifications/preferences", {
      method: "PATCH", headers: { origin: "https://venturex.web.id", "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    }), "preferences");
    expect(response.status).toBe(200);
    expect(mocks.setEnabled).toHaveBeenCalledWith("owner", true);
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({ id: "owner", userType: "UMKM_EXISTING", onboardingStatus: "COMPLETED" });
    mocks.preferences.mockResolvedValue(null);
    mocks.inbox.mockResolvedValue({ items: [], nextCursor: null });
    mocks.subscribe.mockResolvedValue(true);
  });
  it("requires authentication", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await notificationHttp(request(), "inbox")).status).toBe(401);
    expect(mocks.inbox).not.toHaveBeenCalled();
  });
  it("requires completed onboarding", async () => {
    mocks.user.mockResolvedValue({ id: "owner", userType: "ENTREPRENEUR", onboardingStatus: "PROFILE_IN_PROGRESS" });
    expect((await notificationHttp(request(), "inbox")).status).toBe(403);
  });
  it("rejects cross-origin mutation before user access", async () => {
    expect((await notificationHttp(request("PATCH", { enabled: true }, "https://evil.test"), "preferences")).status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("accepts only the enabled toggle", async () => {
    expect((await notificationHttp(request("PATCH", { enabled: true }), "preferences")).status).toBe(200);
    expect(mocks.setEnabled).toHaveBeenCalledWith("owner", true);
    expect((await notificationHttp(request("PATCH", { enabled: true, period: "month" }), "preferences")).status).toBe(400);
  });
  it("requires JSON and rejects excessive bodies", async () => {
    expect((await notificationHttp(request("PATCH", { enabled: true }, "http://localhost:3000", "text/plain"), "preferences")).status).toBe(415);
    expect((await notificationHttp(request("PATCH", { junk: "x".repeat(9000) }), "preferences")).status).toBe(413);
  });
  it.each(["ENTREPRENEUR", "UMKM_EXISTING"])("supports %s private archive reads", async (userType) => {
    mocks.user.mockResolvedValue({ id: "owner", userType, onboardingStatus: "COMPLETED" });
    const response = await notificationHttp(request(), "inbox");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.inbox).toHaveBeenCalledWith("owner", undefined);
  });
  it("rejects push endpoints pointing to internal services", async () => {
    expect((await notificationHttp(request("POST", { endpoint: "https://127.0.0.1/", keys: {} }), "push")).status).toBe(400);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
});
