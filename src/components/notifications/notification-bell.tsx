import Link from "next/link";

export function NotificationBell() {
  return (
    <Link
      aria-label="Notifikasi"
      href="/notifications"
      className="inline-flex size-button shrink-0 items-center justify-center rounded-small-buttons text-paper-white transition-colors hover:bg-white/10 hover:text-lilac-mist focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lilac-mist"
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
    </Link>
  );
}
