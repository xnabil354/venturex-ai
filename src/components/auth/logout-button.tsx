"use client";

import { signOut } from "next-auth/react";

import { Button } from "@/components/ui";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <Button
      className={className}
      onClick={() => void signOut({ callbackUrl: "/login" })}
      variant="ghost"
    >
      Keluar
    </Button>
  );
}
