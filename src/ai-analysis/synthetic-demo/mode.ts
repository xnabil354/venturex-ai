import type { SyntheticDemoEnvironment } from "./access";

export const SYNTHETIC_DEMO_PROVIDER_MODE_FLAG = "AI_ANALYSIS_SYNTHETIC_DEMO_PROVIDER_MODE";
export const SYNTHETIC_DEMO_LIVE_AUTHORIZED_FLAG = "AI_ANALYSIS_SYNTHETIC_DEMO_LIVE_AUTHORIZED";
export type SyntheticDemoProviderMode = "MOCK" | "LIVE_SYNTHETIC";

export function readSyntheticDemoProviderMode(env: SyntheticDemoEnvironment): SyntheticDemoProviderMode | null {
  const mode = env[SYNTHETIC_DEMO_PROVIDER_MODE_FLAG] ?? "MOCK";
  if (mode === "MOCK" || mode === "LIVE_SYNTHETIC") return mode;
  return null;
}
