import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const require = createRequire(import.meta.url);
const command = process.argv[2];
if (command !== "dev" && command !== "start")
  throw new Error("Expected dev or start");
const standaloneServer = command === "start" && existsSync("server.js");
const web = spawn(
  process.execPath,
  standaloneServer
    ? ["server.js", ...process.argv.slice(3)]
    : [require.resolve("next/dist/bin/next"), command, ...process.argv.slice(3)],
  { stdio: "inherit", windowsHide: true },
);
const worker = spawn(
  process.execPath,
  [
    "--conditions=react-server",
    "--env-file-if-exists=.env",
    "scripts/notifications/worker.mjs",
  ],
  { stdio: "inherit", windowsHide: true },
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
  web.kill("SIGTERM");
  worker.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
web.on("exit", (code, signal) => {
  if (!stopping) {
    console.error("Next.js server stopped; restarting both services.", {
      code,
      signal,
    });
    process.exitCode = code ?? 1;
    stop();
  }
});
worker.on("exit", (code, signal) => {
  if (!stopping) {
    console.error(
      "Notification worker stopped; restarting both services.",
      { code, signal },
    );
    process.exitCode = code || 1;
    stop();
  }
});
