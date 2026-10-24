"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui";
import { disableBrowserPush } from "@/notifications/browser-push";

export function LogoutButton({
  className,
  variant = "ghost",
}: {
  className?: string;
  variant?: "ghost" | "inverse";
}) {
  return (
    <Button
      className={className}
      onClick={() => void (async () => {
        try { await disableBrowserPush(); } catch { /* Session revocation still prevents authenticated push display. */ }
        await signOut({ callbackUrl: "/login" });
      })()}
      variant={variant}
    >
      Keluar
    </Button>
  );
}
