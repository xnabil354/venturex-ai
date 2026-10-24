import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function setup(owner: string | null = "owner", offline = false) {
  const handlers = new Map<string, (event: unknown) => void>();
  const show = vi.fn().mockResolvedValue(undefined);
  const focus = vi.fn().mockResolvedValue(undefined);
  const navigate = vi.fn().mockResolvedValue(undefined);
  const postMessage = vi.fn();
  const self = {
    addEventListener: (name: string, handler: (event: unknown) => void) =>
      handlers.set(name, handler),
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    location: { origin: "https://venturex.test" },
    registration: { showNotification: show },
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi
        .fn()
        .mockResolvedValue([
          {
            url: "https://venturex.test/dashboard",
            focus,
            navigate,
            postMessage,
          },
        ]),
      openWindow: vi.fn(),
    },
  };
  runInNewContext(readFileSync("public/notifications-sw.js", "utf8"), {
    self,
    URL,
    fetch: offline
      ? vi.fn().mockRejectedValue(new Error("offline"))
      : vi
          .fn()
          .mockResolvedValue({
            ok: owner !== null,
            json: async () => ({ userId: owner }),
          }),
  });
  async function push(payload: unknown) {
    let completion: Promise<void> | undefined;
    handlers.get("push")!({
      data: { json: () => payload },
      waitUntil: (promise: Promise<void>) => {
        completion = promise;
      },
    });
    await completion;
  }
  return { push, show, handlers, focus, navigate, postMessage };
}
describe("notification service worker", () => {
  it("shows bounded generic copy for the authenticated owner", async () => {
    const { push, show, postMessage } = setup();
    await push({
      userId: "owner",
      id: "digest",
      title: "malicious title",
      body: "private profile text",
    });
    expect(show).toHaveBeenCalledWith(
      "Ringkasan Food & Drink",
      expect.objectContaining({
        body: "Ringkasan mingguan worldwide Anda sudah tersedia.",
        tag: "venturex-digest",
      }),
    );
    expect(JSON.stringify(show.mock.calls)).not.toContain("private profile");
    expect(postMessage).toHaveBeenCalled();
  });
  it.each([null, "another-owner"])(
    "suppresses queued messages after logout/account switch (%s)",
    async (owner) => {
      const { push, show } = setup(owner);
      await push({ userId: "owner", id: "digest" });
      expect(show).not.toHaveBeenCalled();
    },
  );
  it("keeps offline copy generic", async () => {
    const { push, show } = setup("owner", true);
    await push({ userId: "owner", id: "digest", query: "secret product" });
    expect(JSON.stringify(show.mock.calls)).not.toContain("secret product");
  });
  it("ignores malformed messages", async () => {
    const { push, show } = setup();
    await push(null);
    await push({ id: "only-id" });
    expect(show).not.toHaveBeenCalled();
  });
  it("opens the fixed same-origin notification center", async () => {
    const { handlers, navigate, focus } = setup();
    let completion: Promise<void> | undefined;
    const close = vi.fn();
    handlers.get("notificationclick")!({
      notification: { close, data: { url: "https://evil.test" } },
      waitUntil: (promise: Promise<void>) => {
        completion = promise;
      },
    });
    await completion;
    expect(close).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("https://venturex.test/notifications");
    expect(focus).toHaveBeenCalled();
    expect(focus.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]!);
  });
});
