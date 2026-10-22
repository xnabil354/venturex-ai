"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const ownerRef = useRef<string | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    async function update() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/v1/notifications", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as {
            unread: number;
            userId: string;
          };
          if (ownerRef.current && ownerRef.current !== data.userId) {
            window.location.reload();
            return;
          }
          ownerRef.current = data.userId;
          setUnread(data.unread);
          window.dispatchEvent(
            new CustomEvent("notifications-inbox", { detail: data }),
          );
        } else if (response.status === 401) window.location.reload();
      } catch {
        /* Keep navigation usable if notifications are temporarily unavailable. */
      }
    }
    void update();
    const timer = setInterval(() => void update(), 60_000);
    window.addEventListener("notifications-updated", update);
    document.addEventListener("visibilitychange", update);
    navigator.serviceWorker?.addEventListener("message", update);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("notifications-updated", update);
      document.removeEventListener("visibilitychange", update);
      navigator.serviceWorker?.removeEventListener("message", update);
    };
  }, [pathname]);
  return (
    <Link
      aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
      href="/notifications"
      className="relative inline-flex size-button shrink-0 items-center justify-center rounded-small-buttons text-paper-white transition-colors hover:bg-white/10 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist"
    >
      <svg
        aria-hidden="true"
        className="size-20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
        <path d="M10 21h4" strokeLinecap="round" />
      </svg>
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-8 top-8 size-8 rounded-full bg-lilac-mist ring-2 ring-midnight-wine"
        />
      ) : null}
    </Link>
  );
}
