import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ clients: [] as EventEmitter[] }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ DATABASE_URL: "postgres://example.test/venturex" }) }));
vi.mock("pg", () => ({
  Client: class extends EventEmitter {
    constructor() { super(); mocks.clients.push(this); }
    async connect() {}
    async query() {}
    async end() {}
  },
}));

import { subscribeBillingEvents } from "./events";

afterEach(() => {
  globalThis.__venturexBillingEventHub = undefined;
  mocks.clients.length = 0;
});

describe("billing notification hub", () => {
  it("forwards a committed notification only to that user's subscriber", async () => {
    const owner = vi.fn();
    const other = vi.fn();
    const unsubscribeOwner = subscribeBillingEvents("owner-id", owner);
    const unsubscribeOther = subscribeBillingEvents("other-id", other);
    await vi.waitFor(() => expect(owner).toHaveBeenCalledWith("ready"));
    const client = mocks.clients[0];
    expect(client).toBeDefined();
    client!.emit("notification", { channel: "venturex_billing_changed", payload: "owner-id" });
    expect(owner).toHaveBeenCalledWith("changed");
    expect(other).not.toHaveBeenCalledWith("changed");
    unsubscribeOwner();
    unsubscribeOther();
  });
});
