import "server-only";

import { z } from "zod";

export const BRIGHTDATA_TRENDS_ENDPOINT = "https://api.brightdata.com/request";
export const GOOGLE_TRENDS_INDONESIA_TARGET = "https://trends.google.com/trending?geo=ID&hl=id&brd_json=1";
export const BRIGHTDATA_TRENDS_ZONE = "venturex_trends_serp";
export const GOOGLE_TRENDS_TIME_WINDOWS_HOURS = [4, 24, 48, 168] as const;
export type GoogleTrendsTimeWindowHours = (typeof GOOGLE_TRENDS_TIME_WINDOWS_HOURS)[number];

export function buildGoogleTrendsTrendingNowTarget(hours: GoogleTrendsTimeWindowHours): string {
  return `${GOOGLE_TRENDS_INDONESIA_TARGET}&hours=${hours}`;
}

const configSchema = z.object({
  enabled: z.enum(["true", "false"]).default("false"),
  apiKey: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  timeoutMs: z.coerce.number().int().min(250).max(30_000).default(10_000),
}).superRefine((config, context) => {
  if (config.enabled === "true" && !config.apiKey) {
    context.addIssue({ code: "custom", path: ["apiKey"], message: "Required when Bright Data collection is enabled" });
  }
});

const environmentNames: Readonly<Record<string, string>> = {
  enabled: "BRIGHTDATA_TRENDS_ENABLED",
  apiKey: "BRIGHTDATA_TRENDS_API_KEY",
  timeoutMs: "BRIGHTDATA_TRENDS_TIMEOUT_MS",
};

export class BrightDataConfigurationError extends Error {
  override readonly name = "BrightDataConfigurationError";
  constructor(readonly environmentVariables: readonly string[]) {
    super("Invalid Bright Data Trends configuration: " + environmentVariables.join(", "));
  }
}

export type BrightDataEnvironment = Readonly<Record<string, string | undefined>>;
export type BrightDataTrendsConfig = {
  readonly enabled: boolean;
  readonly apiKey: string | undefined;
  readonly timeoutMs: number;
  readonly zone: typeof BRIGHTDATA_TRENDS_ZONE;
};

export function parseBrightDataTrendsConfig(
  environment: BrightDataEnvironment = process.env,
): BrightDataTrendsConfig {
  const parsed = configSchema.safeParse({
    enabled: environment.BRIGHTDATA_TRENDS_ENABLED,
    apiKey: environment.BRIGHTDATA_TRENDS_API_KEY,
    timeoutMs: environment.BRIGHTDATA_TRENDS_TIMEOUT_MS,
  });
  if (!parsed.success) {
    const variables = [...new Set(parsed.error.issues.map((issue) => {
      const key = String(issue.path[0] ?? "");
      return environmentNames[key] ?? "Bright Data configuration";
    }))];
    throw new BrightDataConfigurationError(variables);
  }
  return {
    enabled: parsed.data.enabled === "true",
    apiKey: parsed.data.apiKey,
    timeoutMs: parsed.data.timeoutMs,
    zone: BRIGHTDATA_TRENDS_ZONE,
  };
}
