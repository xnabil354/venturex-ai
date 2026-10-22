import { writeFileSync, existsSync } from "node:fs";
import webpush from "web-push";
if (existsSync(".notifications-vapid.json")) {
  console.info("Notification keys already exist; preserved existing keys.");
} else {
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(
    ".notifications-vapid.json",
    JSON.stringify({
      ...keys,
      subject:
        process.env.WEB_PUSH_SUBJECT ?? "mailto:notifications@venturex.local",
    }),
    { mode: 0o600, flag: "wx" },
  );
  console.info(
    "Created local notification keys in ignored .notifications-vapid.json. Configure a monitored public contact before deployment.",
  );
}
