import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, generateText } from "ai";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const NINEROUTER_PROVIDER = "ninerouter" as const;
export const NINEROUTER_REQUESTED_MODEL = "cx/gpt-6-luna-xhigh" as const;
export const NINEROUTER_LOOPBACK_TUNNEL_FLAG = "NINEROUTER_LOOPBACK_TUNNEL_CONFIRMED" as const;
export const NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG = "NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY" as const;
export const NINEROUTER_SYNTHETIC_SMOKE_FLAG = "AI_ANALYSIS_NINEROUTER_SYNTHETIC_SMOKE_ENABLED" as const;

const PUBLIC_HTTP_DEV_ONLY_ENDPOINT = "http://72.62.247.63:20128/v1";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const timeoutSchema = z.coerce.number().int().min(1_000).max(60_000).catch(20_000);
const boundedIdentifier = z.string().trim().min(1).max(120);

function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}
export function isPublicHttpTransport(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" && !isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export type NineRouterConfig = Readonly<{
  provider: typeof NINEROUTER_PROVIDER;
  baseURL: string;
  apiKey: string;
  model: typeof NINEROUTER_REQUESTED_MODEL;
  timeoutMs: number;
}>;

export type NineRouterErrorCategory =
  | "CONFIGURATION_UNAVAILABLE"
  | "REQUEST_REJECTED"
  | "CONCURRENCY_LIMIT"
  | "RATE_LIMITED"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_HTTP"
  | "TIMEOUT"
  | "NETWORK"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_RESPONSE";

export type NineRouterResponseDiagnostic = Readonly<
  | { failure: "EMPTY_TEXT" }
  | { failure: "INVALID_JSON" }
  | {
    failure: "SCHEMA_VALIDATION_FAILED";
    jsonRootType: "object" | "array" | "string" | "number" | "boolean" | "null";
    issueCount: number;
    issues: readonly Readonly<{ path: string; code: string }>[];
  }
>;

export class NineRouterError extends Error {
  override readonly name = "NineRouterError";

  constructor(
    readonly category: NineRouterErrorCategory,
    readonly upstreamStatus: number | null = null,
    readonly outboundAttempted = false,
    readonly responseDiagnostic: NineRouterResponseDiagnostic | null = null,
  ) {
    super("The configured AI provider could not complete this request.");
  }
}

export type NineRouterDiagnostic = Readonly<{
  requestId: string;
  provider: typeof NINEROUTER_PROVIDER;
  model: string;
  protocol: "CHAT_COMPLETIONS";
  upstreamStatus: number | null;
  responseBytes: number | null;
  durationMs: number;
  category: "SUCCESS" | NineRouterErrorCategory;
  outboundAttempted: boolean;
}>;

function normalizeBaseURL(
  value: string | undefined,
  loopbackTunnelConfirmed: boolean,
  publicHttpDevOnlyAllowed = false,
): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const isApprovedLoopbackHttp = parsed.protocol === "http:"
      && isLoopbackHostname(parsed.hostname)
      && (loopbackTunnelConfirmed || publicHttpDevOnlyAllowed);
    const isApprovedPublicHttpDemoEndpoint = parsed.protocol === "http:"
      && value === PUBLIC_HTTP_DEV_ONLY_ENDPOINT
      && publicHttpDevOnlyAllowed;
    if ((parsed.protocol !== "https:" && !isApprovedLoopbackHttp && !isApprovedPublicHttpDemoEndpoint)
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
      || parsed.pathname.replace(/\/$/u, "") !== "/v1") return null;
    return `${parsed.origin}/v1`;
  } catch {
    return null;
  }
}

function readConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
  publicHttpDevOnlyAllowed = false,
): NineRouterConfig | null {
  const tunnelConfirmed = env[NINEROUTER_LOOPBACK_TUNNEL_FLAG] === "true";
  const configuredBaseURL = env.NINEROUTER_BASE_URL?.trim();
  const baseURL = normalizeBaseURL(configuredBaseURL, tunnelConfirmed, publicHttpDevOnlyAllowed);
  const apiKey = env.NINEROUTER_API_KEY?.trim();
  const model = boundedIdentifier.safeParse(env.NINEROUTER_MODEL);

  if (env.AI_PROVIDER !== NINEROUTER_PROVIDER
    || !baseURL
    || !apiKey
    || !model.success
    || model.data !== NINEROUTER_REQUESTED_MODEL) return null;

  return {
    provider: NINEROUTER_PROVIDER,
    baseURL,
    apiKey,
    model: NINEROUTER_REQUESTED_MODEL,
    timeoutMs: timeoutSchema.parse(env.AI_ANALYSIS_TIMEOUT_MS ?? 20_000),
  };
}

/** Normal authenticated inference never opts into public plaintext HTTP. */
export function readNineRouterConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): NineRouterConfig | null {
  return readConfig(env);
}

/**
 * Separate opt-in for consented local profile analysis. The normal Opportunity
 * Analysis provider continues to use readNineRouterConfig. In development,
 * the operator opt-in permits loopback HTTP or the single documented public
 * demo endpoint; public HTTP remains unencrypted.
 */
export function readLocalProfileNineRouterConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): NineRouterConfig | null {
  const publicHttpDevOnlyAllowed = env.NODE_ENV === "development"
    && env[NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG] === "true";
  return readConfig(env, publicHttpDevOnlyAllowed);
}

/**
 * This separate reader is only used by the fixed local synthetic demo. It can
 * admit the documented public HTTP destination or a loopback endpoint after
 * every local demo gate is enabled. Public HTTP remains unencrypted.
 */
export function readSyntheticDemoNineRouterConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): NineRouterConfig | null {
  const port = env.VENTUREX_SYNTHETIC_DEMO_PORT;
  const publicHttpDevOnlyAllowed = env.NODE_ENV === "development"
    && env[NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG] === "true"
    && env.AI_ANALYSIS_SYNTHETIC_DEMO_ENABLED === "true"
    && env.VENTUREX_SYNTHETIC_DEMO_LOOPBACK_LAUNCHER === "127.0.0.1"
    && Boolean(port && /^\d{4,5}$/u.test(port) && Number(port) >= 1024 && Number(port) <= 65535)
    && env.AI_ANALYSIS_SYNTHETIC_DEMO_PROVIDER_MODE === "LIVE_SYNTHETIC"
    && env.AI_ANALYSIS_SYNTHETIC_DEMO_LIVE_AUTHORIZED === "true"
    && env[NINEROUTER_SYNTHETIC_SMOKE_FLAG] === "true";

  return readConfig(env, publicHttpDevOnlyAllowed);
}

export const nineRouterLimits = Object.freeze({
  maxConcurrentRequests: 2,
  maxRequestBytes: 48 * 1024,
  maxResponseBytes: 64 * 1024,
});

let activeRequests = 0;

function acquireConcurrencySlot(): () => void {
  if (activeRequests >= nineRouterLimits.maxConcurrentRequests) {
    throw new NineRouterError("CONCURRENCY_LIMIT");
  }
  activeRequests += 1;
  return () => { activeRequests = Math.max(0, activeRequests - 1); };
}

function timeoutCause(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (!(current instanceof Error)) return false;
    if (current.name === "TimeoutError" || current.name === "AbortError") return true;
    current = current.cause;
  }
  return false;
}

function mapProviderError(error: unknown): NineRouterError {
  if (error instanceof NineRouterError) return error;
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return new NineRouterError("RATE_LIMITED", 429, true);
    if (error.statusCode === 401 || error.statusCode === 403) return new NineRouterError("UPSTREAM_AUTH", error.statusCode, true);
    if (error.statusCode === 503) return new NineRouterError("UPSTREAM_UNAVAILABLE", 503, true);
    if (typeof error.statusCode === "number") return new NineRouterError("UPSTREAM_HTTP", error.statusCode, true);
  }
  if (timeoutCause(error)) return new NineRouterError("TIMEOUT", null, true);
  return new NineRouterError("NETWORK", null, true);
}

const knownResponsePathSegments = new Set([
  "analysis", "evidenceReferences", "summary", "whyRelevant", "targetConsumer",
  "competition", "potential", "risks", "nextAction",
]);
const knownZodIssueCodes = new Set([
  "invalid_type", "unrecognized_keys", "too_small", "too_big", "invalid_value",
  "invalid_format", "custom", "not_multiple_of",
]);

function safeResponseDiagnosticPath(path: readonly PropertyKey[]): string {
  return path.slice(0, 5).map((segment) => {
    if (typeof segment === "number" && Number.isSafeInteger(segment) && segment >= 0) return "[index]";
    if (typeof segment === "string" && knownResponsePathSegments.has(segment)) return segment;
    return "[key]";
  }).join(".");
}

function safeSchemaDiagnostic(value: unknown, issues: readonly z.core.$ZodIssue[]): NineRouterResponseDiagnostic {
  const jsonRootType = value === null ? "null"
    : Array.isArray(value) ? "array"
      : typeof value as "object" | "string" | "number" | "boolean";
  const safeRootType = jsonRootType === "object" || jsonRootType === "array"
    || jsonRootType === "string" || jsonRootType === "number" || jsonRootType === "boolean"
    || jsonRootType === "null" ? jsonRootType : "null";

  return {
    failure: "SCHEMA_VALIDATION_FAILED",
    jsonRootType: safeRootType,
    issueCount: Math.min(issues.length, 100),
    issues: issues.slice(0, 8).map((issue) => ({
      path: safeResponseDiagnosticPath(issue.path),
      code: knownZodIssueCodes.has(issue.code) ? issue.code : "other",
    })),
  };
}

function logSafeResponseDiagnostic(requestId: string, diagnostic: NineRouterResponseDiagnostic): void {
  if (process.env.NODE_ENV === "production") return;
  console.info("[ninerouter] response rejected", JSON.stringify({
    requestId,
    provider: NINEROUTER_PROVIDER,
    model: NINEROUTER_REQUESTED_MODEL,
    diagnostic,
  }));
}

async function readBoundedResponse(response: Response, maximumBytes: number): Promise<{ response: Response; bytes: number }> {
  const length = response.headers.get("content-length");
  if (length && /^\d+$/u.test(length) && Number(length) > maximumBytes) {
    await response.body?.cancel();
    throw new NineRouterError("RESPONSE_TOO_LARGE", response.status, true);
  }
  if (!response.body) return { response, bytes: 0 };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new NineRouterError("RESPONSE_TOO_LARGE", response.status, true);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    response: new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers }),
    bytes: total,
  };
}

function guardedFetch(
  config: NineRouterConfig,
  fetcher: typeof fetch,
  diagnostics: { upstreamStatus: number | null; responseBytes: number | null; outboundAttempted: boolean },
  limits: { requestBytes: number; responseBytes: number },
): typeof fetch {
  let attempts = 0;
  const expectedURL = `${config.baseURL}/chat/completions`;

  return async (input, init) => {
    let requestURL: URL;
    try {
      requestURL = new URL(input instanceof Request ? input.url : String(input));
    } catch {
      throw new NineRouterError("REQUEST_REJECTED");
    }

    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const requestBody = typeof init?.body === "string" ? init.body : null;
    if (requestURL.href !== expectedURL
      || method !== "POST"
      || requestBody === null
      || Buffer.byteLength(requestBody, "utf8") > limits.requestBytes) {
      throw new NineRouterError("REQUEST_REJECTED");
    }

    let parsedBody: unknown;
    try { parsedBody = JSON.parse(requestBody) as unknown; } catch { throw new NineRouterError("REQUEST_REJECTED"); }
    if (typeof parsedBody !== "object" || parsedBody === null || Array.isArray(parsedBody)) {
      throw new NineRouterError("REQUEST_REJECTED");
    }
    const body = parsedBody as Record<string, unknown>;
    if (body.model !== config.model || body.stream === true || !Array.isArray(body.messages)) {
      throw new NineRouterError("REQUEST_REJECTED");
    }
    if (attempts >= 1) throw new NineRouterError("REQUEST_REJECTED", null, true);

    attempts += 1;
    diagnostics.outboundAttempted = true;
    const response = await fetcher(input, { ...init, method: "POST", redirect: "error" });
    diagnostics.upstreamStatus = response.status;
    const bounded = await readBoundedResponse(response, limits.responseBytes);
    diagnostics.responseBytes = bounded.bytes;
    return bounded.response;
  };
}

export async function generateNineRouterJson<T>(options: {
  readonly config?: NineRouterConfig | null;
  readonly system: string;
  readonly prompt: string;
  readonly schema: z.ZodType<T>;
  readonly requestBytesLimit?: number;
  readonly responseBytesLimit?: number;
  readonly fetcher?: typeof fetch;
  readonly signal?: AbortSignal;
  readonly onDiagnostic?: (diagnostic: NineRouterDiagnostic) => void;
}): Promise<T> {
  const config = options.config === undefined ? readNineRouterConfig() : options.config;
  if (!config) throw new NineRouterError("CONFIGURATION_UNAVAILABLE");

  const requestBytesLimit = Math.min(nineRouterLimits.maxRequestBytes, Math.max(1, options.requestBytesLimit ?? nineRouterLimits.maxRequestBytes));
  const responseBytesLimit = Math.min(nineRouterLimits.maxResponseBytes, Math.max(1, options.responseBytesLimit ?? nineRouterLimits.maxResponseBytes));

  const promptBytes = Buffer.byteLength(options.prompt, "utf8") + Buffer.byteLength(options.system, "utf8");
  if (promptBytes > requestBytesLimit) {
    throw new NineRouterError("REQUEST_REJECTED");
  }

  const release = acquireConcurrencySlot();
  const requestId = `ai_${randomUUID()}`;
  const startedAt = Date.now();
  const diagnostics = { upstreamStatus: null as number | null, responseBytes: null as number | null, outboundAttempted: false };
  let category: "SUCCESS" | NineRouterErrorCategory = "SUCCESS";
  try {
    const provider = createOpenAICompatible({
      name: NINEROUTER_PROVIDER,
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      fetch: guardedFetch(config, options.fetcher ?? globalThis.fetch, diagnostics, {
        requestBytes: requestBytesLimit,
        responseBytes: responseBytesLimit,
      }),
    });
    const result = await generateText({
      model: provider.chatModel(config.model),
      system: options.system,
      prompt: options.prompt,
      maxRetries: 0,
      timeout: config.timeoutMs,
      ...(options.signal ? { abortSignal: options.signal } : {}),
    });
    const rawText = result.text.trim();
    if (!rawText) {
      const responseDiagnostic = { failure: "EMPTY_TEXT" } as const;
      logSafeResponseDiagnostic(requestId, responseDiagnostic);
      throw new NineRouterError("INVALID_RESPONSE", diagnostics.upstreamStatus, true, responseDiagnostic);
    }

    let json: unknown;
    try { json = JSON.parse(rawText) as unknown; } catch {
      const responseDiagnostic = { failure: "INVALID_JSON" } as const;
      logSafeResponseDiagnostic(requestId, responseDiagnostic);
      throw new NineRouterError("INVALID_RESPONSE", diagnostics.upstreamStatus, true, responseDiagnostic);
    }
    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      const responseDiagnostic = safeSchemaDiagnostic(json, parsed.error.issues);
      logSafeResponseDiagnostic(requestId, responseDiagnostic);
      throw new NineRouterError("INVALID_RESPONSE", diagnostics.upstreamStatus, true, responseDiagnostic);
    }
    return parsed.data;
  } catch (error) {
    const safe = mapProviderError(error);
    category = safe.category;
    throw safe;
  } finally {
    release();
    try {
      options.onDiagnostic?.({
        requestId,
        provider: NINEROUTER_PROVIDER,
        model: config.model,
        protocol: "CHAT_COMPLETIONS",
        upstreamStatus: diagnostics.upstreamStatus,
        responseBytes: diagnostics.responseBytes,
        durationMs: Math.max(0, Date.now() - startedAt),
        category,
        outboundAttempted: diagnostics.outboundAttempted,
      });
    } catch {
      // Safe diagnostics must never alter the provider result.
    }
  }
}
