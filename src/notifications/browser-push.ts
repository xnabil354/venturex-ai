"use client";
import { pushCapability } from "./push-capability";
import { fetchWithTimeout } from "@/lib/request-timeout";

const ownerKey = "venturex-push-owner";
let prepared: { userId: string; registration: ServiceWorkerRegistration; subscription: PushSubscription | null } | null = null;
export function browserPushCapability() {
  if (typeof window === "undefined") return { supported: false, hint: "" };
  const ios = /iPad|iPhone|iPod/u.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return pushCapability({ secure: window.isSecureContext, serviceWorker: "serviceWorker" in navigator, pushManager: "PushManager" in window, notification: "Notification" in window, ios, standalone: window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true });
}
export async function prepareBrowserPush(userId: string): Promise<void> {
  prepared = null;
  if (!supportsPush()) return;
  const registration = await navigator.serviceWorker.register("/notifications-sw.js", { scope: "/", updateViaCache: "none" });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && localStorage.getItem(ownerKey) !== userId) {
    if (!(await subscription.unsubscribe())) throw new Error("Aktifkan ulang notifikasi perangkat.");
    subscription = null;
  }
  prepared = { userId, registration, subscription };
}
export function supportsPush(): boolean {
  return browserPushCapability().supported;
}
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!supportsPush()) return null;
  return (
    (
      await navigator.serviceWorker.getRegistration("/")
    )?.pushManager.getSubscription() ?? null
  );
}
export async function enableBrowserPush(
  publicKey: string,
  userId: string,
): Promise<void> {
  if (!supportsPush())
    throw new Error(
      "Perangkat ini belum mendukung notifikasi. Di iPhone, tambahkan website ke Layar Utama.",
    );
  const ready = prepared?.userId === userId ? prepared : null;
  // With a prepared worker, subscribe directly inside the click for Safari user activation.
  if (Notification.permission === "denied" || (!ready && (await Notification.requestPermission()) !== "granted"))
    throw new Error("Izinkan notifikasi melalui pengaturan browser Anda.");
  const registration = ready?.registration ?? await navigator.serviceWorker.register(
    "/notifications-sw.js",
    { scope: "/", updateViaCache: "none" },
  );
  if (!ready) await navigator.serviceWorker.ready;
  let subscription = ready ? ready.subscription : await registration.pushManager.getSubscription();
  if (subscription && localStorage.getItem(ownerKey) !== userId) {
    await subscription.unsubscribe();
    subscription = null;
  }
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/gu, "+").replace(/_/gu, "/")),
    (character) => character.charCodeAt(0),
  );
  const created = !subscription;
  try {
    if (!subscription) {
      let expired = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const pending = registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      void pending
        .then(async (result) => {
          if (expired) await result.unsubscribe();
        })
        .catch(() => {});
      try {
        subscription = await Promise.race([
          pending,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => {
              expired = true;
              reject(new Error("PUSH_TIMEOUT"));
            }, 65_000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (failure) {
    if (
      failure instanceof Error &&
      /permission.*denied|not.?allowed/iu.test(failure.message)
    ) {
      throw new Error(
        "Pendaftaran notifikasi ditolak browser. Periksa izin situs dan perangkat.",
      );
    }
    throw new Error(
      "Perangkat belum terhubung ke layanan notifikasi. Periksa koneksi dan coba lagi.",
    );
  }
  try {
    const response = await fetchWithTimeout("/api/v1/notifications/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok)
      throw new Error("Perangkat belum dapat diaktifkan. Coba lagi.");
    localStorage.setItem(ownerKey, userId);
    prepared = { userId, registration, subscription };
  } catch (error) {
    if (created) await subscription.unsubscribe();
    throw error;
  }
}
export async function disableBrowserPush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (subscription) {
    let serverRemoved = false;
    try {
      const response = await fetchWithTimeout("/api/v1/notifications/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        keepalive: true,
      }, 5_000);
      serverRemoved = response.ok;
    } catch {
      /* Local revocation must still run when the network is unavailable. */
    }
    const browserRemoved = await subscription.unsubscribe().catch(() => false);
    if (!serverRemoved && !browserRemoved)
      throw new Error("Perangkat belum dapat dinonaktifkan. Coba lagi.");
  }
  localStorage.removeItem(ownerKey);
  prepared = null;
  const registration =
    "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistration("/")
      : null;
  for (const notification of (await registration?.getNotifications()) ?? [])
    notification.close();
}
export async function isBrowserPushEnabled(userId: string): Promise<boolean> {
  return (
    supportsPush() &&
    Notification.permission === "granted" &&
    localStorage.getItem(ownerKey) === userId &&
    Boolean(await currentPushSubscription())
  );
}
