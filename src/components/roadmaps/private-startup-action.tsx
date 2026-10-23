"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { privateStartupRoadmapSchema } from "@/roadmap/private-startup-contract";

export function PrivateStartupAction({ id, exists = false }: { readonly id: string; readonly exists?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = `/opportunities/hypotheses/${id}/roadmap`;
  async function generate() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/v1/opportunities/ideas/${id}/roadmap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin", cache: "no-store" });
      const payload: unknown = await response.json();
      if (!response.ok || typeof payload !== "object" || !payload || !("data" in payload) || !privateStartupRoadmapSchema.safeParse(payload.data).success) throw new Error("ROADMAP_FAILED");
      router.push(href); router.refresh();
    } catch { setError("Roadmap belum dapat dibuka. Periksa koneksi lalu coba kembali."); }
    finally { setBusy(false); }
  }
  return <div className="grid justify-items-start gap-8">
    {exists ? <Link href={href} className="inline-flex min-h-button items-center rounded-buttons bg-midnight-wine px-16 text-body-sm text-paper-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-violet">Buka Startup Roadmap</Link> : <Button onClick={() => void generate()} disabled={busy} loading={busy} loadingText="Menyusun roadmap..." variant="primary">Buat Startup Roadmap</Button>}
    {error ? <p className="text-body-sm text-midnight-wine" role="alert">{error}</p> : null}
  </div>;
}
