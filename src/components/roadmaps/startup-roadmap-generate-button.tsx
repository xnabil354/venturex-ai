"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";

type RoadmapCreateResponse = {
  readonly success: boolean;
  readonly data?: { readonly id: string };
  readonly error?: { readonly code?: string };
};

const errorCopy: Record<string, string> = {
  UNAUTHORIZED: "Sesi Anda tidak tersedia. Masuk kembali untuk membuat roadmap.",
  ROADMAP_NOT_ALLOWED: "Fitur Startup Roadmap hanya tersedia untuk Calon Pengusaha.",
  PROFILE_INCOMPLETE: "Lengkapi profil calon pengusaha sebelum membuat roadmap.",
  RESOURCE_NOT_FOUND: "Opportunity atau konteks yang diperlukan tidak tersedia.",
  ROADMAP_GENERATION_FAILED: "Roadmap belum dapat dibuat. Coba lagi nanti.",
};

export function StartupRoadmapGenerateButton({ opportunityId }: { readonly opportunityId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/v1/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });
      const result = await response.json() as RoadmapCreateResponse;
      if (!response.ok || !result.success || !result.data?.id) {
        setMessage(errorCopy[result.error?.code ?? ""] ?? "Roadmap belum dapat dibuat. Periksa koneksi lalu coba lagi.");
        return;
      }
      setMessage("Roadmap tersimpan. Membuka detail roadmap…");
      router.push(`/roadmaps/${result.data.id}`);
      router.refresh();
    } catch {
      setMessage("Roadmap belum dapat dibuat. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-8">
      <Button loading={pending} onClick={generate} type="button">
        Buat Startup Roadmap
      </Button>
      <p className="max-w-[76ch] text-caption leading-body-sm text-stone-gray">
        Enam langkah validasi terstruktur dari profil dan Opportunity tersimpan. Roadmap bukan prediksi, dan tidak menjamin hasil bisnis.
      </p>
      {message ? <p aria-live="polite" className="max-w-[76ch] text-body-sm text-ink-charcoal" role="status">{message}</p> : null}
    </div>
  );
}
