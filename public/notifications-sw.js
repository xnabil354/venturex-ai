/* Notifications only: no offline interception or application caching. */
self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let message;
      try {
        message = event.data.json();
      } catch {
        return;
      }
      if (
        !message ||
        typeof message.userId !== "string" ||
        typeof message.id !== "string"
      )
        return;
      try {
        const response = await fetch("/api/v1/notifications/push/context", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const context = await response.json();
        if (context.userId !== message.userId) return;
      } catch {
        // An offline notification contains only generic text, never profile or search details.
      }
      await self.registration.showNotification(
        message.test ? "Notifikasi aktif" : "Tren terbaru untuk Anda",
        {
          body: message.test
            ? "Perangkat ini siap menerima ringkasan tren."
            : "Ringkasan tren Anda sudah tersedia.",
          tag: `venturex-${message.id}`,
          icon: "/notification-icon-192.png",
          badge: "/notification-icon-192.png",
          data: { url: "/notifications", userId: message.userId },
        },
      );
      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows)
        client.postMessage({ type: "VENTUREX_NOTIFICATION" });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        try {
          await existing.focus();
          await existing.navigate(new URL("/notifications", self.location.origin).href);
        } catch {
          await self.clients.openWindow("/notifications");
        }
      } else await self.clients.openWindow("/notifications");
    })(),
  );
});
