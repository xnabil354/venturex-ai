// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disableBrowserPush, enableBrowserPush, prepareBrowserPush } from "./browser-push";

describe("browser push consent and revocation", () => {
  const unsubscribe = vi.fn();
  const register = vi.fn();
  const requestPermission = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { permission: "granted", requestPermission });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register,
        getRegistration: vi
          .fn()
          .mockResolvedValue({
            pushManager: {
              getSubscription: vi
                .fn()
                .mockResolvedValue({
                  endpoint: "https://fcm.googleapis.com/token",
                  unsubscribe,
                }),
            },
            getNotifications: vi.fn().mockResolvedValue([]),
          }),
      },
    });
    unsubscribe.mockResolvedValue(true);
    localStorage.setItem("venturex-push-owner", "owner");
  });
  afterEach(() => vi.unstubAllGlobals());
  it("does not register a worker or subscription when permission is denied", async () => {
    requestPermission.mockResolvedValue("denied");
    await expect(enableBrowserPush("public", "owner")).rejects.toThrow(
      "Izinkan notifikasi",
    );
    expect(register).not.toHaveBeenCalled();
  });
  it("subscribes synchronously from a click after worker preparation without an earlier permission prompt", async () => {
    const subscription = { toJSON: () => ({ endpoint: "https://fcm.googleapis.com/token" }), unsubscribe };
    const subscribe = vi.fn().mockResolvedValue(subscription);
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } };
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: vi.fn().mockResolvedValue(registration), ready: Promise.resolve(registration), getRegistration: vi.fn().mockResolvedValue(null) } });
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await prepareBrowserPush("owner");
    expect(requestPermission).not.toHaveBeenCalled();
    const pending = enableBrowserPush(btoa("x".repeat(65)), "owner");
    expect(subscribe).toHaveBeenCalledOnce();
    expect(requestPermission).not.toHaveBeenCalled();
    await pending;
    await disableBrowserPush();
  });
  it("revokes the local subscription even if the server request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await disableBrowserPush();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(localStorage.getItem("venturex-push-owner")).toBeNull();
  });
  it("revokes the server record before removing browser ownership", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    await disableBrowserPush();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/notifications/push",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(localStorage.getItem("venturex-push-owner")).toBeNull();
  });
  it("reports a failure when neither server nor browser can revoke", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    unsubscribe.mockRejectedValue(new Error("browser unavailable"));
    await expect(disableBrowserPush()).rejects.toThrow(
      "belum dapat dinonaktifkan",
    );
  });
});
