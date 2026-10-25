"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui";
import { useBillingState } from "@/components/billing/billing-state";

type BillingCheckoutButtonProps = {
  readonly children: ReactNode;
  readonly productCode: string;
  readonly variant?: "primary" | "inverse";
  readonly plan?: "PREMIUM" | "PRO" | undefined;
};

export function BillingCheckoutButton({ productCode, children, variant = "primary", plan }: BillingCheckoutButtonProps) {
  const billing = useBillingState();
  const snapshot = billing?.snapshot;
  const activeEndsAt = snapshot && snapshot.plan === plan ? snapshot.planEndsAt : null;
  const alreadyActive = Boolean(plan && activeEndsAt);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function checkout() {
    if (alreadyActive) return;
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
    <Button className="w-full" disabled={alreadyActive} loading={state === "loading"} loadingText="Membuka Duitku…" onClick={checkout} variant={variant === "inverse" ? "inverse" : "primary"}>{alreadyActive ? "Paket aktif" : children}</Button>
    {alreadyActive ? <p className="mt-8 text-caption" role="status">Paket {plan} sudah aktif. Anda tidak perlu membelinya lagi sekarang.</p> : null}
    {state === "error" ? <p className="mt-8 text-caption text-[#9b2c2c]" role="alert">{message}</p> : null}
  </div>;
}
