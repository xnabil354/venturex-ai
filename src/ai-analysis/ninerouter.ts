import "server-only";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, generateText, Output, zodSchema } from "ai";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  NINEROUTER_PROVIDER,
  NINEROUTER_REQUESTED_MODEL,
  readNineRouterConfig,
  type NineRouterConfig,
} from "./ninerouter-config";

export {
  isLocalProfileNineRouterTransportAllowed,
  isLoopbackHttpTransport,
  isPublicHttpTransport,
  NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG,
  NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG,
  NINEROUTER_LOOPBACK_TUNNEL_FLAG,
  NINEROUTER_PROVIDER,
  NINEROUTER_REQUESTED_MODEL,
  NINEROUTER_SYNTHETIC_SMOKE_FLAG,
  readLocalProfileNineRouterConfig,
  readNineRouterConfig,
  readSyntheticDemoNineRouterConfig,
  type NineRouterConfig,
} from "./ninerouter-config";

export type NineRouterErrorCategory =
  | "CONFIGURATION_UNAVAILABLE"
  | "REQUEST_REJECTED"
  | "CONCURRENCY_LIMIT"
  | "RATE_LIMITED"
  | "UPSTREAM_AUTH"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_HTTP"
  | "CLIENT_ABORTED"
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
    correlationId: string;
    model: string;
    upstreamStatus: number | null;
    durationMs: number;
    issues: readonly NineRouterSchemaDiagnosticIssue[];
  }
>;

export type NineRouterSchemaDiagnosticField = Readonly<{
  path: string;
  typeCategory: "string" | "number" | "boolean" | "object" | "array" | "enum";
  required: boolean;
  nullable: boolean;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  allowedValues?: readonly string[];
}>;

export type NineRouterSchemaDiagnosticContract = Readonly<{
  fields: readonly NineRouterSchemaDiagnosticField[];
}>;

export type NineRouterValueTypeCategory = "string" | "number" | "boolean" | "object" | "array" | "null" | "undefined";

export type NineRouterSchemaDiagnosticIssue = Readonly<{
  path: string;
  code: string;
  rejectionRule: string;
  allowedTypeCategory?: NineRouterSchemaDiagnosticField["typeCategory"];
  receivedTypeCategory?: NineRouterValueTypeCategory;
  arrayLength?: number;
  receivedLength?: number;
  configuredMaximum?: number;
  configuredMinimum?: number;
  allowedValues?: readonly string[];
}>;

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
  inferenceStartedAt: string;
  timeoutMs: number;
  systemPromptBytes: number;
  userPromptBytes: number;
  promptBytes: number;
  requestBodyBytes: number | null;
  responseBytesLimit: number;
  outboundRequestStartedAfterMs: number | null;
  responseHeadersReceivedAfterMs: number | null;
  responseBodyCompletedAfterMs: number | null;
  activeRequestsAtStart: number;
  activeRequestsAtEnd: number;
  maxConcurrentRequests: number;
  concurrencySlotAcquired: boolean;
  abortOrigin: "NONE" | "CLIENT" | "APPLICATION_TIMEOUT" | "UNKNOWN";
  timeoutCategory: "APPLICATION_DEADLINE" | "CLIENT_ABORT" | "UPSTREAM_HTTP_TIMEOUT" | null;
  schemaValidationOutcome: "NOT_RUN" | "PASSED" | "FAILED";
  upstreamStatus: number | null;
  responseBytes: number | null;
  durationMs: number;
  category: "SUCCESS" | NineRouterErrorCategory;
  outboundAttempted: boolean;
}>;

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

function hasErrorName(error: unknown, names: ReadonlySet<string>): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (!(current instanceof Error)) return false;
    if (names.has(current.name)) return true;
    current = current.cause;
  }
  return false;
}

function mapProviderError(error: unknown, signal: AbortSignal | undefined, outboundAttempted: boolean): NineRouterError {
  if (error instanceof NineRouterError) return error;
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return new NineRouterError("RATE_LIMITED", 429, true);
    if (error.statusCode === 401 || error.statusCode === 403) return new NineRouterError("UPSTREAM_AUTH", error.statusCode, true);
    if (error.statusCode === 503) return new NineRouterError("UPSTREAM_UNAVAILABLE", 503, true);
    if (error.statusCode === 408 || error.statusCode === 504) return new NineRouterError("UPSTREAM_TIMEOUT", error.statusCode, true);
    if (typeof error.statusCode === "number") return new NineRouterError("UPSTREAM_HTTP", error.statusCode, true);
  }
  if (signal?.aborted) return new NineRouterError("CLIENT_ABORTED", null, outboundAttempted);
  if (hasErrorName(error, new Set(["TimeoutError"]))) return new NineRouterError("TIMEOUT", null, outboundAttempted);
  return new NineRouterError("NETWORK", null, outboundAttempted);
}

const knownResponsePathSegments = new Set([
  "analysis", "evidenceReferences", "summary", "whyRelevant", "targetConsumer",
  "competition", "potential", "risks", "nextAction", "outcome", "ideas", "title",
  "opportunityType", "concept", "validationSteps", "assumptions", "profileAlignment",
  "profileReferences", "evidenceInterpretation", "evidenceGaps", "evidenceGapIds", "limitations", "reason",
]);
const knownZodIssueCodes = new Set([
  "invalid_type", "unrecognized_keys", "too_small", "too_big", "invalid_value",
  "invalid_format", "custom", "not_multiple_of",
]);

function safeResponseDiagnosticPath(path: readonly PropertyKey[], contractFields: readonly NineRouterSchemaDiagnosticField[]): string {
  const allowedSegments = new Set(knownResponsePathSegments);
  for (const field of contractFields) {
    for (const segment of field.path.matchAll(/[^.[\]]+/gu)) allowedSegments.add(segment[0]);
  }
  let formatted = "";
  for (const segment of path.slice(0, 6)) {
    if (typeof segment === "number" && Number.isSafeInteger(segment) && segment >= 0) {
      formatted += "[" + segment + "]";
    } else if (typeof segment === "string" && allowedSegments.has(segment)) {
      formatted += (formatted ? "." : "") + segment;
    } else {
      formatted += (formatted ? "." : "") + "[key]";
    }
  }
  return formatted || "$";
}

function diagnosticPathTemplate(path: readonly PropertyKey[]): string {
  return path.map((segment) => typeof segment === "number" ? "[]" : String(segment)).join(".").replace(/\.\[\]/gu, "[]");
}

function valueAtDiagnosticPath(value: unknown, path: readonly PropertyKey[]): { found: boolean; value: unknown } {
  let current = value;
  for (const segment of path) {
    if (typeof segment === "number" && Array.isArray(current)) {
      if (segment >= current.length) return { found: false, value: undefined };
      current = current[segment];
    } else if (typeof segment === "string" && typeof current === "object" && current !== null && Object.hasOwn(current, segment)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return { found: false, value: undefined };
    }
  }
  return { found: true, value: current };
}

function receivedTypeCategory(value: unknown): NineRouterValueTypeCategory {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "undefined";
}

function rejectionRuleForIssue(code: string): string {
  switch (code) {
    case "invalid_value": return "VALUE_OUTSIDE_ALLOWED_ENUM";
    case "invalid_type": return "TYPE_MISMATCH";
    case "too_big": return "MAXIMUM_EXCEEDED";
    case "too_small": return "MINIMUM_NOT_MET";
    case "unrecognized_keys": return "UNEXPECTED_FIELDS";
    default: return "SCHEMA_CONSTRAINT_REJECTED";
  }
}

function safeSchemaDiagnostic(
  value: unknown,
  issues: readonly z.core.$ZodIssue[],
  metadata: Readonly<{
    correlationId: string;
    model: string;
    upstreamStatus: number | null;
    durationMs: number;
    contractFields: readonly NineRouterSchemaDiagnosticField[];
  }>,
): NineRouterResponseDiagnostic {
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
    correlationId: metadata.correlationId,
    model: metadata.model,
    upstreamStatus: metadata.upstreamStatus,
    durationMs: metadata.durationMs,
    issues: issues.slice(0, 8).map((issue) => {
      const path = safeResponseDiagnosticPath(issue.path, metadata.contractFields);
      const template = diagnosticPathTemplate(issue.path);
      const field = metadata.contractFields.find((candidate) => candidate.path === template);
      const resolved = field || issue.path.length === 0 ? valueAtDiagnosticPath(value, issue.path) : { found: false, value: undefined };
      const actualType = resolved.found ? receivedTypeCategory(resolved.value) : "undefined";
      const arrayLength = resolved.found && Array.isArray(resolved.value) ? resolved.value.length : undefined;
      const receivedLength = resolved.found && typeof resolved.value === "string" ? resolved.value.length : undefined;
      const configuredMaximum = field?.maxItems ?? field?.maxLength;
      const configuredMinimum = field?.minItems ?? field?.minLength;
      return {
        path,
        code: knownZodIssueCodes.has(issue.code) ? issue.code : "other",
        rejectionRule: rejectionRuleForIssue(issue.code),
        ...(field ? { allowedTypeCategory: field.typeCategory } : {}),
        ...(resolved.found ? { receivedTypeCategory: actualType } : { receivedTypeCategory: "undefined" as const }),
        ...(arrayLength !== undefined ? { arrayLength } : {}),
        ...(receivedLength !== undefined ? { receivedLength } : {}),
        ...(configuredMaximum !== undefined ? { configuredMaximum } : {}),
        ...(configuredMinimum !== undefined ? { configuredMinimum } : {}),
        ...(field?.allowedValues ? { allowedValues: field.allowedValues } : {}),
      };
    }),
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
  diagnostics: {
    upstreamStatus: number | null;
    responseBytes: number | null;
    outboundAttempted: boolean;
    requestBodyBytes: number | null;
    outboundRequestStartedAfterMs: number | null;
    responseHeadersReceivedAfterMs: number | null;
    responseBodyCompletedAfterMs: number | null;
  },
  limits: { requestBytes: number; responseBytes: number },
  startedAt: number,
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
    diagnostics.requestBodyBytes = Buffer.byteLength(requestBody, "utf8");
    diagnostics.outboundAttempted = true;
    diagnostics.outboundRequestStartedAfterMs = Math.max(0, Date.now() - startedAt);
    const response = await fetcher(input, { ...init, method: "POST", redirect: "error" });
    diagnostics.upstreamStatus = response.status;
    diagnostics.responseHeadersReceivedAfterMs = Math.max(0, Date.now() - startedAt);
    const bounded = await readBoundedResponse(response, limits.responseBytes);
    diagnostics.responseBytes = bounded.bytes;
    diagnostics.responseBodyCompletedAfterMs = Math.max(0, Date.now() - startedAt);
    return bounded.response;
  };
}

function normalizeProviderUnionKeyword(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(normalizeProviderUnionKeyword);
    return;
  }
  const node = value as Record<string, unknown>;
  // Zod discriminated unions have disjoint literal tags, so anyOf is equivalent.
  // OpenAI structured output accepts anyOf but not the emitted oneOf keyword.
  if (Array.isArray(node.oneOf)) {
    node.anyOf = node.oneOf;
    delete node.oneOf;
  }
  Object.values(node).forEach(normalizeProviderUnionKeyword);
}

export async function generateNineRouterJson<T>(options: {
  readonly config?: NineRouterConfig | null;
  readonly system: string;
  readonly prompt: string;
  readonly schema: z.ZodType<T>;
  readonly structuredOutput?: boolean;
  readonly diagnosticContract?: NineRouterSchemaDiagnosticContract;
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

  const baseSystemPromptBytes = Buffer.byteLength(options.system, "utf8");
  const userPromptBytes = Buffer.byteLength(options.prompt, "utf8");
  if (baseSystemPromptBytes + userPromptBytes > requestBytesLimit) {
    throw new NineRouterError("REQUEST_REJECTED");
  }

  // An object envelope allows a discriminated union without a root-level anyOf.
  // Keep parsing here so invalid provider output retains our bounded, private diagnostics.
  const wireSchema = options.structuredOutput
    ? await zodSchema(z.object({ result: options.schema }).strict()).jsonSchema
    : null;
  if (wireSchema) normalizeProviderUnionKeyword(wireSchema);
  // Some compatible gateways accept response_format but do not forward its schema.
  // Supply the SAME generated contract as system guidance, not a second hand-written shape.
  const schemaGuidance = wireSchema
    ? "\n\nReturn exactly one JSON object matching OUTPUT_JSON_SCHEMA. Every object permits only its declared properties. References are objects, not strings. Do not copy input metadata into output.\nOUTPUT_JSON_SCHEMA\n" + JSON.stringify(wireSchema)
    : "";
  const system = options.system + schemaGuidance;
  const systemPromptBytes = Buffer.byteLength(system, "utf8");
  const promptBytes = systemPromptBytes + userPromptBytes;
  const wireRequestBytesLimit = wireSchema
    ? Math.min(nineRouterLimits.maxRequestBytes, requestBytesLimit + Buffer.byteLength(schemaGuidance, "utf8") + Buffer.byteLength(JSON.stringify(wireSchema), "utf8") + 1024)
    : requestBytesLimit;

  let release: (() => void) | null = null;
  let concurrencySlotAcquired = false;
  const requestId = `ai_${randomUUID()}`;
  const startedAt = Date.now();
  const inferenceStartedAt = new Date(startedAt).toISOString();
  const activeRequestsAtStart = activeRequests;
  const diagnostics = {
    upstreamStatus: null as number | null,
    responseBytes: null as number | null,
    outboundAttempted: false,
    requestBodyBytes: null as number | null,
    outboundRequestStartedAfterMs: null as number | null,
    responseHeadersReceivedAfterMs: null as number | null,
    responseBodyCompletedAfterMs: null as number | null,
  };
  let abortOrigin: NineRouterDiagnostic["abortOrigin"] = "NONE";
  let timeoutCategory: NineRouterDiagnostic["timeoutCategory"] = null;
  let schemaValidationOutcome: NineRouterDiagnostic["schemaValidationOutcome"] = "NOT_RUN";
  let category: "SUCCESS" | NineRouterErrorCategory = "SUCCESS";
  try {
    release = acquireConcurrencySlot();
    concurrencySlotAcquired = true;
    const provider = createOpenAICompatible({
      name: NINEROUTER_PROVIDER,
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      supportsStructuredOutputs: options.structuredOutput === true,
      fetch: guardedFetch(config, options.fetcher ?? globalThis.fetch, diagnostics, {
        requestBytes: wireRequestBytesLimit,
        responseBytes: responseBytesLimit,
      }, startedAt),
    });
    const result = await generateText({
      model: provider.chatModel(config.model),
      system,
      prompt: options.prompt,
      ...(wireSchema ? {
        output: {
          ...Output.text(),
          responseFormat: Promise.resolve({ type: "json" as const, schema: wireSchema, name: "venturex_analysis" }),
        },
        providerOptions: { openaiCompatible: { strictJsonSchema: true } },
      } : {}),
      maxRetries: 0,
      timeout: config.timeoutMs,
      ...(options.signal ? { abortSignal: options.signal } : {}),
    });
    const rawText = result.text.trim();
    if (!rawText) {
      schemaValidationOutcome = "FAILED";
      const responseDiagnostic = { failure: "EMPTY_TEXT" } as const;
      logSafeResponseDiagnostic(requestId, responseDiagnostic);
      throw new NineRouterError("INVALID_RESPONSE", diagnostics.upstreamStatus, true, responseDiagnostic);
    }

    let json: unknown;
    try { json = JSON.parse(rawText) as unknown; } catch {
      schemaValidationOutcome = "FAILED";
      const responseDiagnostic = { failure: "INVALID_JSON" } as const;
      logSafeResponseDiagnostic(requestId, responseDiagnostic);
      throw new NineRouterError("INVALID_RESPONSE", diagnostics.upstreamStatus, true, responseDiagnostic);
    }
    const envelope = wireSchema ? z.object({ result: z.unknown() }).strict().safeParse(json) : null;
    const candidate = envelope?.success ? envelope.data.result : json;
    const parsed = envelope && !envelope.success ? envelope : options.schema.safeParse(candidate);
    if (!parsed.success) {
      schemaValidationOutcome = "FAILED";
      const responseDiagnostic = safeSchemaDiagnostic(candidate, parsed.error.issues, {
        correlationId: requestId,
        model: config.model,
        upstreamStatus: diagnostics.upstreamStatus,
        durationMs: Math.max(0, Date.now() - startedAt),
        contractFields: options.diagnosticContract?.fields ?? [],
      });
      logSafeResponseDiagnostic(requestId, responseDiagnostic);
      throw new NineRouterError("INVALID_RESPONSE", diagnostics.upstreamStatus, true, responseDiagnostic);
    }
    schemaValidationOutcome = "PASSED";
    return parsed.data;
  } catch (error) {
    const safe = mapProviderError(error, options.signal, diagnostics.outboundAttempted);
    category = safe.category;
    if (safe.category === "CLIENT_ABORTED") {
      abortOrigin = "CLIENT";
      timeoutCategory = "CLIENT_ABORT";
    } else if (safe.category === "TIMEOUT") {
      abortOrigin = "APPLICATION_TIMEOUT";
      timeoutCategory = "APPLICATION_DEADLINE";
    } else if (safe.category === "UPSTREAM_TIMEOUT") {
      timeoutCategory = "UPSTREAM_HTTP_TIMEOUT";
    } else if (hasErrorName(error, new Set(["AbortError", "ResponseAborted"]))) {
      abortOrigin = "UNKNOWN";
    }
    throw safe;
  } finally {
    release?.();
    try {
      options.onDiagnostic?.({
        requestId,
        provider: NINEROUTER_PROVIDER,
        model: config.model,
        protocol: "CHAT_COMPLETIONS",
        inferenceStartedAt,
        timeoutMs: config.timeoutMs,
        systemPromptBytes,
        userPromptBytes,
        promptBytes,
        requestBodyBytes: diagnostics.requestBodyBytes,
        responseBytesLimit,
        outboundRequestStartedAfterMs: diagnostics.outboundRequestStartedAfterMs,
        responseHeadersReceivedAfterMs: diagnostics.responseHeadersReceivedAfterMs,
        responseBodyCompletedAfterMs: diagnostics.responseBodyCompletedAfterMs,
        activeRequestsAtStart,
        activeRequestsAtEnd: activeRequests,
        maxConcurrentRequests: nineRouterLimits.maxConcurrentRequests,
        concurrencySlotAcquired,
        abortOrigin,
        timeoutCategory,
        schemaValidationOutcome,
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
