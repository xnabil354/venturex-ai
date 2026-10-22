import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  preferences: vi.fn(),
  save: vi.fn(),
  inbox: vi.fn(),
  read: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  topics: vi.fn(),
  test: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("./repository", () => ({
  NotificationRepository: class {
    preferences = mocks.preferences;
    savePreferences = mocks.save;
    inbox = mocks.inbox;
    markRead = mocks.read;
    subscribe = mocks.subscribe;
    unsubscribe = mocks.unsubscribe;
    claimTest = mocks.test;
  },
}));
vi.mock("./topics", () => ({ notificationTopics: mocks.topics }));
vi.mock("./push", () => ({
  pushConfig: () => ({ publicKey: "public" }),
  sendPush: mocks.send,
}));
import { notificationHttp } from "./http";
import { defaultPreferences } from "./contract";

function request(
  method = "GET",
  body?: unknown,
  origin = "http://localhost:3000",
) {
  return new Request("http://localhost:3000/api/v1/notifications", {
    method,
    headers: { origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
describe("notification API boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({
      id: "owner",
      userType: "UMKM_EXISTING",
      onboardingStatus: "COMPLETED",
    });
    mocks.preferences.mockResolvedValue(null);
    mocks.topics.mockResolvedValue([
      { key: "product:0", label: "Bakso", query: "Bakso" },
    ]);
    mocks.inbox.mockResolvedValue({ items: [], unread: 0, nextCursor: null });
  });
  it("requires authentication", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await notificationHttp(request(), "inbox")).status).toBe(401);
    expect(mocks.inbox).not.toHaveBeenCalled();
  });
  it("requires completed onboarding", async () => {
    mocks.user.mockResolvedValue({
      id: "owner",
      userType: "ENTREPRENEUR",
      onboardingStatus: "PROFILE_IN_PROGRESS",
    });
    expect((await notificationHttp(request(), "inbox")).status).toBe(403);
  });
  it("rejects cross-origin mutation before user/provider access", async () => {
    expect(
      (
        await notificationHttp(
          request("PATCH", {}, "https://evil.test"),
          "preferences",
        )
      ).status,
    ).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it.each(["ENTREPRENEUR", "UMKM_EXISTING"])(
    "supports %s private reads",
    async (userType) => {
      mocks.user.mockResolvedValue({
        id: "owner",
        userType,
        onboardingStatus: "COMPLETED",
      });
      const response = await notificationHttp(request(), "inbox");
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(mocks.inbox).toHaveBeenCalledWith("owner", undefined);
    },
  );
  it("resolves topic from current profile rather than accepting arbitrary text", async () => {
    expect(
      (
        await notificationHttp(
          request("PATCH", {
            ...defaultPreferences,
            enabled: true,
            queryKey: "product:0",
          }),
          "preferences",
        )
      ).status,
    ).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({ queryKey: "product:0" }),
      "Bakso",
    );
  });
  it("rejects a removed or foreign topic", async () => {
    expect(
      (
        await notificationHttp(
          request("PATCH", {
            ...defaultPreferences,
            enabled: true,
            queryKey: "product:1",
          }),
          "preferences",
        )
      ).status,
    ).toBe(422);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects excessive bodies", async () => {
    expect(
      (
        await notificationHttp(
          request("PATCH", { junk: "x".repeat(9000) }),
          "preferences",
        )
      ).status,
    ).toBe(413);
  });
  it("does not mark another owner's notification", async () => {
    mocks.read.mockResolvedValue(false);
    const id = "00000000-0000-4000-8000-000000000001";
    expect(
      (await notificationHttp(request("PATCH", { id }), "inbox")).status,
    ).toBe(404);
    expect(mocks.read).toHaveBeenCalledWith("owner", id);
  });
  it("rejects push endpoints pointing to internal services", async () => {
    expect(
      (
        await notificationHttp(
          request("POST", { endpoint: "https://127.0.0.1/", keys: {} }),
          "push",
        )
      ).status,
    ).toBe(400);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
  it("rate-limits device tests before outbound delivery", async () => {
    mocks.test.mockResolvedValue(null);
    expect(
      (
        await notificationHttp(
          request("POST", { endpoint: "https://fcm.googleapis.com/token" }),
          "test",
        )
      ).status,
    ).toBe(429);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
