import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

import {
  getNineRouterLiveE2EBlockReason,
  NINEROUTER_LIVE_E2E_BASE_URL,
  NINEROUTER_LIVE_E2E_MODEL,
} from "./scripts/demo/ninerouter-live-e2e-guard";

const blockReason = getNineRouterLiveE2EBlockReason(process.env);
if (blockReason) {
  throw new Error(`9Router live Playwright preflight blocked: ${blockReason}. No local server was launched.`);
}

const port = process.env.VENTUREX_NINEROUTER_LIVE_E2E_PORT ?? "3017";
if (!/^\d{4,5}$/u.test(port) || Number(port) < 1024 || Number(port) > 65535 || port === "3000") {
  throw new Error("9Router live Playwright requires a dedicated loopback port between 1024 and 65535, other than 3000.");
}
const baseURL = `http://127.0.0.1:${port}`;
const launcher = fileURLToPath(new URL("./scripts/demo/local-server.mjs", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  testMatch: "ninerouter-live-synthetic.spec.ts",
  outputDir: "./test-results/ninerouter-live-synthetic",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 50_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    { name: "live-synthetic-desktop-chromium", use: { browserName: "chromium", viewport: { width: 1365, height: 900 } } },
  ],
  webServer: {
    command: `${quote(process.execPath)} ${quote(launcher)} ${port} --live-synthetic --webpack`,
    url: `${baseURL}/local-demo/ai-analysis`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      AI_ANALYSIS_SYNTHETIC_DEMO_LIVE_AUTHORIZED: "true",
      AI_ANALYSIS_NINEROUTER_SYNTHETIC_SMOKE_ENABLED: "true",
      NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY: "true",
      AI_PROVIDER: "ninerouter",
      NINEROUTER_BASE_URL: NINEROUTER_LIVE_E2E_BASE_URL,
      NINEROUTER_MODEL: NINEROUTER_LIVE_E2E_MODEL,
      NINEROUTER_API_KEY: process.env.NINEROUTER_API_KEY,
    },
  },
});

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}
