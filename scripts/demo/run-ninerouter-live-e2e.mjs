import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { getNineRouterLiveE2EBlockReason } from "./ninerouter-live-e2e-guard.ts";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
if (resolve(process.cwd()) !== resolve(projectRoot)) {
  process.stderr.write("Jalankan perintah dari root repository VENTUREX.\n");
  process.exit(2);
}

const blockReason = getNineRouterLiveE2EBlockReason(process.env);
if (blockReason) {
  process.stderr.write(`9Router live Playwright preflight blocked: ${blockReason}. No browser or server was started.\n`);
  process.exit(2);
}

const forwardedArguments = process.argv.slice(2);
if (forwardedArguments.some((argument) => argument !== "--list")) {
  process.stderr.write("Only Playwright's --list option is accepted by the isolated live test runner.\n");
  process.exit(2);
}

const stagingRoot = mkdtempSync(join(tmpdir(), "venturex-ninerouter-live-e2e-"));
const isolatedProjectRoot = join(stagingRoot, "repo");
const excludedDirectories = new Set([
  ".git", "node_modules", ".next", "coverage", "test-results", "playwright-report", ".turbo",
]);

try {
  cpSync(projectRoot, isolatedProjectRoot, {
    recursive: true,
    filter(source) {
      const relativePath = relative(projectRoot, source);
      if (!relativePath) return true;
      const segments = relativePath.split(sep);
      if (segments.some((segment) => excludedDirectories.has(segment.toLowerCase()))) return false;
      const name = segments.at(-1) ?? "";
      if ((name === ".env" || (name.startsWith(".env.") && name !== ".env.example"))) return false;
      return true;
    },
  });
  symlinkSync(resolve(projectRoot, "node_modules"), join(isolatedProjectRoot, "node_modules"), "junction");

  const playwrightCli = join(isolatedProjectRoot, "node_modules", "@playwright", "test", "cli.js");
  const result = spawnSync(process.execPath, [
    playwrightCli,
    "test",
    "--config=playwright.ninerouter-live.config.ts",
    ...forwardedArguments,
  ], {
    cwd: isolatedProjectRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  if (result.error) {
    process.stderr.write("The isolated Playwright process could not start.\n");
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
} finally {
  const resolvedTempRoot = resolve(tmpdir());
  const resolvedStagingRoot = resolve(stagingRoot);
  const relativeTempPath = relative(resolvedTempRoot, resolvedStagingRoot);
  if (dirname(resolvedStagingRoot) !== resolvedTempRoot
    || !basename(resolvedStagingRoot).startsWith("venturex-ninerouter-live-e2e-")
    || !relativeTempPath
    || relativeTempPath.startsWith(`..${sep}`)
    || relativeTempPath === ".."
    || isAbsolute(relativeTempPath)) {
    throw new Error("Refusing to remove an unexpected temporary test directory.");
  }
  rmSync(resolvedStagingRoot, { recursive: true, force: true });
}
