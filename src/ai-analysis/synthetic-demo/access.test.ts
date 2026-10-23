import { describe, expect, it } from "vitest";

import {
  isSyntheticDemoEnabled,
  isSyntheticDemoHostAllowed,
  isSyntheticDemoPostAllowed,
  SYNTHETIC_DEMO_ENABLE_FLAG,
  SYNTHETIC_DEMO_LAUNCHER_FLAG,
  SYNTHETIC_DEMO_PORT_FLAG,
} from "./access";

const enabled = {
  NODE_ENV: "development",
  [SYNTHETIC_DEMO_ENABLE_FLAG]: "true",
  [SYNTHETIC_DEMO_LAUNCHER_FLAG]: "127.0.0.1",
  [SYNTHETIC_DEMO_PORT_FLAG]: "3016",
};

describe("synthetic demo local access guard", () => {
  it("is disabled by default and denied in production", () => {
    expect(isSyntheticDemoEnabled({})).toBe(false);
    expect(isSyntheticDemoEnabled({ ...enabled, NODE_ENV: "production" })).toBe(false);
    expect(isSyntheticDemoEnabled({ ...enabled, [SYNTHETIC_DEMO_LAUNCHER_FLAG]: undefined })).toBe(false);
  });

  it("requires the explicit loopback launcher, host, and expected port", () => {
    expect(isSyntheticDemoHostAllowed("127.0.0.1:3016", enabled)).toBe(true);
    expect(isSyntheticDemoHostAllowed("localhost:3016", enabled)).toBe(false);
    expect(isSyntheticDemoHostAllowed("192.168.1.10:3016", enabled)).toBe(false);
    expect(isSyntheticDemoHostAllowed("127.0.0.1:3000", enabled)).toBe(false);
    expect(isSyntheticDemoHostAllowed("attacker.example:3016", enabled)).toBe(false);
  });

  it("requires a same-origin loopback POST and does not trust forwarded host data", () => {
    const local = new Request("http://127.0.0.1:3016/api/local/synthetic-ai-demo", {
      method: "POST",
      headers: { host: "127.0.0.1:3016", origin: "http://127.0.0.1:3016" },
    });
    expect(isSyntheticDemoPostAllowed(local, enabled)).toBe(true);
    expect(isSyntheticDemoPostAllowed(new Request(local.url, {
      method: "POST",
      headers: { host: "127.0.0.1:3016", origin: "http://evil.example" },
    }), enabled)).toBe(false);
    expect(isSyntheticDemoPostAllowed(new Request(local.url, {
      method: "POST",
      headers: { host: "127.0.0.1:3016", origin: "http://127.0.0.1:3016", "x-forwarded-host": "127.0.0.1:3016" },
    }), enabled)).toBe(true);
    expect(isSyntheticDemoPostAllowed(new Request(local.url, {
      method: "POST",
      headers: { host: "127.0.0.1:3016" },
    }), enabled)).toBe(false);
  });
});
