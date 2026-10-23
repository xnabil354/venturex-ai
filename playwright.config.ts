import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const port = process.env.VENTUREX_E2E_PORT;
if (!port || !/^\d{1,5}$/u.test(port)) {
  throw new Error("Run browser tests with pnpm test:e2e to provision an isolated environment.");
}

const baseURL = `http://127.0.0.1:${port}`;
const nextCli = fileURLToPath(new URL("./node_modules/next/dist/bin/next", import.meta.url));
const quote = (value: string) => `"${value.replaceAll('"', '\\"')}"`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  // Provider-backed local demos require explicit dedicated configs and must never run in disposable core E2E.
  testIgnore: ["**/synthetic-ai-demo.spec.ts", "**/live-account-opportunity.spec.ts"],
  outputDir: "./test-results/e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 40_000,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "tablet-chromium",
      testMatch: "**/existing-business.spec.ts",
      use: { browserName: "chromium", viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1365, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `${quote(process.execPath)} ${quote(nextCli)} dev --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
