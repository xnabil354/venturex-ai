import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BrightDataConfigurationError,
  BrightDataGoogleTrendsProvider,
  BrightDataProviderError,
} from "../../src/trend/brightdata-google-trends.ts";
import {
  CandidateCurationError,
  createCandidateCurationPackets,
} from "../../src/trend/candidate-curation.ts";
import {
  createCandidatePreviewReport,
  MAX_CANDIDATE_PREVIEW_TITLES,
} from "../../src/trend/candidate-preview.ts";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const fixturePath = path.join(
  scriptDirectory,
  "fixtures",
  "brightdata-candidate-preview.synthetic.json",
);

class CurationCommandError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function parseArguments(args) {
  const selections = [];
  let live = false;
  let confirmation = false;
  let interactiveSelection = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" && args.length === 1) {
      return { help: true, live, selections, interactiveSelection };
    }
    if (argument === "--live") {
      live = true;
      continue;
    }
    if (argument === "--confirm-one-provider-request") {
      confirmation = true;
      continue;
    }
    if (argument === "--interactive-select") {
      interactiveSelection = true;
      continue;
    }
    if (argument === "--candidate-id") {
      const candidateId = args[index + 1];
      if (!candidateId || !/^gtrends-[a-f0-9]{64}$/u.test(candidateId)) {
        throw new CurationCommandError(
          "INVALID_SELECTION",
          "Each --candidate-id must be copied from a current candidate preview.",
        );
      }
      selections.push(candidateId);
      index += 1;
      continue;
    }
    throw new CurationCommandError(
      "INVALID_ARGUMENTS",
      "Use --candidate-id <id> one or more times offline; live mode requires --live --confirm-one-provider-request --interactive-select.",
    );
  }

  if (selections.length === 0 && !interactiveSelection) {
    throw new CurationCommandError(
      "NO_SELECTION",
      "Select at least one candidate with --candidate-id. No provider request was made.",
    );
  }
  if (new Set(selections).size !== selections.length) {
    throw new CurationCommandError(
      "DUPLICATE_SELECTION",
      "A candidate was selected more than once. No provider request was made.",
    );
  }
  if (live !== confirmation) {
    throw new CurationCommandError(
      "LIVE_CONFIRMATION_REQUIRED",
      "Live mode requires both --live and --confirm-one-provider-request. No provider request was made.",
    );
  }
  if (live && (!interactiveSelection || selections.length > 0)) {
    throw new CurationCommandError(
      "LIVE_SELECTION_REQUIRED",
      "Live curation requires interactive selection from the fetched batch. No provider request was made.",
    );
  }
  if (!live && interactiveSelection) {
    throw new CurationCommandError(
      "INVALID_ARGUMENTS",
      "Offline synthetic mode uses explicit candidate IDs from the synthetic preview.",
    );
  }

  return { help: false, live, selections, interactiveSelection };
}

function printHelp() {
  process.stdout.write(
    [
      "Usage:",
      "  pnpm trend:preview",
      "  pnpm --silent trend:curate -- --candidate-id <id>",
      "  pnpm --silent trend:curate -- --live --confirm-one-provider-request --interactive-select",
      "",
      "Offline candidate IDs are shown by trend:preview and bind the source, region, normalized query, and synthetic observation snapshot.",
      "Default mode uses only the synthetic fixture. Live mode lists candidates from its single fetched batch, then accepts explicit IDs from that same batch.",
      "Live mode requires a separate explicit authorization and never retries.",
      "The authorization environment gate is required in live mode; command flags alone are not Product Owner approval.",
      "Output is a JSON review packet on stdout. This command does not write files, access PostgreSQL, create Trends, or create Opportunities.",
      "",
    ].join("\n"),
  );
}

function stringifyForTerminal(value) {
  return JSON.stringify(value, null, 2).replace(
    /[\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu,
    (character) => `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`,
  );
}

function loadLiveEnvironment() {
  try {
    process.loadEnvFile(path.join(projectRoot, ".env"));
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw new CurationCommandError(
        "CONFIGURATION_ERROR",
        "Unable to load local provider configuration safely. No credential values were displayed.",
      );
    }
  }
}

function assertLiveAuthorization() {
  if (process.env.NODE_ENV === "production") {
    throw new CurationCommandError(
      "LIVE_DISABLED",
      "Live curation preview is limited to local development. No provider request was made.",
    );
  }
  if (process.env.VENTUREX_BRIGHTDATA_PREVIEW_AUTHORIZATION !== "ONE_REQUEST") {
    throw new CurationCommandError(
      "LIVE_AUTHORIZATION_REQUIRED",
      "A current-session one-request authorization gate is required. No provider request was made.",
    );
  }

  loadLiveEnvironment();
  if (process.env.BRIGHTDATA_TRENDS_ENABLED !== "true") {
    throw new CurationCommandError(
      "CONFIGURATION_ERROR",
      "Bright Data collection is not enabled. No provider request was made.",
    );
  }
  if (!process.env.BRIGHTDATA_TRENDS_API_KEY?.trim()) {
    throw new CurationCommandError(
      "CONFIGURATION_ERROR",
      "The server-side Bright Data key is unavailable. No provider request was made.",
    );
  }
}

function environmentFromProcess() {
  return {
    BRIGHTDATA_TRENDS_ENABLED: process.env.BRIGHTDATA_TRENDS_ENABLED,
    BRIGHTDATA_TRENDS_API_KEY: process.env.BRIGHTDATA_TRENDS_API_KEY,
    BRIGHTDATA_TRENDS_TIMEOUT_MS: process.env.BRIGHTDATA_TRENDS_TIMEOUT_MS,
  };
}

async function createOfflineProvider() {
  const fixtureBody = await readFile(fixturePath, "utf8");
  let fetchCalls = 0;
  const provider = new BrightDataGoogleTrendsProvider({
    environment: {
      BRIGHTDATA_TRENDS_ENABLED: "true",
      BRIGHTDATA_TRENDS_API_KEY: "offline-fixture-only",
      BRIGHTDATA_TRENDS_TIMEOUT_MS: "10000",
    },
    fetcher: async () => {
      fetchCalls += 1;
      if (fetchCalls !== 1) {
        throw new Error("Offline fixture fetcher may be invoked exactly once.");
      }
      return new Response(fixtureBody, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  return provider;
}

async function selectLiveCandidates(batch, generatedAt) {
  const report = createCandidatePreviewReport(batch, {
    mode: "LIVE_PROVIDER",
    generatedAt,
    retrievedAt: batch.candidates[0]?.observations[0]?.provenance.retrievedAt ?? null,
  });
  if (report.titles.length === 0) {
    throw new CurationCommandError(
      "NO_SELECTABLE_CANDIDATES",
      "The fetched batch contains no accepted candidate groups to select.",
    );
  }

  process.stderr.write("Select candidates from this fetched batch (IDs only; max 20 shown):\n");
  for (const { candidateId, classification, title } of report.titles.slice(
    0,
    MAX_CANDIDATE_PREVIEW_TITLES,
  )) {
    process.stderr.write(`  [${classification}] ${title} | ${candidateId}\n`);
  }
  process.stderr.write("Enter one or more candidate IDs separated by commas.\n");

  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await prompt.question("Candidate IDs: ");
    return answer
      .split(",")
      .map((candidateId) => candidateId.trim())
      .filter((candidateId) => candidateId.length > 0);
  } finally {
    prompt.close();
  }
}

function createLiveProvider(onRequestStarted) {
  let fetchCalls = 0;
  return new BrightDataGoogleTrendsProvider({
    environment: environmentFromProcess(),
    fetcher: async (input, init) => {
      fetchCalls += 1;
      if (fetchCalls > 1) {
        throw new Error("Candidate curation request limit exceeded.");
      }
      onRequestStarted();
      return fetch(input, { ...init, redirect: "error" });
    },
  });
}

async function main() {
  let args;
  let providerRequestCount = 0;
  try {
    args = parseArguments(process.argv.slice(2));
    if (args.help) {
      printHelp();
      return;
    }
    if (args.live) assertLiveAuthorization();

    const provider = args.live
      ? createLiveProvider(() => {
          providerRequestCount += 1;
        })
      : await createOfflineProvider();
    const batch = await provider.collectAndScreenCandidateBatch();
    const generatedAt = new Date().toISOString();
    const selectedCandidateIds = args.interactiveSelection
      ? await selectLiveCandidates(batch, generatedAt)
      : args.selections;
    const packets = createCandidateCurationPackets(
      batch,
      selectedCandidateIds,
      args.live ? "LIVE_PROVIDER" : "OFFLINE_SYNTHETIC",
      generatedAt,
    );
    process.stdout.write(`${stringifyForTerminal({
      packetType: "VENTUREX_BRIGHTDATA_CURATION_REVIEW_BATCH",
      schemaVersion: 1,
      mode: args.live ? "LIVE_PROVIDER" : "OFFLINE_SYNTHETIC",
      generatedAt,
      providerRequests: providerRequestCount,
      packetCount: packets.length,
      packets,
    })}\n`);
  } catch (error) {
    const code =
      error instanceof CurationCommandError || error instanceof CandidateCurationError
        ? error.code
        : error instanceof BrightDataProviderError || error instanceof BrightDataConfigurationError
          ? error.code ?? "CONFIGURATION_ERROR"
          : "CURATION_PACKET_FAILED";
    process.stderr.write(
      `Candidate curation stopped (${code}); provider requests attempted=${providerRequestCount}. Raw provider response and credentials were not displayed.\n`,
    );
    process.exitCode = 1;
  }
}

await main();
