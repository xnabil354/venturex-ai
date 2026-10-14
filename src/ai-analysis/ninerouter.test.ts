import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  NineRouterError,
  NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG,
  NINEROUTER_REQUESTED_MODEL,
  NINEROUTER_SYNTHETIC_SMOKE_FLAG,
  type NineRouterConfig,
  generateNineRouterJson,
  isPublicHttpTransport,
  readLocalProfileNineRouterConfig,
  readNineRouterConfig,
  readSyntheticDemoNineRouterConfig,
} from "./ninerouter";
import { opportunityAnalysisSchema } from "./domain";
import { testAnalysis } from "./test-fixtures";

const config: NineRouterConfig = {
  provider: "ninerouter",
  baseURL: "https://router.example.test/v1",
  apiKey: "synthetic-test-key",
  model: NINEROUTER_REQUESTED_MODEL,
  timeoutMs: 1_000,
};

const localSyntheticHttpEnvironment = {
  NODE_ENV: "development",
  AI_PROVIDER: "ninerouter",
  NINEROUTER_BASE_URL: "http://72.62.247.63:20128/v1",
  NINEROUTER_API_KEY: "synthetic-test-key",
  NINEROUTER_MODEL: NINEROUTER_REQUESTED_MODEL,
  [NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG]: "true",
  [NINEROUTER_SYNTHETIC_SMOKE_FLAG]: "true",
  AI_ANALYSIS_SYNTHETIC_DEMO_ENABLED: "true",
  VENTUREX_SYNTHETIC_DEMO_LOOPBACK_LAUNCHER: "127.0.0.1",
  VENTUREX_SYNTHETIC_DEMO_PORT: "3016",
  AI_ANALYSIS_SYNTHETIC_DEMO_PROVIDER_MODE: "LIVE_SYNTHETIC",
  AI_ANALYSIS_SYNTHETIC_DEMO_LIVE_AUTHORIZED: "true",
};

function completion(content: string, status = 200): Response {
  return Response.json({
    id: "chatcmpl-synthetic",
    object: "chat.completion",
    created: 1,
    model: NINEROUTER_REQUESTED_MODEL,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }, { status });
}

describe("9Router transport configuration", () => {
  it("allows opted-in local profile flows to use loopback HTTP in development only", () => {
    const localEndpoint = {
      ...localSyntheticHttpEnvironment,
      NINEROUTER_BASE_URL: "http://localhost:20128/v1",
    };
    expect(readLocalProfileNineRouterConfig(localEndpoint)?.baseURL).toBe("http://localhost:20128/v1");
    expect(readNineRouterConfig(localEndpoint)).toBeNull();
    expect(readLocalProfileNineRouterConfig({ ...localEndpoint, NODE_ENV: "production" })).toBeNull();
  });

  it("marks only non-loopback HTTP destinations as public transport", () => {
    expect(isPublicHttpTransport("http://localhost:20128/v1")).toBe(false);
    expect(isPublicHttpTransport("http://127.0.0.1:20128/v1")).toBe(false);
    expect(isPublicHttpTransport("http://[::1]:20128/v1")).toBe(false);
    expect(isPublicHttpTransport("http://router.example.test:20128/v1")).toBe(true);
    expect(isPublicHttpTransport("https://router.example.test/v1")).toBe(false);
  });

  it("keeps public HTTP rejected for normal inference even when the demo opt-in is present", () => {
    expect(readNineRouterConfig(localSyntheticHttpEnvironment)).toBeNull();
  });

  it("allows only the exact public endpoint for fully enabled local synthetic mode", () => {
    expect(readSyntheticDemoNineRouterConfig(localSyntheticHttpEnvironment)).toMatchObject({
      baseURL: "http://72.62.247.63:20128/v1",
      model: NINEROUTER_REQUESTED_MODEL,
    });
  });

  it.each([
    ["opt-in missing", { ...localSyntheticHttpEnvironment, [NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG]: "false" }],
    ["not development", { ...localSyntheticHttpEnvironment, NODE_ENV: "production" }],
    ["demo disabled", { ...localSyntheticHttpEnvironment, AI_ANALYSIS_SYNTHETIC_DEMO_ENABLED: "false" }],
    ["not loopback launcher", { ...localSyntheticHttpEnvironment, VENTUREX_SYNTHETIC_DEMO_LOOPBACK_LAUNCHER: "0.0.0.0" }],
    ["mock mode", { ...localSyntheticHttpEnvironment, AI_ANALYSIS_SYNTHETIC_DEMO_PROVIDER_MODE: "MOCK" }],
    ["live authorization missing", { ...localSyntheticHttpEnvironment, AI_ANALYSIS_SYNTHETIC_DEMO_LIVE_AUTHORIZED: "false" }],
    ["smoke gate missing", { ...localSyntheticHttpEnvironment, [NINEROUTER_SYNTHETIC_SMOKE_FLAG]: "false" }],
    ["different public host", { ...localSyntheticHttpEnvironment, NINEROUTER_BASE_URL: "http://router.example.test:20128/v1" }],
    ["different path", { ...localSyntheticHttpEnvironment, NINEROUTER_BASE_URL: "http://72.62.247.63:20128/other" }],
  ])("rejects public HTTP when %s", (_case, env) => {
    expect(readSyntheticDemoNineRouterConfig(env)).toBeNull();
  });
});

describe("9Router Chat Completions adapter", () => {
  it("uses one bearer-authenticated request with the exact requested model and validates JSON locally", async () => {
    const requests: Request[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      requests.push(input instanceof Request ? input : new Request(input, init));
      return completion(JSON.stringify(testAnalysis));
    });
    const diagnostics: unknown[] = [];
    const output = await generateNineRouterJson({
      config,
      system: "You are a test adapter.",
      prompt: "Synthetic test only.",
      schema: opportunityAnalysisSchema,
      fetcher,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    expect(output).toEqual(testAnalysis);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(requests[0]?.url).toBe("https://router.example.test/v1/chat/completions");
    expect(requests[0]?.method).toBe("POST");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer synthetic-test-key");
    const body = await requests[0]?.clone().json() as { model: string; messages: unknown[]; stream?: boolean };
    expect(body.model).toBe(NINEROUTER_REQUESTED_MODEL);
    expect(body.stream).not.toBe(true);
    expect(body.messages).toHaveLength(2);
    expect(diagnostics).toMatchObject([{ category: "SUCCESS", outboundAttempted: true, upstreamStatus: 200 }]);
  });

  it("classifies empty text without retaining provider content", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => completion(""));
    await expect(generateNineRouterJson({ config, system: "x", prompt: "y", schema: opportunityAnalysisSchema, fetcher }))
      .rejects.toMatchObject({ category: "INVALID_RESPONSE", responseDiagnostic: { failure: "EMPTY_TEXT" } });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("classifies invalid JSON without returning provider text", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => completion("not-json-secret"));
    let caught: unknown;
    try {
      await generateNineRouterJson({ config, system: "x", prompt: "y", schema: opportunityAnalysisSchema, fetcher });
    } catch (error) { caught = error; }
    expect(caught).toMatchObject({ category: "INVALID_RESPONSE", responseDiagnostic: { failure: "INVALID_JSON" } });
    expect(String(caught)).not.toContain("not-json-secret");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("reports bounded schema paths and codes without provider values or arbitrary keys", async () => {
    const providerSecret = "private-provider-value";
    const fetcher = vi.fn<typeof fetch>(async () => completion(JSON.stringify({
      summary: providerSecret,
      whyRelevant: "wrong root shape",
      unexpectedPrivateKey: "do not expose",
    })));
    let caught: unknown;
    try {
      await generateNineRouterJson({ config, system: "x", prompt: "y", schema: opportunityAnalysisSchema, fetcher });
    } catch (error) { caught = error; }
    expect(caught).toMatchObject({
      category: "INVALID_RESPONSE",
      responseDiagnostic: {
        failure: "SCHEMA_VALIDATION_FAILED",
        jsonRootType: "object",
        issueCount: expect.any(Number),
        issues: expect.arrayContaining([expect.objectContaining({ path: "targetConsumer", code: "invalid_type" })]),
      },
    });
    expect(JSON.stringify(caught)).not.toContain(providerSecret);
    expect(JSON.stringify(caught)).not.toContain("unexpectedPrivateKey");
    expect(JSON.stringify(caught)).not.toContain("do not expose");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not retry upstream errors and exposes no response body", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("secret upstream detail", { status: 503 }));
    const diagnostics: unknown[] = [];
    let caught: unknown;
    try {
      await generateNineRouterJson({ config, system: "x", prompt: "y", schema: opportunityAnalysisSchema, fetcher, onDiagnostic: (value) => diagnostics.push(value) });
    } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(NineRouterError);
    expect(caught).toMatchObject({ category: "UPSTREAM_UNAVAILABLE", upstreamStatus: 503 });
    expect(String(caught)).not.toContain("secret upstream detail");
    expect(fetcher).toHaveBeenCalledOnce();
    expect(diagnostics).toMatchObject([{ category: "UPSTREAM_UNAVAILABLE", outboundAttempted: true, upstreamStatus: 503 }]);
  });

  it("rejects oversized provider responses before parsing", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("x".repeat(64 * 1024 + 1), {
      status: 200,
      headers: { "content-length": String(64 * 1024 + 1) },
    }));
    await expect(generateNineRouterJson({ config, system: "x", prompt: "y", schema: opportunityAnalysisSchema, fetcher }))
      .rejects.toMatchObject({ category: "RESPONSE_TOO_LARGE" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not call provider if explicit configuration is null", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(generateNineRouterJson({ config: null, system: "x", prompt: "y", schema: opportunityAnalysisSchema, fetcher }))
      .rejects.toMatchObject({ category: "CONFIGURATION_UNAVAILABLE" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not let a failing diagnostic callback change a valid provider result", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => completion(JSON.stringify(testAnalysis)));
    await expect(generateNineRouterJson({
      config,
      system: "x",
      prompt: "y",
      schema: opportunityAnalysisSchema,
      fetcher,
      onDiagnostic: () => { throw new Error("diagnostic failure"); },
    })).resolves.toEqual(testAnalysis);
  });
});
