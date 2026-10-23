import { describe, expect, it } from "vitest";

import {
  getNineRouterLiveE2EBlockReason,
  NINEROUTER_LIVE_E2E_BASE_URL,
  NINEROUTER_LIVE_E2E_MODEL,
} from "./ninerouter-live-e2e-guard";

const validEnvironment = {
  VENTUREX_9ROUTER_LIVE_E2E_ARMED: "true",
  VENTUREX_9ROUTER_KEY_ROTATED_CONFIRMED: "true",
  NINEROUTER_API_KEY: "synthetic-test-key-not-a-credential",
  AI_PROVIDER: "ninerouter",
  NINEROUTER_BASE_URL: NINEROUTER_LIVE_E2E_BASE_URL,
  NINEROUTER_MODEL: NINEROUTER_LIVE_E2E_MODEL,
} as const;

describe("9Router live Playwright safety gate", () => {
  it("allows only an explicitly armed run with a confirmed rotated key and fixed provider target", () => {
    expect(getNineRouterLiveE2EBlockReason(validEnvironment)).toBeNull();
  });

  it.each([
    [{ ...validEnvironment, VENTUREX_9ROUTER_LIVE_E2E_ARMED: undefined }, "LIVE_TEST_NOT_ARMED"],
    [{ ...validEnvironment, VENTUREX_9ROUTER_KEY_ROTATED_CONFIRMED: undefined }, "KEY_ROTATION_NOT_CONFIRMED"],
    [{ ...validEnvironment, NINEROUTER_API_KEY: "  " }, "API_KEY_NOT_CONFIGURED"],
    [{ ...validEnvironment, AI_PROVIDER: "gemini" }, "PROVIDER_MISMATCH"],
    [{ ...validEnvironment, NINEROUTER_BASE_URL: "http://other.example/v1" }, "ENDPOINT_MISMATCH"],
    [{ ...validEnvironment, NINEROUTER_MODEL: "another-model" }, "MODEL_MISMATCH"],
  ] as const)("blocks unsafe or incomplete configuration with a sanitized reason", (env, reason) => {
    expect(getNineRouterLiveE2EBlockReason(env)).toBe(reason);
  });

  it("never includes a configured API key in a block reason", () => {
    const secret = "synthetic-test-key-not-a-credential";
    const reason = getNineRouterLiveE2EBlockReason({ ...validEnvironment, NINEROUTER_MODEL: "wrong" });
    expect(reason).toBe("MODEL_MISMATCH");
    expect(reason).not.toContain(secret);
  });
});
