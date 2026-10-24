"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui";

type BillingCheckoutButtonProps = {
  readonly children: ReactNode;
  readonly productCode: string;
  readonly variant?: "primary" | "inverse";
};

export function BillingCheckoutButton({ productCode, children, variant = "primary" }: BillingCheckoutButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function checkout() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/v1/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productCode }), credentials: "same-origin",
      });
      const payload = await response.json() as { data?: { checkoutUrl?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.checkoutUrl) throw new Error(payload.error?.message ?? "Checkout belum dapat dibuat.");
      window.location.assign(payload.data.checkoutUrl);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Checkout belum dapat dibuat.");
    }
  }

  return <div>
    <Button className="w-full" loading={state === "loading"} loadingText="Membuka Duitku…" onClick={checkout} variant={variant === "inverse" ? "inverse" : "primary"}>{children}</Button>
    {state === "error" ? <p className="mt-8 text-caption text-[#9b2c2c]" role="alert">{message}</p> : null}
  </div>;
}
