import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BrightDataConfigurationError,
  BrightDataGoogleTrendsProvider,
  BrightDataProviderError,
} from "../../src/trend/brightdata-google-trends.ts";
import {
  createCandidatePreviewReport,
  formatCandidatePreviewReport,
} from "../../src/trend/candidate-preview.ts";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const fixturePath = path.join(
  scriptDirectory,
  "fixtures",
  "brightdata-candidate-preview.synthetic.json",
);

class PreviewCommandError extends Error {}

function parseMode(args) {
  if (args.length === 0) return "OFFLINE_SYNTHETIC";
  if (args.length === 1 && args[0] === "--help") return "HELP";

  const expected = new Set(["--live", "--confirm-one-provider-request"]);
  if (
    args.length !== expected.size ||
    new Set(args).size !== expected.size ||
    args.some((argument) => !expected.has(argument))
  ) {
    throw new PreviewCommandError(
      "Use no options for the offline fixture, or use --live --confirm-one-provider-request after separate Product Owner authorization.",
    );
  }
  return "LIVE_PROVIDER";
}

function printHelp() {
  process.stdout.write(
    [
      "Usage:",
      "  pnpm trend:preview",
      "  pnpm trend:preview -- --live --confirm-one-provider-request",
      "",
      "The default mode uses a clearly labeled synthetic fixture and makes no provider request.",
      "Live mode requires separate Product Owner authorization, BRIGHTDATA_TRENDS_ENABLED=true, and a server-side API key.",
      "The flags are execution safeguards, not Product Owner approval. Live mode makes at most one request and never retries.",
      "No mode writes to PostgreSQL or the curated catalog.",
      "",
    ].join("\n"),
  );
}

function loadLiveEnvironment() {
  const environmentFile = path.join(projectRoot, ".env");
  try {
    process.loadEnvFile(environmentFile);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw new PreviewCommandError("Unable to load local provider configuration safely.");
    }
  }
}

function assertLiveAuthorization() {
  if (process.env.NODE_ENV === "production") {
    throw new PreviewCommandError("Live candidate preview is limited to local development.");
  }
  if (process.env.VENTUREX_BRIGHTDATA_PREVIEW_AUTHORIZATION !== "ONE_REQUEST") {
    throw new PreviewCommandError(
      "A current-session VENTUREX_BRIGHTDATA_PREVIEW_AUTHORIZATION=ONE_REQUEST gate is required after separate Product Owner authorization. No request was made.",
    );
  }

  loadLiveEnvironment();

  if (process.env.BRIGHTDATA_TRENDS_ENABLED !== "true") {
    throw new PreviewCommandError(
      "BRIGHTDATA_TRENDS_ENABLED must be true for an explicitly authorized live preview. No request was made.",
    );
  }
  if (!process.env.BRIGHTDATA_TRENDS_API_KEY?.trim()) {
    throw new PreviewCommandError(
      "BRIGHTDATA_TRENDS_API_KEY is unavailable. No request was made.",
    );
  }
}

function providerEnvironmentFromProcess() {
  return {
    BRIGHTDATA_TRENDS_ENABLED: process.env.BRIGHTDATA_TRENDS_ENABLED,
    BRIGHTDATA_TRENDS_API_KEY: process.env.BRIGHTDATA_TRENDS_API_KEY,
    BRIGHTDATA_TRENDS_TIMEOUT_MS: process.env.BRIGHTDATA_TRENDS_TIMEOUT_MS,
  };
}

async function createOfflineProvider(retrievalTimestamp) {
  const fixtureBody = await readFile(fixturePath, "utf8");
  let mockFetchCalls = 0;

  const provider = new BrightDataGoogleTrendsProvider({
    environment: {
      BRIGHTDATA_TRENDS_ENABLED: "true",
      BRIGHTDATA_TRENDS_API_KEY: "offline-fixture-only",
      BRIGHTDATA_TRENDS_TIMEOUT_MS: "10000",
    },
    now: () => {
      const timestamp = new Date();
      retrievalTimestamp.value = timestamp.toISOString();
      return timestamp;
    },
    fetcher: async () => {
      mockFetchCalls += 1;
      if (mockFetchCalls !== 1) {
        throw new Error("Offline fixture fetcher may be invoked exactly once.");
      }
      return new Response(fixtureBody, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  return { provider };
}

function createLiveProvider(retrievalTimestamp, onRequestStarted) {
  let liveRequestCount = 0;
  const provider = new BrightDataGoogleTrendsProvider({
    environment: providerEnvironmentFromProcess(),
    now: () => {
      const timestamp = new Date();
      retrievalTimestamp.value = timestamp.toISOString();
      return timestamp;
    },
    fetcher: async (input, init) => {
      if (liveRequestCount === 1) {
        throw new Error("Candidate preview live request limit exceeded.");
      }
      liveRequestCount = 1;
      onRequestStarted();
      return fetch(input, { ...init, redirect: "error" });
    },
  });

  return { provider };
}

async function main() {
  let mode;
  let attemptedLiveRequestCount = 0;
  try {
    mode = parseMode(process.argv.slice(2));
    if (mode === "HELP") {
      printHelp();
      return;
    }
    if (mode === "LIVE_PROVIDER") assertLiveAuthorization();

    const retrievalTimestamp = { value: null };
    const providerHandle =
      mode === "OFFLINE_SYNTHETIC"
        ? await createOfflineProvider(retrievalTimestamp)
        : createLiveProvider(retrievalTimestamp, () => {
            attemptedLiveRequestCount += 1;
          });

    const batch = await providerHandle.provider.collectAndScreenCandidateBatch();
    const report = createCandidatePreviewReport(batch, {
      mode,
      generatedAt: new Date().toISOString(),
      retrievedAt: retrievalTimestamp.value,
    });
    process.stdout.write(formatCandidatePreviewReport(report));
  } catch (error) {
    if (error instanceof PreviewCommandError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 2;
      return;
    }

    const errorCode =
      error instanceof BrightDataProviderError
        ? error.code
        : error instanceof BrightDataConfigurationError
          ? "CONFIGURATION_ERROR"
          : "PREVIEW_FAILED";
    const requestCount =
      mode === "LIVE_PROVIDER" && attemptedLiveRequestCount > 0
        ? `${attemptedLiveRequestCount} provider request${attemptedLiveRequestCount === 1 ? " was" : "s were"} attempted`
        : "no provider request was made";
    process.stderr.write(
      `Candidate preview stopped (${errorCode}); ${requestCount}. Raw provider content and credentials were not displayed.\n`,
    );
    process.exitCode = 1;
  }
}

await main();
