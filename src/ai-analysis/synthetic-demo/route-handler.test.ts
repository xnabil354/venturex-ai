import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  SYNTHETIC_DEMO_ENABLE_FLAG,
  SYNTHETIC_DEMO_LAUNCHER_FLAG,
  SYNTHETIC_DEMO_PORT_FLAG,
} from "./access";
import { createSyntheticDemoPOST } from "./route-handler";
import { SyntheticDemoProviderFailureError, SyntheticDemoResponseInvalidError } from "./service";

const env = {
  NODE_ENV: "development",
  [SYNTHETIC_DEMO_ENABLE_FLAG]: "true",
  [SYNTHETIC_DEMO_LAUNCHER_FLAG]: "127.0.0.1",
  [SYNTHETIC_DEMO_PORT_FLAG]: "3016",
};

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3016/api/local/synthetic-ai-demo", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3016",
      origin: "http://127.0.0.1:3016",
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

describe("synthetic demo POST handler", () => {
  it("returns a no-store success only for an approved fixture request", async () => {
    const generate = vi.fn().mockResolvedValue({
      fixtureId: "DEMO_ENTREPRENEUR",
      execution: {
        mode: "MOCK",
        provider: "local-mock",
        model: "synthetic-fixture-v1",
        displayLabel: "Contoh hasil simulasi — bukan respons 9Router live",
      },
    });
    const post = createSyntheticDemoPOST({ env, service: { generate } });
    const response = await post(request(JSON.stringify({ fixtureId: "DEMO_ENTREPRENEUR" })));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ data: {
      fixtureId: "DEMO_ENTREPRENEUR",
      execution: {
        mode: "MOCK",
        provider: "local-mock",
        model: "synthetic-fixture-v1",
        displayLabel: "Contoh hasil simulasi — bukan respons 9Router live",
      },
    } });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith({ fixtureId: "DEMO_ENTREPRENEUR" });
  });

  it.each([
    { name: "default disabled", testEnv: {}, host: "127.0.0.1:3016", origin: "http://127.0.0.1:3016" },
    { name: "production", testEnv: { ...env, NODE_ENV: "production" }, host: "127.0.0.1:3016", origin: "http://127.0.0.1:3016" },
    { name: "nonlocal host", testEnv: env, host: "192.168.1.4:3016", origin: "http://192.168.1.4:3016" },
    { name: "cross origin", testEnv: env, host: "127.0.0.1:3016", origin: "http://evil.example" },
  ])("denies $name before invoking the service", async ({ testEnv, host, origin }) => {
    const generate = vi.fn();
    const post = createSyntheticDemoPOST({ env: testEnv, service: { generate } });
    const response = await post(request(JSON.stringify({ fixtureId: "DEMO_ENTREPRENEUR" }), { host, origin }));
    expect(response.status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    JSON.stringify({ fixtureId: "DEMO_ENTREPRENEUR", profile: { name: "user" } }),
    JSON.stringify({ fixtureId: "DEMO_UNKNOWN" }),
    JSON.stringify({ fixtureId: "DEMO_UMKM", context: "client truth" }),
    "{ malformed",
  ])("rejects malformed or client-authored facts", async (body) => {
    const generate = vi.fn();
    const post = createSyntheticDemoPOST({ env, service: { generate } });
    const response = await post(request(body));
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies before service invocation", async () => {
    const generate = vi.fn();
    const post = createSyntheticDemoPOST({ env, service: { generate } });
    const response = await post(request(JSON.stringify({ fixtureId: "DEMO_ENTREPRENEUR", excess: "x".repeat(1100) })));
    expect(response.status).toBe(413);
    expect(generate).not.toHaveBeenCalled();
  });

  it("sanitizes provider failure and invalid-output errors", async () => {
    const failure = createSyntheticDemoPOST({ env, service: { generate: vi.fn().mockRejectedValue(
      new SyntheticDemoProviderFailureError("UNKNOWN_PROVIDER_ERROR", null, null),
    ) } });
    const invalid = createSyntheticDemoPOST({ env, service: { generate: vi.fn().mockRejectedValue(new SyntheticDemoResponseInvalidError()) } });
    const failureResponse = await failure(request(JSON.stringify({ fixtureId: "DEMO_UMKM" })));
    expect(failureResponse.status).toBe(503);
    expect(failureResponse.headers.get("x-request-id")).toBeTruthy();
    expect(await failureResponse.json()).toMatchObject({
      error: "DEMO_PROVIDER_UNAVAILABLE",
      diagnostic: { category: "UNKNOWN_PROVIDER_ERROR", upstreamStatus: null, outboundAttempted: null },
    });
    const invalidResponse = await invalid(request(JSON.stringify({ fixtureId: "DEMO_UMKM" })));
    expect(invalidResponse.status).toBe(502);
    expect(await invalidResponse.json()).toMatchObject({ error: "DEMO_RESPONSE_INVALID", diagnostic: { category: "INVALID_RESPONSE" } });
  });

  it("reports only safe upstream status/category for provider failures", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failure = createSyntheticDemoPOST({ env, service: { generate: vi.fn().mockRejectedValue(
      new SyntheticDemoProviderFailureError("UPSTREAM_UNAVAILABLE", 503, true),
    ) } });
    const response = await failure(request(JSON.stringify({ fixtureId: "DEMO_UMKM" })));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "DEMO_UPSTREAM_UNAVAILABLE",
      diagnostic: { category: "UPSTREAM_UNAVAILABLE", upstreamStatus: 503, outboundAttempted: true },
    });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|credential|prompt|response body/iu);
    log.mockRestore();
  });

  it("returns only bounded output-shape diagnostics for invalid provider JSON", async () => {
    const providerText = "do-not-return-provider-text";
    const response = await createSyntheticDemoPOST({ env, service: { generate: vi.fn().mockRejectedValue(
      new SyntheticDemoProviderFailureError("INVALID_PROVIDER_RESPONSE", 200, true, {
        failure: "SCHEMA_VALIDATION_FAILED",
        jsonRootType: "object",
        issueCount: 3,
        issues: [
          { path: "analysis.summary", code: "invalid_type" },
          { path: "[key]", code: "unrecognized_keys" },
        ],
      }),
    ) } })(request(JSON.stringify({ fixtureId: "DEMO_UMKM" })));
    const body = await response.json() as { diagnostic?: unknown };

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      error: "DEMO_RESPONSE_INVALID",
      diagnostic: {
        category: "INVALID_RESPONSE",
        upstreamStatus: 200,
        outboundAttempted: true,
        response: {
          failure: "SCHEMA_VALIDATION_FAILED",
          jsonRootType: "object",
          issueCount: 3,
          issues: [
            { path: "analysis.summary", code: "invalid_type" },
            { path: "[key]", code: "unrecognized_keys" },
          ],
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain(providerText);
  });

  it("separates a local provider configuration failure from an upstream failure", async () => {
    const failure = createSyntheticDemoPOST({ env, service: { generate: vi.fn().mockRejectedValue(
      new SyntheticDemoProviderFailureError("API_KEY_MISSING", null, false),
    ) } });
    const response = await failure(request(JSON.stringify({ fixtureId: "DEMO_UMKM" })));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "DEMO_PROVIDER_CONFIGURATION_UNAVAILABLE",
      diagnostic: { category: "API_KEY_MISSING", upstreamStatus: null, outboundAttempted: false },
    });
  });
});
