import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const command = process.argv[2];
if (command !== "dev" && command !== "start")
  throw new Error("Expected dev or start");
const web = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), command, ...process.argv.slice(3)],
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
  web.kill("SIGTERM");
  worker.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
web.on("exit", (code) => {
  if (!stopping) {
    process.exitCode = code ?? 1;
    stop();
  }
});
worker.on("exit", (code) => {
  if (!stopping) {
    console.error(
      "Notification worker stopped; shutting down so the process supervisor can restart both services.",
    );
    process.exitCode = code || 1;
    stop();
  }
});
