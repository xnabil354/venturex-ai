"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  browserPushCapability,
  disableBrowserPush,
  enableBrowserPush,
  prepareBrowserPush,
  supportsPush,
} from "@/notifications/browser-push";
import type { InboxItem, NotificationState } from "@/notifications/contract";
import { fetchWithTimeout } from "@/lib/request-timeout";

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  let value: T & { error?: { message?: string } };
  try {
    response = await fetchWithTimeout(url, {
      method,
      cache: "no-store",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    value = (await response.json()) as T & { error?: { message?: string } };
  } catch {
    throw new Error("Permintaan belum berhasil. Periksa koneksi dan coba lagi.");
  }
  if (!response.ok)
    throw new Error(value.error?.message ?? "Permintaan belum berhasil. Coba lagi.");
  return value;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function NotificationCenter() {
  const [state, setState] = useState<NotificationState | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function load() {
    return Promise.all([
      api<NotificationState>("/api/v1/notifications/preferences"),
      api<{ items: InboxItem[] }>("/api/v1/notifications"),
    ])
      .then(async ([settings, inbox]) => {
        setState(settings);
        setItems(inbox.items);
        if (settings.pushAvailable && supportsPush()) {
          try {
            await prepareBrowserPush(settings.userId);
          } catch {
            // Browser push is progressive enhancement; the in-app archive remains usable.
          }
        }
      })
      .catch((failure: unknown) =>
        setError(
          failure instanceof Error ? failure.message : "Notifikasi belum dapat dimuat.",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle() {
    if (!state) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (state.enabled) {
        const updated = await api<NotificationState>(
          "/api/v1/notifications/preferences",
          "PATCH",
          { enabled: false },
        );
        setState(updated);
        try {
          await disableBrowserPush();
        } catch {
          // The server has already revoked future sends for every device.
        }
        setNotice("Notifikasi mingguan dinonaktifkan.");
        return;
      }

      let pushNotice = "";
      if (state.pushAvailable && state.publicKey && supportsPush()) {
        try {
          await enableBrowserPush(state.publicKey, state.userId);
        } catch (failure) {
          pushNotice = ` ${failure instanceof Error ? failure.message : browserPushCapability().hint}`;
        }
      } else if (!supportsPush()) {
        pushNotice = ` ${browserPushCapability().hint}`;
      }
      const updated = await api<NotificationState>(
        "/api/v1/notifications/preferences",
        "PATCH",
        { enabled: true },
      );
      setState(updated);
      setNotice(`Ringkasan mingguan aktif.${pushNotice}`);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Perubahan belum tersimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return <p role="status" className="text-body-sm text-stone-gray">Memuat notifikasi…</p>;
  if (!state)
    return (
      <Card>
        <p role="alert">{error || "Notifikasi belum dapat dimuat."}</p>
        <Button className="mt-16" onClick={() => { setLoading(true); setError(""); void load(); }}>
          Coba lagi
        </Button>
      </Card>
    );

  return (
    <div className="grid items-start gap-24 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <section aria-label="Arsip ringkasan tren" className="grid min-w-0 gap-16">
        <h2 className="text-subheading text-ink-charcoal">Arsip ringkasan</h2>
        {!items.length ? (
          <Card className="p-24 sm:p-32">
            <h3 className="text-label-bold">Belum ada ringkasan</h3>
            <p className="mt-8 max-w-[45ch] text-body-sm text-stone-gray">
              Aktifkan notifikasi untuk menerima ringkasan Food &amp; Drink setiap Senin.
            </p>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="min-w-0 p-20 sm:p-24">
              <h3 className="text-label-bold text-ink-charcoal">
                {item.digest.category} · {item.digest.scope}
              </h3>
              <p className="mt-4 text-caption text-stone-gray">
                Minggu {dateLabel(item.weekStart)} · Periode {item.digest.startDate ?? "—"}–{item.digest.endDate ?? "—"}
              </p>
              <div className="mt-20 grid gap-20 sm:grid-cols-2">
                {(["top", "rising"] as const).map((kind) => (
                  <div key={kind}>
                    <h4 className="text-body-sm font-w540 text-ink-charcoal">
                      {kind === "top" ? "Terpopuler" : "Makin populer"}
                    </h4>
                    <ul className="mt-8 grid gap-8">
                      {item.digest[kind].map((row) => (
                        <li key={`${kind}-${row.position}-${row.query}`} className="flex items-baseline justify-between gap-12 text-body-sm">
                          <span className="min-w-0 break-words">{row.query}</span>
                          <span className="shrink-0 text-caption text-stone-gray">
                            {kind === "top"
                              ? (row.interestIndex ?? "—")
                              : row.isBreakout
                                ? "Lonjakan"
                                : row.growthPercent != null
                                  ? `+${row.growthPercent}%`
                                  : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}
      </section>
      <aside aria-label="Pengaturan notifikasi" className="grid min-w-0 gap-16">
        {error ? <p role="alert" className="rounded-small-buttons border border-midnight-wine bg-paper-white p-12 text-body-sm text-midnight-wine">{error}</p> : null}
        {notice ? <p role="status" className="text-body-sm text-deep-lagoon">{notice}</p> : null}
        <Card className="p-20 sm:p-24">
          <h2 className="text-subheading text-ink-charcoal">Notifikasi mingguan</h2>
          <dl className="mt-16 grid gap-12 text-body-sm">
            <div className="flex justify-between gap-12"><dt className="text-stone-gray">Topik</dt><dd className="font-w540">{state.category}</dd></div>
            <div className="flex justify-between gap-12"><dt className="text-stone-gray">Cakupan</dt><dd className="font-w540">{state.scope}</dd></div>
            <div className="flex justify-between gap-12"><dt className="text-stone-gray">Jadwal</dt><dd className="font-w540">{state.schedule}</dd></div>
          </dl>
          <p className="mt-16 text-body-sm text-stone-gray">
            {state.enabled
              ? "Aktif. Ringkasan juga tersimpan di arsip ini."
              : "Nonaktif. Aktifkan untuk menerima ringkasan mingguan."}
          </p>
          <Button
            className="mt-20 w-full"
            loading={busy}
            loadingText={state.enabled ? "Menonaktifkan…" : "Mengaktifkan…"}
            onClick={() => void toggle()}
          >
            {state.enabled ? "Nonaktifkan notifikasi" : "Aktifkan notifikasi"}
          </Button>
        </Card>
      </aside>
    </div>
  );
}
