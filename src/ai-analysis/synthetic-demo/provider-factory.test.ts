import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG, NINEROUTER_PROVIDER, NINEROUTER_REQUESTED_MODEL, NINEROUTER_SYNTHETIC_SMOKE_FLAG } from "../ninerouter";
import { SyntheticDemoProviderFailureError } from "./errors";
import { SYNTHETIC_DEMO_ENABLE_FLAG, SYNTHETIC_DEMO_LAUNCHER_FLAG, SYNTHETIC_DEMO_PORT_FLAG } from "./access";
import { SYNTHETIC_DEMO_LIVE_AUTHORIZED_FLAG, SYNTHETIC_DEMO_PROVIDER_MODE_FLAG } from "./mode";
import { createConfiguredSyntheticDemoProvider } from "./provider-factory";
import { DeterministicSyntheticDemoProvider } from "./provider";
import { NineRouterSyntheticDemoProvider } from "./ninerouter-provider";

const liveEnvironment = {
  NODE_ENV: "development",
  [SYNTHETIC_DEMO_ENABLE_FLAG]: "true",
  [SYNTHETIC_DEMO_LAUNCHER_FLAG]: "127.0.0.1",
  [SYNTHETIC_DEMO_PORT_FLAG]: "3016",
  [SYNTHETIC_DEMO_PROVIDER_MODE_FLAG]: "LIVE_SYNTHETIC",
  [SYNTHETIC_DEMO_LIVE_AUTHORIZED_FLAG]: "true",
  AI_PROVIDER: NINEROUTER_PROVIDER,
  NINEROUTER_BASE_URL: "https://router.example.test/v1",
  NINEROUTER_MODEL: NINEROUTER_REQUESTED_MODEL,
  NINEROUTER_API_KEY: "synthetic-test-key-not-a-credential",
  [NINEROUTER_SYNTHETIC_SMOKE_FLAG]: "true",
};

describe("synthetic demo provider activation", () => {
  it("defaults to deterministic MOCK even when no provider flags are present", () => {
    expect(createConfiguredSyntheticDemoProvider({})).toBeInstanceOf(DeterministicSyntheticDemoProvider);
  });

  it.each([
    ["missing Product Owner authorization", { ...liveEnvironment, [SYNTHETIC_DEMO_LIVE_AUTHORIZED_FLAG]: "false" }],
    ["missing 9Router smoke confirmation", { ...liveEnvironment, [NINEROUTER_SYNTHETIC_SMOKE_FLAG]: "false" }],
    ["non-development runtime", { ...liveEnvironment, NODE_ENV: "production" }],
    ["demo launcher guard missing", { ...liveEnvironment, [SYNTHETIC_DEMO_LAUNCHER_FLAG]: undefined }],
    ["provider/model mismatch", { ...liveEnvironment, NINEROUTER_MODEL: "another-model" }],
    ["unknown mode", { ...liveEnvironment, [SYNTHETIC_DEMO_PROVIDER_MODE_FLAG]: "AUTOMATIC" }],
  ])("fails closed for %s without falling back to mock", async (_reason, env) => {
    const provider = createConfiguredSyntheticDemoProvider(env);
    expect(provider).not.toBeInstanceOf(DeterministicSyntheticDemoProvider);
    await expect(provider.generate({} as never, new AbortController().signal))
      .rejects.toBeInstanceOf(SyntheticDemoProviderFailureError);
  });

  it.each([
    [{ ...liveEnvironment, [SYNTHETIC_DEMO_LIVE_AUTHORIZED_FLAG]: "false" }, "LIVE_AUTHORIZATION_MISSING"],
    [{ ...liveEnvironment, NINEROUTER_API_KEY: "" }, "API_KEY_MISSING"],
    [{ ...liveEnvironment, NINEROUTER_MODEL: "another-model" }, "MODEL_MISMATCH"],
    [{ ...liveEnvironment, [NINEROUTER_SYNTHETIC_SMOKE_FLAG]: "false" }, "NINEROUTER_SMOKE_DISABLED"],
  ] as const)("returns a safe configuration diagnosis without an outbound request", async (env, category) => {
    const provider = createConfiguredSyntheticDemoProvider(env);
    await expect(provider.generate({} as never, new AbortController().signal))
      .rejects.toMatchObject({ category, outboundAttempted: false, upstreamStatus: null });
  });

  it("allows an explicitly authorized synthetic demo without billing-tier claims", () => {
    const provider = createConfiguredSyntheticDemoProvider(liveEnvironment);
    expect(provider).toBeInstanceOf(NineRouterSyntheticDemoProvider);
    expect(provider.execution).toMatchObject({ mode: "LIVE_SYNTHETIC", provider: "ninerouter", model: NINEROUTER_REQUESTED_MODEL });
  });

  it("requires the dedicated public HTTP opt-in for the exact local synthetic provider path", async () => {
    const httpEnvironment = {
      ...liveEnvironment,
      NINEROUTER_BASE_URL: "http://72.62.247.63:20128/v1",
    };

    await expect(createConfiguredSyntheticDemoProvider(httpEnvironment)
      .generate({} as never, new AbortController().signal))
      .rejects.toMatchObject({ category: "PUBLIC_HTTP_DEV_OPT_IN_REQUIRED", outboundAttempted: false });

    const enabled = createConfiguredSyntheticDemoProvider({
      ...httpEnvironment,
      [NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG]: "true",
    });
    expect(enabled).toBeInstanceOf(NineRouterSyntheticDemoProvider);
  });

  it("does not allow public HTTP in a production process even when every demo opt-in is set", async () => {
    const provider = createConfiguredSyntheticDemoProvider({
      ...liveEnvironment,
      NODE_ENV: "production",
      NINEROUTER_BASE_URL: "http://72.62.247.63:20128/v1",
      [NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG]: "true",
    });
    await expect(provider.generate({} as never, new AbortController().signal))
      .rejects.toMatchObject({ category: "LOCAL_DEMO_GUARD_DISABLED", outboundAttempted: false });
  });
});
