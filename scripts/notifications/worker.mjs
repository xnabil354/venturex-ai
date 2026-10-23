import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { Client } from "pg";
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
// This entry point runs only in Node, so resolve Next's server-only marker to its server export.
const jiti = createJiti(import.meta.url, {
  alias: {
    "@": resolve("src"),
    "server-only": resolve(dirname(require.resolve("server-only")), "empty.js"),
  },
});
const { runNotificationTick } = await jiti.import(
  pathToFileURL(resolve("src/notifications/worker.ts")).href,
);
const { getSequelize } = await jiti.import(
  pathToFileURL(resolve("src/db/sequelize.ts")).href,
);
let stopped = false;
let timer;
const parentFlag = process.argv.indexOf("--parent-pid");
const monitoredParent =
  parentFlag >= 0 ? Number(process.argv[parentFlag + 1]) : null;
if (
  monitoredParent !== null &&
  (!Number.isSafeInteger(monitoredParent) || monitoredParent < 1)
)
  throw new Error("Invalid parent PID");
const stop = () => {
  stopped = true;
  if (timer) clearTimeout(timer);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
if (!process.env.DATABASE_URL) throw new Error("Missing DATABASE_URL");
// A dedicated session avoids taking a connection from the application transaction pool.
// One leader per database also preserves the provider's in-process cache/budget across app restarts.
const lease = new Client({
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
  connectionTimeoutMillis: 5000,
});
lease.on("error", () => {
  console.error("Notification worker lost its scheduling lease.");
  process.exit(1);
});
await lease.connect();
let leader = false;
try {
  do {
    if (monitoredParent !== null) {
      try {
        process.kill(monitoredParent, 0);
      } catch {
        break;
      }
    }
    try {
      if (!leader)
        leader = (
          await lease.query(
            "SELECT pg_try_advisory_lock($1,$2) AS acquired",
            [1447382612, 1313821766],
          )
        ).rows[0].acquired;
      if (leader) {
        const counts = await runNotificationTick();
        console.info("Notification tick", counts);
      } else
        console.info(
          "Notification worker standby; another worker owns the schedule.",
        );
    } catch (error) {
      console.error("Notification tick failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      if (process.argv.includes("--once")) process.exitCode = 1;
    }
    if (process.argv.includes("--once") || stopped) break;
    await new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer);
        process.off("SIGINT", wake);
        process.off("SIGTERM", wake);
        resolve();
      };
      timer = setTimeout(wake, 60_000);
      process.once("SIGINT", wake);
      process.once("SIGTERM", wake);
    });
  } while (!stopped);
} finally {
  await getSequelize().close();
  await lease.end();
}
