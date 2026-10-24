import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
if (resolve(process.cwd()) !== resolve(projectRoot)) {
  process.stderr.write("Jalankan perintah dari root repository VENTUREX.\n");
  process.exit(2);
}
const args = process.argv.slice(2);
const liveRequested = args.includes("--live-synthetic");
const webpackRequested = args.includes("--webpack");
const positional = args.filter((arg) => arg !== "--live-synthetic" && arg !== "--webpack");
if (args.filter((arg) => arg === "--live-synthetic").length > 1
  || args.filter((arg) => arg === "--webpack").length > 1
  || positional.length > 1) {
  process.stderr.write("Gunakan: node scripts/demo/local-server.mjs [port-lokal] [--live-synthetic] [--webpack]\n");
  process.exit(2);
}

const portInput = positional[0] ?? "3016";
if (!/^\d{4,5}$/u.test(portInput) || Number(portInput) < 1024 || Number(portInput) > 65535) {
  process.stderr.write("Pilih port lokal antara 1024 dan 65535.\n");
  process.exit(2);
}

const liveGates = process.env.AI_ANALYSIS_SYNTHETIC_DEMO_LIVE_AUTHORIZED === "true"
  && process.env.AI_ANALYSIS_NINEROUTER_SYNTHETIC_SMOKE_ENABLED === "true";
if (liveRequested && !liveGates) {
  process.stderr.write("Mode LIVE_SYNTHETIC memerlukan otorisasi server-side dan flag smoke 9Router sintetis yang eksplisit. Tidak ada klaim tier billing.\n");
  process.exit(2);
}

const nextCli = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url));
const nextArgs = [nextCli, "dev", "--hostname", "127.0.0.1", "--port", portInput];
if (webpackRequested) nextArgs.push("--webpack");
const child = spawn(process.execPath, nextArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    AI_ANALYSIS_SYNTHETIC_DEMO_ENABLED: "true",
    VENTUREX_SYNTHETIC_DEMO_LOOPBACK_LAUNCHER: "127.0.0.1",
    VENTUREX_SYNTHETIC_DEMO_PORT: portInput,
    AI_ANALYSIS_SYNTHETIC_DEMO_PROVIDER_MODE: liveRequested ? "LIVE_SYNTHETIC" : "MOCK",
    AI_ANALYSIS_SYNTHETIC_DEMO_LIVE_AUTHORIZED: liveRequested ? "true" : "false",
  },
});

const forwardSignal = (signal) => child.kill(signal);
process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));
child.on("error", () => {
  process.stderr.write("Server demo lokal tidak dapat dijalankan.\n");
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
