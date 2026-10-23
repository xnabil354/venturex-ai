import { defineConfig } from "@playwright/test";

if (process.env.VENTUREX_RUN_LIVE_ACCOUNT_E2E !== "true") {
  throw new Error("Set VENTUREX_RUN_LIVE_ACCOUNT_E2E=true to run the one-pass live account journey.");
}
if (!process.env.VENTUREX_E2E_EMAIL || !process.env.VENTUREX_E2E_PASSWORD) {
  throw new Error("Live account E2E requires credentials from the interactive local prompt.");
}

const baseURL = process.env.VENTUREX_E2E_BASE_URL ?? "http://127.0.0.1:3000";
if (new URL(baseURL).hostname !== "127.0.0.1" || new URL(baseURL).protocol !== "http:") {
  throw new Error("Live account E2E is restricted to the local 127.0.0.1 server.");
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "live-account-opportunity.spec.ts",
  outputDir: "./test-results/live-account-opportunity",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1365, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 40_000,
    screenshot: "off",
    trace: "off",
    video: "off",
  },
});
