import "server-only";

import {
  NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG,
  NINEROUTER_PROVIDER,
  NINEROUTER_REQUESTED_MODEL,
  NINEROUTER_SYNTHETIC_SMOKE_FLAG,
  readSyntheticDemoNineRouterConfig,
} from "../ninerouter";
import { isSyntheticDemoEnabled, type SyntheticDemoEnvironment } from "./access";
import { SyntheticDemoProviderFailureError, type SyntheticDemoProviderFailureCategory } from "./errors";
import { NineRouterSyntheticDemoProvider } from "./ninerouter-provider";
import { SYNTHETIC_DEMO_LIVE_AUTHORIZED_FLAG, SYNTHETIC_DEMO_PROVIDER_MODE_FLAG, readSyntheticDemoProviderMode } from "./mode";
import { DeterministicSyntheticDemoProvider, type SyntheticDemoProvider } from "./provider";

class UnavailableSyntheticDemoProvider implements SyntheticDemoProvider {
  readonly execution = new DeterministicSyntheticDemoProvider().execution;
  constructor(private readonly category: SyntheticDemoProviderFailureCategory) {}
  async generate(_fixture: Parameters<SyntheticDemoProvider["generate"]>[0], _signal: AbortSignal): Promise<never> {
    throw new SyntheticDemoProviderFailureError(this.category, null, false);
  }
}

/** Invalid or incomplete live configuration fails closed; it never falls back to mock. */
export function createConfiguredSyntheticDemoProvider(
  env: SyntheticDemoEnvironment = process.env,
  options: ConstructorParameters<typeof NineRouterSyntheticDemoProvider>[1] = {},
): SyntheticDemoProvider {
  const mode = readSyntheticDemoProviderMode(env);
  if (mode === "MOCK") return new DeterministicSyntheticDemoProvider();
  if (mode !== "LIVE_SYNTHETIC") return new UnavailableSyntheticDemoProvider("LIVE_MODE_NOT_SELECTED");
  if (env[SYNTHETIC_DEMO_LIVE_AUTHORIZED_FLAG] !== "true") return new UnavailableSyntheticDemoProvider("LIVE_AUTHORIZATION_MISSING");
  if (!isSyntheticDemoEnabled(env)) return new UnavailableSyntheticDemoProvider("LOCAL_DEMO_GUARD_DISABLED");
  if (!env.NINEROUTER_API_KEY?.trim()) return new UnavailableSyntheticDemoProvider("API_KEY_MISSING");
  if (env.AI_PROVIDER !== NINEROUTER_PROVIDER) return new UnavailableSyntheticDemoProvider("PROVIDER_MISMATCH");
  if (env.NINEROUTER_MODEL !== NINEROUTER_REQUESTED_MODEL) return new UnavailableSyntheticDemoProvider("MODEL_MISMATCH");
  if (env[NINEROUTER_SYNTHETIC_SMOKE_FLAG] !== "true") return new UnavailableSyntheticDemoProvider("NINEROUTER_SMOKE_DISABLED");

  const config = readSyntheticDemoNineRouterConfig(env);
  if (!config || config.provider !== NINEROUTER_PROVIDER || config.model !== NINEROUTER_REQUESTED_MODEL) {
    const publicHttpWithoutOptIn = env.NINEROUTER_BASE_URL?.trim().startsWith("http://")
      && env[NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY_FLAG] !== "true";
    return new UnavailableSyntheticDemoProvider(publicHttpWithoutOptIn
      ? "PUBLIC_HTTP_DEV_OPT_IN_REQUIRED"
      : "PROVIDER_CONFIGURATION_INVALID");
  }
  try {
    return new NineRouterSyntheticDemoProvider(config, options);
  } catch {
    return new UnavailableSyntheticDemoProvider("SDK_CONFIGURATION_INVALID");
  }
}
