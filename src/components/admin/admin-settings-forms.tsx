"use client";

import { useState, type FormEvent } from "react";

import type { AdminProductSetting, AdminUsageSetting } from "@/billing/admin";
import { Button, Input } from "@/components/ui";

function apiError(payload: unknown): string {
  if (typeof payload === "object" && payload && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return "Perubahan belum dapat disimpan. Coba lagi.";
}

export function ProductSettingsForm({ initial }: { readonly initial: ReadonlyArray<AdminProductSetting> }) {
  const [settings, setSettings] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, setting: AdminProductSetting) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    const credits = Number(form.get("credits"));
    if (!Number.isInteger(amount) || amount <= 0 || !Number.isInteger(credits) || credits < 1) {
      setNotice("Harga harus positif dan jatah kredit minimal 1.");
      return;
    }
    setPending(setting.productCode);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/admin/billing/products/${setting.productCode}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, credits, version: setting.version }) });
      const payload = await response.json() as { data?: AdminProductSetting };
      if (!response.ok || !payload.data) throw new Error(apiError(payload));
      setSettings((current) => current.map((item) => item.productCode === setting.productCode ? payload.data! : item));
      setNotice(`${setting.name} diperbarui. Perubahan hanya berlaku untuk checkout baru.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Perubahan belum dapat disimpan. Coba lagi.");
    } finally {
      setPending(null);
    }
  }

  return <div className="grid gap-16">{notice ? <p aria-live="polite" className="border-l-2 border-royal-violet bg-lilac-mist/30 px-12 py-10 text-body-sm text-ink-charcoal">{notice}</p> : null}{settings.map((setting) => <form className="grid gap-14 rounded-cards border border-soft-mist bg-paper-white p-16 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] sm:items-end" key={setting.productCode} onSubmit={(event) => void submit(event, setting)}><div><p className="text-label-bold text-ink-charcoal">{setting.name}</p><p className="mt-4 text-caption text-stone-gray">{setting.kind === "PLAN" ? `${setting.plan} · berlaku 30 hari` : "Top up tidak kedaluwarsa"}</p></div><Input id={`price-${setting.productCode}`} label="Harga (IDR)" min={1} name="amount" required type="number" defaultValue={setting.amount} /><Input id={`credits-${setting.productCode}`} label="Kredit" min={1} name="credits" required type="number" defaultValue={setting.credits} /><Button loading={pending === setting.productCode} loadingText="Menyimpan" type="submit">Simpan</Button></form>)}</div>;
}

const usageLabels: Record<AdminUsageSetting["usageKind"], string> = {
  OPPORTUNITY_HYPOTHESIS: "Buat hipotesis",
  DETAILED_ANALYSIS: "Analisis mendalam",
};

export function UsageSettingsForm({ initial }: { readonly initial: ReadonlyArray<AdminUsageSetting> }) {
  const [settings, setSettings] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, setting: AdminUsageSetting) {
    event.preventDefault();
    const creditCost = Number(new FormData(event.currentTarget).get("creditCost"));
    if (!Number.isInteger(creditCost) || creditCost < 0 || creditCost > 100) {
      setNotice("Biaya harus berupa bilangan bulat antara 0 dan 100.");
      return;
    }
    setPending(setting.usageKind);
    setNotice(null);
    try {
      const response = await fetch(`/api/v1/admin/billing/usage/${setting.usageKind}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creditCost, version: setting.version }) });
      const payload = await response.json() as { data?: AdminUsageSetting };
      if (!response.ok || !payload.data) throw new Error(apiError(payload));
      setSettings((current) => current.map((item) => item.usageKind === setting.usageKind ? payload.data! : item));
      setNotice(`${usageLabels[setting.usageKind]} diperbarui. Tarif baru dipakai oleh aksi berikutnya.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Perubahan belum dapat disimpan. Coba lagi.");
    } finally {
      setPending(null);
    }
  }

  return <div className="grid gap-16">{notice ? <p aria-live="polite" className="border-l-2 border-royal-violet bg-lilac-mist/30 px-12 py-10 text-body-sm text-ink-charcoal">{notice}</p> : null}{settings.map((setting) => <form className="grid gap-14 rounded-cards border border-soft-mist bg-paper-white p-16 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end" key={setting.usageKind} onSubmit={(event) => void submit(event, setting)}><div><p className="text-label-bold text-ink-charcoal">{usageLabels[setting.usageKind]}</p><p className="mt-4 text-caption text-stone-gray">Nilai 0 tidak memotong saldo; paket atau trial tetap diperlukan.</p></div><Input id={`usage-${setting.usageKind}`} label="Kredit per aksi" min={0} max={100} name="creditCost" required type="number" defaultValue={setting.creditCost} /><Button loading={pending === setting.usageKind} loadingText="Menyimpan" type="submit">Simpan</Button></form>)}</div>;
}
