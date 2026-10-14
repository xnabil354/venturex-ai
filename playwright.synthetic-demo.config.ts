import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const port = process.env.VENTUREX_SYNTHETIC_DEMO_TEST_PORT ?? "3016";
if (!/^\d{4,5}$/u.test(port) || Number(port) < 1024 || Number(port) > 65535) {
  throw new Error("Synthetic demo browser test port is invalid.");
}
const baseURL = `http://127.0.0.1:${port}`;
const launcher = fileURLToPath(new URL("./scripts/demo/local-server.mjs", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  testMatch: "synthetic-ai-demo.spec.ts",
  outputDir: "./test-results/synthetic-ai-demo",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    screenshot: "only-on-failure",
    trace: "off",
    video: "off",
  },
  projects: [
    { name: "desktop-chromium", use: { browserName: "chromium", viewport: { width: 1365, height: 900 } } },
    { name: "mobile-chromium", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `${quote(process.execPath)} ${quote(launcher)} ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

function quote(value: string): string {
  return `"${value.replaceAll('"', '\\"')}"`;
}
