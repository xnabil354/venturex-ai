import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

import {
  NineRouterError,
  isLocalProfileNineRouterTransportAllowed,
  NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG,
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
import { generatedOpportunityDiagnosticContract, generatedOpportunityResultSchema } from "../opportunity/opportunity-analysis-validation";

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

const validNineRouterEnvironment = {
  AI_PROVIDER: "ninerouter",
  NINEROUTER_BASE_URL: "https://router.example.test/v1",
  NINEROUTER_API_KEY: "synthetic-test-key",
  NINEROUTER_MODEL: NINEROUTER_REQUESTED_MODEL,
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

afterEach(() => {
  vi.useRealTimers();
});

describe("9Router transport configuration", () => {
  it("sends a strict JSON schema with a union envelope and still validates the returned content", async () => {
    const schema = z.discriminatedUnion("outcome", [
      z.object({ outcome: z.literal("HYPOTHESES"), ideas: z.array(z.string()).min(1).max(3) }).strict(),
      z.object({ outcome: z.literal("INSUFFICIENT_EVIDENCE"), gaps: z.array(z.string()).min(1).max(5) }).strict(),
    ]);
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(init!.body as string);
      expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true, schema: { type: "object", required: ["result"], additionalProperties: false } } });
      expect(body.response_format.json_schema.schema.properties.result).toHaveProperty("anyOf");
      const systemMessage = body.messages.find((message: { role: string }) => message.role === "system").content as string;
      const guidanceSchema = JSON.parse(systemMessage.split("OUTPUT_JSON_SCHEMA\n")[1]!);
      expect(guidanceSchema).toEqual(body.response_format.json_schema.schema);
      return completion(JSON.stringify({ result: { outcome: "HYPOTHESES", ideas: ["synthetic"] } }));
    });
    await expect(generateNineRouterJson({ config, system: "Synthetic", prompt: "Return result", schema, structuredOutput: true, fetcher })).resolves.toEqual({ outcome: "HYPOTHESES", ideas: ["synthetic"] });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    { result: { status: "READY" }, extra: "never log this" },
    { result: { status: "READY", extra: "never log this" } },
  ])("rejects extra keys from a provider that ignores structured output without retries", async (response) => {
    const fetcher = vi.fn<typeof fetch>(async () => completion(JSON.stringify(response)));
    await expect(generateNineRouterJson({ config, system: "Synthetic", prompt: "Return result", schema: z.object({ status: z.literal("READY") }).strict(), structuredOutput: true, fetcher })).rejects.toMatchObject({
      category: "INVALID_RESPONSE", responseDiagnostic: { failure: "SCHEMA_VALIDATION_FAILED", issues: [expect.objectContaining({ code: "unrecognized_keys", receivedTypeCategory: "object" })] },
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("accepts the verified 60-second ceiling and defaults only when the variable is absent", () => {
    expect(readNineRouterConfig(validNineRouterEnvironment)?.timeoutMs).toBe(20_000);
    expect(readNineRouterConfig({ ...validNineRouterEnvironment, AI_ANALYSIS_TIMEOUT_MS: "60000" })?.timeoutMs).toBe(60_000);
  });

  it.each(["invalid", "", "999", "60001", "20000.5"])("rejects invalid configured timeout %j without falling back", (timeout) => {
    expect(readNineRouterConfig({ ...validNineRouterEnvironment, AI_ANALYSIS_TIMEOUT_MS: timeout })).toBeNull();
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("allows explicit development loopback opt-in for %s", (hostname) => {
    const env = {
      NODE_ENV: "development",
      AI_PROVIDER: "ninerouter",
      NINEROUTER_BASE_URL: `http://${hostname}:20128/v1`,
      NINEROUTER_API_KEY: "synthetic-test-key",
      NINEROUTER_MODEL: NINEROUTER_REQUESTED_MODEL,
      [NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG]: "true",
      NINEROUTER_LOOPBACK_TUNNEL_CONFIRMED: "false",
    };
    expect(readLocalProfileNineRouterConfig(env)?.baseURL).toBe(env.NINEROUTER_BASE_URL);
    expect(isLocalProfileNineRouterTransportAllowed(env.NINEROUTER_BASE_URL, env)).toBe(true);
    expect(readNineRouterConfig(env)).toBeNull();
    expect(readLocalProfileNineRouterConfig({ ...env, NODE_ENV: "production" })).toBeNull();
  });

  it("keeps the legacy broad development opt-in restricted to a loopback Opportunity endpoint", () => {
    const env = {
      ...localSyntheticHttpEnvironment,
      NINEROUTER_BASE_URL: "http://localhost:20128/v1",
    };
    expect(readLocalProfileNineRouterConfig(env)?.baseURL).toBe("http://localhost:20128/v1");
    expect(readLocalProfileNineRouterConfig({ ...env, NINEROUTER_BASE_URL: "http://72.62.247.63:20128/v1" })).toBeNull();
    expect(isLocalProfileNineRouterTransportAllowed("http://72.62.247.63:20128/v1", env)).toBe(false);
  });

  it.each([
    ["production", "http://localhost:20128/v1", { NODE_ENV: "production", [NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG]: "true" }],
    ["missing opt-in", "http://localhost:20128/v1", { NODE_ENV: "development" }],
    ["public HTTP", "http://router.example.test:20128/v1", { NODE_ENV: "development", [NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG]: "true" }],
    ["non-canonical loopback alias", "http://2130706433:20128/v1", { NODE_ENV: "development", [NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG]: "true" }],
    ["wrong port", "http://localhost:20129/v1", { NODE_ENV: "development", [NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG]: "true" }],
    ["wrong path", "http://localhost:20128/other", { NODE_ENV: "development", [NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG]: "true" }],
    ["invalid URL", "http://localhost:20128/v1 space", { NODE_ENV: "development", [NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG]: "true" }],
    ["embedded credentials", "http://user:pass@localhost:20128/v1", { NODE_ENV: "development", [NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG]: "true" }],
  ] as const)("rejects %s for local-profile transport", (_name, url, flags) => {
    expect(isLocalProfileNineRouterTransportAllowed(url, flags)).toBe(false);
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
    expect(diagnostics).toMatchObject([{
      inferenceStartedAt: expect.any(String),
      timeoutMs: config.timeoutMs,
      systemPromptBytes: Buffer.byteLength("You are a test adapter.", "utf8"),
      userPromptBytes: Buffer.byteLength("Synthetic test only.", "utf8"),
      promptBytes: expect.any(Number),
      requestBodyBytes: expect.any(Number),
      outboundRequestStartedAfterMs: expect.any(Number),
      responseHeadersReceivedAfterMs: expect.any(Number),
      responseBodyCompletedAfterMs: expect.any(Number),
      activeRequestsAtStart: expect.any(Number),
      activeRequestsAtEnd: expect.any(Number),
      maxConcurrentRequests: 2,
      concurrencySlotAcquired: true,
      abortOrigin: "NONE",
      timeoutCategory: null,
      schemaValidationOutcome: "PASSED",
    }]);
  });

  it("aborts one slow request at the configured total deadline and classifies it as an application timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error("Expected the SDK abort signal."));
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    const diagnostics: unknown[] = [];
    const pending = generateNineRouterJson({
      config,
      system: "x",
      prompt: "slow request",
      schema: opportunityAnalysisSchema,
      fetcher,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    const assertion = expect(pending).rejects.toMatchObject({
      category: "TIMEOUT",
      upstreamStatus: null,
      outboundAttempted: true,
    });

    await vi.advanceTimersByTimeAsync(config.timeoutMs);
    await assertion;

    expect(fetcher).toHaveBeenCalledOnce();
    expect(diagnostics).toMatchObject([{
      category: "TIMEOUT",
      timeoutMs: config.timeoutMs,
      timeoutCategory: "APPLICATION_DEADLINE",
      abortOrigin: "APPLICATION_TIMEOUT",
      outboundRequestStartedAfterMs: expect.any(Number),
      responseHeadersReceivedAfterMs: null,
      responseBodyCompletedAfterMs: null,
      schemaValidationOutcome: "NOT_RUN",
    }]);
  });

  it("propagates an external client abort to the transport and reports its origin separately", async () => {
    const controller = new AbortController();
    const transportSignals: AbortSignal[] = [];
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_resolve, reject) => {
      const transportSignal = init?.signal;
      if (transportSignal) {
        transportSignals.push(transportSignal);
        transportSignal.addEventListener("abort", () => reject(transportSignal.reason), { once: true });
      }
    }));
    const diagnostics: unknown[] = [];
    const pending = generateNineRouterJson({
      config,
      system: "x",
      prompt: "client abort",
      schema: opportunityAnalysisSchema,
      fetcher,
      signal: controller.signal,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const assertion = expect(pending).rejects.toMatchObject({ category: "CLIENT_ABORTED", outboundAttempted: true });

    controller.abort(new DOMException("Client disconnected", "AbortError"));
    await assertion;

    expect(fetcher).toHaveBeenCalledOnce();
    expect(transportSignals[0]?.aborted).toBe(true);
    expect(diagnostics).toMatchObject([{
      category: "CLIENT_ABORTED",
      abortOrigin: "CLIENT",
      timeoutCategory: "CLIENT_ABORT",
      schemaValidationOutcome: "NOT_RUN",
    }]);
  });

  it("classifies an outer application deadline separately from a client disconnect", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const diagnostics: unknown[] = [];
    const pending = generateNineRouterJson({ config, system: "x", prompt: "deadline",
      schema: opportunityAnalysisSchema, fetcher, signal: controller.signal,
      onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
    const assertion = expect(pending).rejects.toMatchObject({ category: "TIMEOUT" });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    controller.abort(new DOMException("Application deadline", "TimeoutError"));
    await assertion;
    expect(diagnostics).toMatchObject([{ category: "TIMEOUT", abortOrigin: "APPLICATION_TIMEOUT", timeoutCategory: "APPLICATION_DEADLINE" }]);
  });

  it("records safe metadata for AI paths without a custom diagnostic callback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const logger = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await generateNineRouterJson({ config, system: "PRIVATE_SYSTEM", prompt: "PRIVATE_PROFILE",
        schema: opportunityAnalysisSchema, fetcher: async () => completion(JSON.stringify(testAnalysis)) });
      expect(logger).toHaveBeenCalledWith("venturex_ai_provider_result", expect.objectContaining({ category: "SUCCESS", upstreamStatus: 200, schemaValidationOutcome: "PASSED" }));
      const logged = JSON.stringify(logger.mock.calls);
      expect(logged).not.toContain("PRIVATE_SYSTEM");
      expect(logged).not.toContain("PRIVATE_PROFILE");
      expect(logged).not.toContain(config.apiKey);
      expect(logged).not.toContain(testAnalysis.summary);
    } finally {
      logger.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it("distinguishes an upstream HTTP timeout response from the local request deadline", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("timeout", { status: 504 }));
    const diagnostics: unknown[] = [];

    await expect(generateNineRouterJson({
      config,
      system: "x",
      prompt: "upstream timeout",
      schema: opportunityAnalysisSchema,
      fetcher,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    })).rejects.toMatchObject({ category: "UPSTREAM_TIMEOUT", upstreamStatus: 504 });

    expect(diagnostics).toMatchObject([{
      category: "UPSTREAM_TIMEOUT",
      upstreamStatus: 504,
      timeoutCategory: "UPSTREAM_HTTP_TIMEOUT",
      abortOrigin: "NONE",
    }]);
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

  it("reports exact safe Opportunity Finder schema paths and shape metadata", async () => {
    const privateValue = "private-provider-response-value";
    const fetcher = vi.fn<typeof fetch>(async () => completion(JSON.stringify({
      outcome: "HYPOTHESES",
      ideas: [{
        title: "Eksperimen kemasan",
        opportunityType: "UNSUPPORTED_TYPE",
        concept: "Uji konsep kemasan yang praktis bersama pelanggan yang sudah ada.",
        targetCustomer: 17,
        validationSteps: ["Langkah pertama yang cukup panjang", "Langkah kedua yang cukup panjang", "Langkah tiga yang cukup panjang", "Langkah empat yang cukup panjang", "Langkah lima yang cukup panjang", "Langkah enam yang cukup panjang"],
        assumptions: ["Pelanggan mungkin tertarik mencoba kemasan praktis."],
        profileAlignment: ["Sesuai dengan konteks usaha yang telah dinyatakan."],
        profileReferences: ["profile.products"],
        evidenceInterpretation: "Kueri pencarian hanya menunjukkan minat, bukan pembelian.",
        evidenceReferences: ["safe-source-id"],
        evidenceGaps: ["Belum ada data penerimaan pelanggan untuk kemasan."],
        limitations: ["Google Trends tidak mengukur pembelian atau keuntungan."],
        privateUnknownField: privateValue,
      }],
    })));
    let caught: unknown;
    try {
      await generateNineRouterJson({
        config,
        system: "x",
        prompt: "y",
        schema: generatedOpportunityResultSchema,
        diagnosticContract: generatedOpportunityDiagnosticContract,
        fetcher,
      });
    } catch (error) { caught = error; }

    expect(caught).toMatchObject({
      category: "INVALID_RESPONSE",
      responseDiagnostic: {
        failure: "SCHEMA_VALIDATION_FAILED",
        correlationId: expect.stringMatching(/^ai_/u),
        model: NINEROUTER_REQUESTED_MODEL,
        upstreamStatus: 200,
        durationMs: expect.any(Number),
        issues: expect.arrayContaining([
          expect.objectContaining({
            path: "ideas[0].opportunityType",
            code: "invalid_value",
            rejectionRule: "VALUE_OUTSIDE_ALLOWED_ENUM",
            allowedTypeCategory: "enum",
            allowedValues: expect.arrayContaining(["NEW_VARIANT"]),
          }),
          expect.objectContaining({
            path: "ideas[0].targetCustomer",
            code: "invalid_type",
            rejectionRule: "TYPE_MISMATCH",
            allowedTypeCategory: "string",
            receivedTypeCategory: "number",
          }),
          expect.objectContaining({
            path: "ideas[0].validationSteps",
            code: "too_big",
            rejectionRule: "MAXIMUM_EXCEEDED",
            allowedTypeCategory: "array",
            arrayLength: 6,
            configuredMaximum: 5,
          }),
        ]),
      },
    });
    expect(JSON.stringify(caught)).not.toContain(privateValue);
    expect(JSON.stringify(caught)).not.toContain("privateUnknownField");
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
