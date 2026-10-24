# Weekly Trend Notifications

**Implementation status:** active

**Current contract:** migration `026-rebuild-weekly-food-drink-notifications.ts`

**Supersedes:** the configurable daily digest contract introduced by migration 021.

VENTUREX menyediakan inbox tren mingguan untuk pengguna `ENTREPRENEUR` dan `UMKM_EXISTING` yang sudah menyelesaikan onboarding. Web Push adalah kanal tambahan yang opsional; inbox tetap berfungsi tanpa permission browser.

## Product contract

- Pengguna hanya dapat mengaktifkan atau menonaktifkan notifikasi.
- Category dimiliki server dan selalu `Food & Drink`.
- Scope dimiliki server dan selalu `Worldwide`.
- Jadwal dimiliki server: setiap Senin pukul 12.00 WIB.
- Digest memakai data Google Trends bulan berjalan, dari tanggal 1 sampai hari pengambilan dalam timezone Asia/Jakarta.
- Maksimum tiga Top dan tiga Rising query yang usable disimpan.
- Interest penelusuran bukan bukti penjualan, market size, revenue, profit, atau permintaan komersial.
- Tidak ada generated substitute term ketika provider tidak menghasilkan data usable.
- Completion, score, opportunity, analysis, atau roadmap tidak dibuat otomatis dari notifikasi.

Konfigurasi topik profil, pilihan timezone/jam/periode, unread state, mark-read, dan push-test adalah bagian kontrak historis dan tidak tersedia pada implementasi sekarang.

## Schedule dan retry

`nextWeeklyRun()` menghitung Senin berikutnya pukul 12.00 WIB. Worker hanya menerbitkan digest bila tick terjadi pada hari Senin setelah jam tersebut. Job yang terlambat ke hari lain tidak diputar ulang; schedule langsung dimajukan ke minggu berikutnya.

Untuk setiap pengguna dan `week_start` hanya boleh ada satu notification. Source failure dicoba maksimal tiga kali dengan jarak lima menit. Setelah batas tercapai, status menjadi `UNAVAILABLE` dan schedule maju ke minggu berikutnya. Provider response tanpa Top/Rising usable menghasilkan status `NO_DATA`, bukan notification palsu.

## Data source dan filtering

Worker menggunakan adapter SearchApi Google Trends melalui `foodAndDrinkRelatedQueries()` dengan request month-to-date:

```text
period: custom-date
startDate: YYYY-MM-01
endDate: hari ini di Asia/Jakarta
geo: worldwide
property: web
```

Row dinormalisasi dan dideduplikasi case-insensitively. Query kosong, terlalu panjang, duplikat, atau yang cocok dengan bounded harmful/adult term filter dibuang. Filter ini bukan klaim moderasi semantik lengkap.

## Persistence

Tabel aktif:

- `notification_preferences` — toggle, next run, attempt count, dan safe operational status;
- `trend_notifications` — immutable weekly digest JSONB, owner, `week_start`, dan creation time;
- `push_subscriptions` — endpoint dan key per perangkat, maksimum lima perangkat per user; dan
- `notification_push_deliveries` — durable outbox per notification/subscription.

Migration 026 menghapus data preferensi/subscription/digest lama sebelum mengubah schema. Legacy `settings`, `topic_query`, `local_date`, `read_at`, dan `last_test_at` tidak lagi tersedia.

## API

Semua endpoint memerlukan session, onboarding selesai, persona valid, dan menghasilkan response private/no-store.

| Method | Path | Contract |
| --- | --- | --- |
| `GET` | `/api/v1/notifications` | Inbox 20 item dengan cursor UUID `before` |
| `GET` | `/api/v1/notifications/preferences` | Toggle, status, server-owned category/scope/schedule, push capability |
| `PATCH` | `/api/v1/notifications/preferences` | Strict `{ "enabled": boolean }` |
| `POST` | `/api/v1/notifications/push` | Registrasi subscription perangkat yang tervalidasi |
| `DELETE` | `/api/v1/notifications/push` | Hapus endpoint milik current user |
| `GET` | `/api/v1/notifications/push/context` | `userId` untuk account isolation di service worker |

Mutations memerlukan exact same-origin dan body JSON maksimum 8192 byte. Endpoint push hanya menerima HTTPS host yang di-allowlist untuk FCM, Mozilla, Apple, atau Windows Push. Private subscription keys tidak pernah dikembalikan oleh list API.

## Web Push behavior

- Web Push membutuhkan VAPID config, secure context, service worker, dan permission eksplisit pengguna.
- Menonaktifkan preference menghapus seluruh subscription perangkat milik user dalam transaksi yang sama.
- Endpoint tidak boleh dimiliki akun lain dan setiap user dibatasi lima perangkat.
- Push delivery hanya berlaku untuk notification yang masih berumur maksimum delapan hari.
- Status HTTP 404/410 dari push service menghapus subscription yang invalid.
- Kegagalan lain dicoba maksimal tiga kali dengan jarak lima menit.
- Remote push bersifat at-least-once/best effort; exactly-once delivery tidak diklaim.

## Worker operations

```bash
pnpm notifications:setup
pnpm notifications:worker
```

`notifications:setup` membuat VAPID key lokal pada `.notifications-vapid.json` yang diabaikan Git. Worker memuat `.env` dan file key tersebut, mengambil PostgreSQL advisory lock khusus, lalu memproses tick setiap menit. Hanya satu worker per database menjadi leader; worker lain berada pada status standby.

`pnpm dev` dan `pnpm start` menjalankan Next.js bersama worker melalui `scripts/notifications/run-app.mjs`. Deployment yang menjalankan Next secara langsung harus mengawasi `pnpm notifications:worker` sebagai proses terpisah.

## Required environment

```text
DATABASE_URL
TREND_RADAR_SEARCHAPI_ENABLED=true
SEARCHAPI_API_KEY
WEB_PUSH_PUBLIC_KEY       # opsional untuk inbox-only
WEB_PUSH_PRIVATE_KEY      # opsional untuk inbox-only
WEB_PUSH_SUBJECT          # mailto: atau HTTPS URL
```

## Verification

Minimal verification harus mencakup:

- perhitungan Senin 12.00 WIB dan month-to-date boundaries;
- satu digest per user/week dan skip missed-day replay;
- source empty, retry, dan unavailable state;
- ownership serta cursor pagination;
- strict preference body dan same-origin mutation;
- device cap, cross-account endpoint rejection, dan unsubscribe;
- push 404/410 cleanup, retry outbox, serta stale delivery; dan
- leader election ketika lebih dari satu worker aktif.

Physical-device delivery pada iOS/Android/desktop tetap harus dilaporkan sebagai `NOT RUN` sampai benar-benar diuji pada HTTPS deployment dan perangkat nyata.
