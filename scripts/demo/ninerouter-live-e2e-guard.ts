export const NINEROUTER_LIVE_E2E_MODEL = "cx/gpt-6-luna-xhigh" as const;
export const NINEROUTER_LIVE_E2E_BASE_URL = "http://72.62.247.63:20128/v1" as const;

export type NineRouterLiveE2EEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * These gates protect a single, explicitly armed local browser run. The
 * rotation confirmation must be supplied by the operator; changing the model
 * name is not evidence that the API key was rotated.
 */
export function getNineRouterLiveE2EBlockReason(
  env: NineRouterLiveE2EEnvironment,
): string | null {
  if (env.VENTUREX_9ROUTER_LIVE_E2E_ARMED !== "true") return "LIVE_TEST_NOT_ARMED";
  if (env.VENTUREX_9ROUTER_KEY_ROTATED_CONFIRMED !== "true") return "KEY_ROTATION_NOT_CONFIRMED";
  if (!env.NINEROUTER_API_KEY?.trim()) return "API_KEY_NOT_CONFIGURED";
  if (env.AI_PROVIDER !== "ninerouter") return "PROVIDER_MISMATCH";
  if (env.NINEROUTER_BASE_URL !== NINEROUTER_LIVE_E2E_BASE_URL) return "ENDPOINT_MISMATCH";
  if (env.NINEROUTER_MODEL !== NINEROUTER_LIVE_E2E_MODEL) return "MODEL_MISMATCH";
  return null;
}
