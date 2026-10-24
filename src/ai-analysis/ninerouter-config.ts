import "server-only";

import { z } from "zod";

export const NINEROUTER_PROVIDER = "ninerouter" as const;
export const NINEROUTER_REQUESTED_MODEL = "cx/gpt-6-luna-xhigh" as const;
export const NINEROUTER_LOOPBACK_TUNNEL_FLAG = "NINEROUTER_LOOPBACK_TUNNEL_CONFIRMED" as const;
export const NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG = "NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY" as const;
export const NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG = "NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY" as const;
export const NINEROUTER_SYNTHETIC_SMOKE_FLAG = "AI_ANALYSIS_NINEROUTER_SYNTHETIC_SMOKE_ENABLED" as const;

const PUBLIC_HTTP_DEV_ONLY_ENDPOINT = "http://72.62.247.63:20128/v1";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const APPROVED_LOOPBACK_AUTHORITIES = new Set(["localhost:20128", "127.0.0.1:20128", "[::1]:20128"]);
const timeoutSchema = z.coerce.number().int().min(1_000).max(60_000);
const opportunityFinderTimeoutSchema = z.coerce.number().int().min(1_000).max(180_000);
const DEFAULT_OPPORTUNITY_FINDER_TIMEOUT_MS = 120_000;
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

export function isLoopbackHttpTransport(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
}

function isValidProviderBaseURL(parsed: URL): boolean {
  return !parsed.username
    && !parsed.password
    && !parsed.search
    && !parsed.hash
    && parsed.pathname.replace(/\/$/u, "") === "/v1";
}

function isApprovedLoopbackDevEndpoint(parsed: URL, value: string): boolean {
  const rawAuthority = /^http:\/\/([^/?#]+)/iu.exec(value.trim())?.[1]?.toLowerCase();
  return parsed.protocol === "http:"
    && APPROVED_LOOPBACK_AUTHORITIES.has(rawAuthority ?? "")
    && isValidProviderBaseURL(parsed);
}

function isLoopbackHttpDevOptedIn(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.NODE_ENV === "development"
    && (env[NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY_FLAG] === "true"
      || env[NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG] === "true");
}

/** The Opportunity Finder's direct local transport policy, shared by UI and API. */
export function isLocalProfileNineRouterTransportAllowed(
  value: string | null | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (!isValidProviderBaseURL(parsed)) return false;
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol !== "http:") return false;
    if (env[NINEROUTER_LOOPBACK_TUNNEL_FLAG] === "true" && isLoopbackHostname(parsed.hostname)) return true;
    return isApprovedLoopbackDevEndpoint(parsed, value) && isLoopbackHttpDevOptedIn(env);
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

function normalizeBaseURL(
  value: string | undefined,
  loopbackTunnelConfirmed: boolean,
  loopbackHttpDevOnlyAllowed = false,
  publicHttpDemoAllowed = false,
): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const isApprovedLoopbackTunnelHttp = parsed.protocol === "http:"
      && isLoopbackHostname(parsed.hostname)
      && loopbackTunnelConfirmed;
    const isApprovedLoopbackDevHttp = isApprovedLoopbackDevEndpoint(parsed, value)
      && loopbackHttpDevOnlyAllowed;
    const isApprovedPublicHttpDemoEndpoint = parsed.protocol === "http:"
      && value === PUBLIC_HTTP_DEV_ONLY_ENDPOINT
      && publicHttpDemoAllowed;
    if ((parsed.protocol !== "https:" && !isApprovedLoopbackTunnelHttp && !isApprovedLoopbackDevHttp && !isApprovedPublicHttpDemoEndpoint)
      || !isValidProviderBaseURL(parsed)) return null;
    return `${parsed.origin}/v1`;
  } catch {
    return null;
  }
}

function readConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{
    loopbackHttpDevOnlyAllowed?: boolean;
    publicHttpDemoAllowed?: boolean;
    opportunityFinderTimeout?: boolean;
  }> = {},
): NineRouterConfig | null {
  const tunnelConfirmed = env[NINEROUTER_LOOPBACK_TUNNEL_FLAG] === "true";
  const configuredBaseURL = env.NINEROUTER_BASE_URL?.trim();
  const baseURL = normalizeBaseURL(
    configuredBaseURL,
    tunnelConfirmed,
    options.loopbackHttpDevOnlyAllowed === true,
    options.publicHttpDemoAllowed === true,
  );
  const apiKey = env.NINEROUTER_API_KEY?.trim();
  const model = boundedIdentifier.safeParse(env.NINEROUTER_MODEL);
  const timeout = options.opportunityFinderTimeout
    ? opportunityFinderTimeoutSchema.safeParse(env.AI_OPPORTUNITY_FINDER_TIMEOUT_MS ?? DEFAULT_OPPORTUNITY_FINDER_TIMEOUT_MS)
    : timeoutSchema.safeParse(env.AI_ANALYSIS_TIMEOUT_MS ?? 20_000);

  if (env.AI_PROVIDER !== NINEROUTER_PROVIDER
    || !baseURL
    || !apiKey
    || !model.success
    || model.data !== NINEROUTER_REQUESTED_MODEL
    || !timeout.success) return null;

  return {
    provider: NINEROUTER_PROVIDER,
    baseURL,
    apiKey,
    model: NINEROUTER_REQUESTED_MODEL,
    timeoutMs: timeout.data,
  };
}

/** Normal authenticated inference never opts into public plaintext HTTP. */
export function readNineRouterConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): NineRouterConfig | null {
  return readConfig(env);
}

export function readLocalProfileNineRouterConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): NineRouterConfig | null {
  return readConfig(env, {
    loopbackHttpDevOnlyAllowed: isLoopbackHttpDevOptedIn(env),
    opportunityFinderTimeout: true,
  });
}

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

  return readConfig(env, {
    loopbackHttpDevOnlyAllowed: publicHttpDevOnlyAllowed,
    publicHttpDemoAllowed: publicHttpDevOnlyAllowed,
  });
}
