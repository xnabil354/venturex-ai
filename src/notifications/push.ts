import "server-only";
import { readFileSync } from "node:fs";
import webpush from "web-push";
import { isPushEndpoint } from "./contract";

type PushConfig = { publicKey: string; privateKey: string; subject: string };
export function pushConfig(): PushConfig | null {
  let local: Record<string, string> = {};
  try {
    local = JSON.parse(
      readFileSync(".notifications-vapid.json", "utf8"),
    ) as Record<string, string>;
  } catch {
    /* Optional local key file; deployed environments use server variables. */
  }
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY ?? local.publicKey;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY ?? local.privateKey;
  const subject = process.env.WEB_PUSH_SUBJECT ?? local.subject;
  if (
    !publicKey ||
    !privateKey ||
    !subject ||
    !/^[A-Za-z0-9_-]{87}$/u.test(publicKey) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(privateKey) ||
    !/^(?:mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/u.test(subject)
  )
    return null;
  return { publicKey, privateKey, subject };
}
export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: { userId: string; id: string; test?: boolean },
): Promise<void> {
  const config = pushConfig();
  if (!config) throw new Error("PUSH_UNAVAILABLE");
  if (!isPushEndpoint(subscription.endpoint))
    throw new Error("INVALID_ENDPOINT");
  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      ...payload,
      title: payload.test ? "Notifikasi aktif" : "Tren terbaru untuk Anda",
      body: payload.test
        ? "Perangkat ini siap menerima ringkasan tren."
        : "Ringkasan tren Anda sudah tersedia.",
    }),
    {
      vapidDetails: {
        subject: config.subject,
        publicKey: config.publicKey,
        privateKey: config.privateKey,
      },
      TTL: 3600,
      timeout: 10_000,
      urgency: "normal",
    },
  );
}
