"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import {
  currentPushSubscription,
  disableBrowserPush,
  enableBrowserPush,
  isBrowserPushEnabled,
  supportsPush,
} from "@/notifications/browser-push";
import type {
  InboxItem,
  NotificationState,
  Preferences,
} from "@/notifications/contract";
import { browserPushCapability, prepareBrowserPush } from "@/notifications/browser-push";
import { fetchWithTimeout } from "@/lib/request-timeout";

const periodLabels = {
  "24h": "24 jam terakhir",
  "7d": "7 hari terakhir",
  month: "Bulan ini (WIB)",
};
function radarHref(item: InboxItem, state: NotificationState): string {
  const topic =
    state.options.find(
      (option) =>
        option.key === item.digest.queryKey &&
        option.query === item.digest.query,
    ) ?? state.options.find((option) => option.query === item.digest.query);
  return topic && topic.key !== "preferred"
    ? `/trends?${new URLSearchParams({ queryKey: topic.key })}`
    : "/trends";
}
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
    throw new Error(
      "Permintaan belum berhasil. Periksa koneksi dan coba lagi.",
    );
  }
  if (!response.ok)
    throw new Error(
      value.error?.message ?? "Permintaan belum berhasil. Coba lagi.",
    );
  return value;
}
export function NotificationCenter() {
  const [state, setState] = useState<NotificationState | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushHint, setPushHint] = useState("");
  const [pushPrepared, setPushPrepared] = useState(false);
  const ownerRef = useRef<string | null>(null);

  function load() {
    return Promise.all([
      api<NotificationState>("/api/v1/notifications/preferences"),
      api<{ items: InboxItem[]; nextCursor: string | null; userId: string }>(
        "/api/v1/notifications",
      ),
    ])
      .then(async ([settings, inbox]) => {
        if (settings.userId !== inbox.userId) {
          window.location.reload();
          return;
        }
        ownerRef.current = settings.userId;
        setState(settings);
        setPreferences(settings.preferences);
        setItems(inbox.items);
        setCursor(inbox.nextCursor);
        setLoading(false);
        setPushHint(browserPushCapability().hint);
        setPushSupported(supportsPush());
        setPushEnabled(await isBrowserPushEnabled(settings.userId));
      })
      .catch((failure: unknown) => {
        setError(
          failure instanceof Error
            ? failure.message
            : "Notifikasi belum dapat dimuat.",
        );
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    void load();
    function receiveInbox(event: Event) {
      const { items: incoming, userId } = (
        event as CustomEvent<{ items: InboxItem[]; userId: string }>
      ).detail;
      if (ownerRef.current && ownerRef.current !== userId) {
        setItems([]);
        window.location.reload();
        return;
      }
      if (!Array.isArray(incoming)) return;
      setItems((current) => {
        const currentById = new Map(current.map((item) => [item.id, item]));
        const incomingIds = new Set(incoming.map((item) => item.id));
        return [
          ...incoming.map((item) => ({
            ...item,
            readAt: currentById.get(item.id)?.readAt ?? item.readAt,
          })),
          ...current.filter((item) => !incomingIds.has(item.id)),
        ];
      });
    }
    window.addEventListener("notifications-inbox", receiveInbox);
    return () =>
      window.removeEventListener("notifications-inbox", receiveInbox);
  }, []);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Perubahan belum tersimpan.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!preferences) return;
    setSaving(true);
    await perform(async () => {
      const updated = await api<NotificationState>(
        "/api/v1/notifications/preferences",
        "PATCH",
        preferences,
      );
      setState(updated);
      setPreferences(updated.preferences);
      setNotice(
        updated.preferences.enabled
          ? "Tersimpan. Ringkasan mengikuti jadwal berikutnya."
          : "Ringkasan harian dinonaktifkan.",
      );
    });
    setSaving(false);
  }
  async function markRead(id: string) {
    await perform(async () => {
      await api("/api/v1/notifications", "PATCH", { id });
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      window.dispatchEvent(new Event("notifications-updated"));
    });
  }
  async function togglePush() {
    if (!state) return;
    setDeviceBusy(true);
    await perform(async () => {
      if (!pushEnabled && !pushPrepared) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([prepareBrowserPush(state.userId), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Perangkat belum siap. Coba lagi.")), 15_000); })]);
          setPushPrepared(true);
          setNotice("Perangkat siap. Tekan Aktifkan perangkat untuk mengizinkan notifikasi.");
        } finally { clearTimeout(timer); }
        return;
      }
      if (pushEnabled) await disableBrowserPush();
      else if (state.publicKey)
        await enableBrowserPush(state.publicKey, state.userId);
      setPushEnabled(await isBrowserPushEnabled(state.userId));
      if (pushEnabled) setPushPrepared(false);
      setNotice(
        pushEnabled
          ? "Notifikasi perangkat dinonaktifkan."
          : "Notifikasi perangkat aktif. Aktifkan ringkasan harian untuk menerima tren.",
      );
    });
    setDeviceBusy(false);
  }
  if (loading)
    return (
      <p role="status" className="text-body-sm text-stone-gray">
        Memuat notifikasi…
      </p>
    );
  if (!state || !preferences)
    return (
      <Card>
        <p role="alert">{error}</p>
        <Button
          className="mt-16"
          onClick={() => {
            setLoading(true);
            setError("");
            void load();
          }}
        >
          Coba lagi
        </Button>
      </Card>
    );

  return (
    <>
      {error ? (
        <p
          role="alert"
          className="rounded-small-buttons border border-midnight-wine bg-paper-white p-12 text-body-sm text-midnight-wine"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-body-sm text-deep-lagoon">
          {notice}
        </p>
      ) : null}
      <div className="grid items-start gap-24 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <section aria-label="Ringkasan tren" className="grid min-w-0 gap-16">
          <h2 className="text-subheading text-ink-charcoal">Ringkasan Anda</h2>
          {!items.length ? (
            <Card className="p-24 sm:p-32">
              <div className="mb-16 flex size-48 items-center justify-center rounded-small-buttons bg-lilac-mist/40 text-royal-violet">
                <svg
                  aria-hidden="true"
                  className="size-24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="m3 17 6-6 4 3 7-9M15 5h5v5" />
                </svg>
              </div>
              <h3 className="text-label-bold">Belum ada ringkasan</h3>
              <p className="mt-8 max-w-[45ch] text-body-sm text-stone-gray">
                Aktifkan ringkasan harian. Tren akan muncul di sini sesuai
                jadwal Anda.
              </p>
              <Link
                className="mt-16 inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                href="/trends"
              >
                Lihat Trend Radar
              </Link>
            </Card>
          ) : (
            items.map((item) => (
              <Card
                key={item.id}
                className={`min-w-0 p-20 sm:p-24 ${item.readAt ? "" : "border-royal-violet/40"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-8">
                  <h3 className="break-words text-label-bold text-ink-charcoal">
                    Tren {item.digest.query}
                  </h3>
                  {!item.readAt ? (
                    <span className="text-caption font-w540 text-royal-violet">
                      Belum dibaca
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-caption text-stone-gray">
                  <time dateTime={item.createdAt}>
                    {new Intl.DateTimeFormat("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Jakarta",
                    }).format(new Date(item.createdAt))}
                  </time>{" "}
                  · {periodLabels[item.digest.period]} · Indonesia
                </p>
                <div className="mt-20 grid gap-20 sm:grid-cols-2">
                  {(["top", "rising"] as const).map((kind) => (
                    <div key={kind}>
                      <h4 className="text-body-sm font-w540 text-ink-charcoal">
                        {kind === "top" ? "Terpopuler" : "Makin populer"}
                      </h4>
                      <ul className="mt-8 grid gap-8">
                        {item.digest[kind].length ? (
                          item.digest[kind].map((row) => (
                            <li
                              key={row.query}
                              className="flex items-baseline justify-between gap-12 text-body-sm"
                            >
                              <span className="min-w-0 break-words">
                                {row.query}
                              </span>
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
                          ))
                        ) : (
                          <li className="text-body-sm text-stone-gray">
                            Belum cukup data.
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-20 flex flex-wrap items-center justify-between gap-12 border-t border-soft-mist pt-12">
                  <Link
                    href={radarHref(item, state)}
                    className="inline-flex min-h-button items-center text-body-sm text-royal-violet underline focus-visible:outline-2 focus-visible:outline-royal-violet"
                  >
                    Lihat Trend Radar
                  </Link>
                  {!item.readAt ? (
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void markRead(item.id)}
                    >
                      Tandai dibaca
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))
          )}
          {cursor ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const next = await api<{
                    items: InboxItem[];
                    nextCursor: string | null;
                  }>(`/api/v1/notifications?before=${cursor}`);
                  setItems((current) => [...current, ...next.items]);
                  setCursor(next.nextCursor);
                })
              }
            >
              Muat lainnya
            </Button>
          ) : null}
        </section>
        <aside
          aria-label="Pengaturan notifikasi"
          className="grid min-w-0 gap-16"
        >
          <Card className="p-20 sm:p-24">
            <h2 className="text-subheading text-ink-charcoal">Pengaturan</h2>
            <form
              onSubmit={(event) => void save(event)}
              className="mt-20 grid gap-20"
            >
              <label className="flex min-h-button cursor-pointer items-center justify-between gap-16 text-body-sm font-w540">
                Ringkasan harian
                <input
                  type="checkbox"
                  className="size-20 accent-midnight-wine focus-visible:outline-2 focus-visible:outline-royal-violet"
                  checked={preferences.enabled}
                  onChange={(event) =>
                    setPreferences({
                      ...preferences,
                      enabled: event.target.checked,
                    })
                  }
                />
              </label>
              <Select
                id="notification-topic"
                label="Topik"
                value={preferences.queryKey}
                options={
                  state.options.length
                    ? state.options.map((option) => ({
                        value: option.key,
                        label: option.label,
                      }))
                    : [
                        {
                          value: "preferred",
                          label: "Lengkapi produk di profil",
                        },
                      ]
                }
                onChange={(event) =>
                  setPreferences({
                    ...preferences,
                    queryKey: event.target.value,
                  })
                }
              />
              <Select
                id="notification-period"
                label="Periode tren"
                value={preferences.period}
                options={Object.entries(periodLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
                onChange={(event) =>
                  setPreferences({
                    ...preferences,
                    period: event.target.value as Preferences["period"],
                  })
                }
              />
              <div className="grid gap-12 sm:grid-cols-2">
                <Input
                  id="notification-time"
                  label="Jam pengiriman"
                  type="time"
                  required
                  value={preferences.time}
                  onChange={(event) =>
                    setPreferences({ ...preferences, time: event.target.value })
                  }
                />
                <Select
                  id="notification-zone"
                  label="Zona waktu"
                  value={preferences.timezone}
                  options={[
                    { value: "Asia/Jakarta", label: "WIB" },
                    { value: "Asia/Makassar", label: "WITA" },
                    { value: "Asia/Jayapura", label: "WIT" },
                  ]}
                  onChange={(event) =>
                    setPreferences({
                      ...preferences,
                      timezone: event.target.value as Preferences["timezone"],
                    })
                  }
                />
              </div>
              {state.status === "PROFILE_CHANGED" ? (
                <p className="text-body-sm text-midnight-wine">
                  Profil berubah. Pilih topik dan aktifkan kembali ringkasan.
                </p>
              ) : state.status === "NO_DATA" ? (
                <p className="text-body-sm text-stone-gray">
                  Data tren belum cukup. Kami periksa kembali pada jadwal
                  berikutnya.
                </p>
              ) : state.status === "RETRY" || state.status === "UNAVAILABLE" ? (
                <p className="text-body-sm text-stone-gray">
                  Ringkasan tertunda. Kami akan mencoba kembali pada jadwal
                  berikutnya.
                </p>
              ) : null}
              <Button
                type="submit"
                loading={saving}
                loadingText="Menyimpan…"
                disabled={
                  busy || (!state.options.length && preferences.enabled)
                }
              >
                Simpan pengaturan
              </Button>
            </form>
          </Card>
          <Card className="bg-lilac-mist/20 p-20 sm:p-24">
            <h2 className="text-label-bold text-ink-charcoal">
              Notifikasi perangkat
            </h2>
            <p className="mt-8 text-body-sm text-stone-gray">
              Terima pemberitahuan saat website tidak terbuka.
            </p>
            <p className="mt-12 text-caption text-stone-gray">
              {!pushSupported
                ? pushHint
                : !state.pushAvailable
                  ? "Notifikasi perangkat sedang disiapkan."
                  : pushEnabled
                    ? "Aktif pada perangkat ini."
                    : "Memerlukan izin browser Anda."}
            </p>
            <div className="mt-16 grid gap-8">
              <Button
                variant="secondary"
                loading={deviceBusy}
                loadingText={pushEnabled ? "Menonaktifkan…" : "Menghubungkan…"}
                disabled={
                  busy ||
                  !pushSupported ||
                  (!state.pushAvailable && !pushEnabled)
                }
                onClick={() => void togglePush()}
              >
                {pushEnabled ? "Nonaktifkan perangkat" : pushPrepared ? "Aktifkan perangkat" : "Siapkan perangkat"}
              </Button>
              {pushEnabled ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      const subscription = await currentPushSubscription();
                      if (!subscription)
                        throw new Error("Aktifkan kembali perangkat Anda.");
                      await api("/api/v1/notifications/push/test", "POST", {
                        endpoint: subscription.endpoint,
                      });
                      setNotice("Notifikasi uji dikirim ke perangkat ini.");
                    })
                  }
                >
                  Kirim notifikasi uji
                </Button>
              ) : null}
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
