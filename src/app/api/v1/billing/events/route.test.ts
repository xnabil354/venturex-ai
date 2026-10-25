import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.currentUser }));
vi.mock("@/billing/events", () => ({ subscribeBillingEvents: mocks.subscribe }));

import { GET } from "./route";

afterEach(() => vi.clearAllMocks());

describe("billing event stream", () => {
  it("rejects users without a session", async () => {
    mocks.currentUser.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/billing/events"));
    expect(response.status).toBe(401);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("subscribes to the authenticated user and sends balance-change events", async () => {
    mocks.currentUser.mockResolvedValue({ id: "owner-id" });
    mocks.subscribe.mockImplementation((_userId: string, listener: (kind: string) => void) => {
      queueMicrotask(() => listener("changed"));
      return vi.fn();
    });
    const response = await GET(new Request("http://localhost/api/v1/billing/events"));
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: changed");
    expect(mocks.subscribe).toHaveBeenCalledWith("owner-id", expect.any(Function));
    await reader.cancel();
  });
});
