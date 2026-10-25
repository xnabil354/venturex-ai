# Current Implementation

**Snapshot:** 24 October 2026  
**Basis:** source code, route handlers, migrations, package manifest, environment template, dan automated tests pada repository ini.

Dokumen ini menjelaskan kondisi implementasi, bukan menggantikan PRD atau FSD. Dokumen desain besar masih memuat target dan proposal. Sebuah endpoint dianggap tersedia hanya bila terdapat route handler di `src/app/api`; sebuah tabel dianggap aktif bila dibuat oleh migration di `db/migrations`.

## Ringkasan produk yang tersedia

VENTUREX AI saat ini adalah modular monolith Next.js untuk dua persona:

- `ENTREPRENEUR`: Discover → Analyze → Start;
- `UMKM_EXISTING`: Discover → Analyze → Grow.

Fitur yang sudah memiliki implementasi meliputi:

- registrasi, login Auth.js, session, onboarding, dan pergantian persona dengan histori terpisah;
- profil calon pengusaha dan profil usaha existing;
- dashboard berbasis persona;
- curated Trend catalogue dan Trend Radar berbasis SearchApi;
- preview/live trend signal yang dikunci konfigurasi;
- Opportunity Finder publik dan hipotesis privat berbasis profil;
- Opportunity Score, Fit Score, risk assessment, evidence, save, archive, dan compare;
- analisis mendalam serta roadmap Startup/Growth;
- laporan perjalanan PDF/XLSX setelah seluruh tahap roadmap dinyatakan selesai;
- billing sandbox Duitku, entitlement, credit lots, ledger, dan admin monitoring;
- inbox notifikasi tren mingguan dan Web Push opsional; dan
- workflow import, provenance, review, validation, dan publication untuk curated catalogue.

## Arsitektur runtime

```text
Browser
  ├─ React client components
  └─ Next.js server-rendered pages
            │
            ▼
Next.js App Router
  ├─ Server Components
  ├─ Route Handlers
  └─ Auth.js session boundary
            │
            ▼
Application services
  ├─ auth / profile / dashboard
  ├─ trend / opportunity / scoring / roadmap
  ├─ billing / notifications / reports
  └─ AI analysis and guarded provider adapters
            │
            ▼
Repositories → Sequelize 6 → PostgreSQL 18
```

Code dibagi berdasarkan domain di bawah `src/`. Route/page hanya mengorkestrasi autentikasi, validasi, service, dan presentasi; query persistence berada pada repository atau service server-only. Secret provider tidak dikirim ke browser.

## Halaman aplikasi

| Area | Route utama | Catatan |
| --- | --- | --- |
| Public/auth | `/`, `/login`, `/register` | Landing page dan autentikasi |
| Onboarding | `/onboarding`, `/onboarding/entrepreneur`, `/onboarding/business` | Pemilihan persona dan profile setup |
| Account | `/dashboard`, `/profile`, `/billing`, `/notifications` | Memerlukan session; sebagian fitur memerlukan onboarding selesai |
| Trends | `/trends`, `/trends/[id]` | Curated catalogue dan Radar exploration |
| Opportunities | `/opportunities`, `/opportunities/[id]` | Catalog opportunity dan private generation flow |
| Private hypotheses | `/opportunities/hypotheses/[id]` | Detail, analisis, score, evidence, dan tindakan owner-scoped |
| Compare | `/opportunities/compare` | Perbandingan item yang tetap diperiksa ownership-nya di server |
| Saved | `/saved`, `/saved-opportunities` | Arsip hipotesis privat dan saved catalog opportunities |
| Roadmaps/reports | `/roadmaps`, `/roadmaps/[roadmapId]`, private roadmap route | Startup/Growth journey dan completion state |
| Admin | `/admin/dashboard`, `/admin/pricing`, `/admin/transactions`, `/admin/usage` | Session `ADMIN` terpisah secara otorisasi |
| Local demo | `/local-demo/ai-analysis` | Hanya untuk konfigurasi demo lokal yang eksplisit |

`/admin-panel-prototype` adalah halaman prototipe internal dan bukan kontrak produk utama.

## API yang benar-benar memiliki route handler

Semua product API menggunakan namespace `/api/v1`, kecuali Auth.js dan dua endpoint demo lokal.

### Identity dan profile

| Method | Path |
| --- | --- |
| `GET`, `POST` | `/api/auth/[...nextauth]` |
| `POST` | `/api/v1/auth/register` |
| `GET` | `/api/v1/me` |
| `PATCH` | `/api/v1/me/user-type` |
| `POST` | `/api/v1/me/user-type/switch` |
| `PUT` | `/api/v1/profile/entrepreneur` |
| `PUT` | `/api/v1/profile/business` |
| `GET` | `/api/v1/reference/fnb-categories` |
| `GET` | `/api/v1/reference/customer-segments` |
| `GET` | `/api/v1/reference/sales-channels` |

### Trend Radar dan live signals

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/trend-radar/geographies` |
| `POST` | `/api/v1/trend-radar/related-queries` |
| `POST` | `/api/v1/trend-radar/interest` |
| `POST` | `/api/v1/trends/live-signals/refresh` |
| `POST` | `/api/v1/trends/live-signals/analysis` |

Curated `/trends` pages memakai server-side services. Proposal REST seperti `GET /api/v1/trends` di API Design belum memiliki route handler dan tidak boleh didokumentasikan sebagai endpoint runtime.

### Opportunities, scoring, save, compare, dan roadmap

| Method | Path |
| --- | --- |
| `GET`, `POST`, `PATCH`, `DELETE` | `/api/v1/opportunities/ideas` |
| `POST` | `/api/v1/opportunities/signals` |
| `POST` | `/api/v1/opportunities/ideas/[id]/analysis` |
| `POST` | `/api/v1/opportunities/ideas/[id]/roadmap` |
| `POST` | `/api/v1/opportunities/[id]/analysis` |
| `GET` | `/api/v1/opportunities/[id]/analysis/latest` |
| `GET` | `/api/v1/opportunities/[id]/fit-score` |
| `POST` | `/api/v1/opportunities/compare` |
| `GET` | `/api/v1/saved-opportunities` |
| `POST`, `DELETE` | `/api/v1/saved-opportunities/[opportunityId]` |
| `GET`, `POST` | `/api/v1/roadmaps` |
| `GET` | `/api/v1/roadmaps/[roadmapId]` |

Private generated hypotheses dan curated catalog opportunities adalah dua jalur data berbeda. Ownership, persona, saved state, evidence freshness, dan consent diperiksa di server sebelum analisis atau roadmap dibuat.

### Billing dan admin

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/billing` |
| `POST` | `/api/v1/billing/checkout` |
| `POST` | `/api/v1/billing/duitku/callback` |
| `GET` | `/api/v1/admin/transactions` |
| `GET` | `/api/v1/admin/billing/settings` |
| `PATCH` | `/api/v1/admin/billing/products/[productCode]` |
| `PATCH` | `/api/v1/admin/billing/usage/[usageKind]` |

Billing memakai Duitku sandbox. Browser hanya memilih product code; nominal, kredit, signature, ownership, dan status pembayaran ditentukan server.

### Notifications dan reports

| Method | Path |
| --- | --- |
| `GET` | `/api/v1/notifications` |
| `GET`, `PATCH` | `/api/v1/notifications/preferences` |
| `POST`, `DELETE` | `/api/v1/notifications/push` |
| `GET` | `/api/v1/notifications/push/context` |
| `GET` | `/api/v1/reports/journeys` |
| `GET` | `/api/v1/reports/journeys/[id]` |
| `GET`, `PATCH` | `/api/v1/reports/journeys/[id]/progress` |

Notifikasi saat ini memiliki satu preferensi: `enabled`. Category, scope, dan schedule dimiliki server: Food & Drink, Worldwide, setiap Senin pukul 12.00 WIB. Tidak ada endpoint mark-read atau push-test pada implementasi sekarang.

### Local-only endpoints

| Method | Path | Batas |
| --- | --- | --- |
| `POST` | `/api/local/synthetic-ai-demo` | Hanya setelah seluruh demo gate aktif |
| `POST` | `/api/local/trend-source-preview` | Preview sumber yang dibatasi konfigurasi lokal |

## Persistence dan migration

Migration aktif berurutan dari `001` sampai `027`. Kelompok persistence saat ini:

- identity/profile/reference: users, entrepreneur/business profiles, products, junctions, dan reference data;
- trends/catalogue: trends, trend evidence, dan provenance;
- opportunities/scoring: opportunities, evidence, saved opportunities, scoring models, analysis snapshots, fit inputs, dan private generated opportunities;
- roadmap/reports: roadmaps, roadmap steps, serta `journey_roadmap_progress`;
- notifications: preferences, weekly trend notifications, push subscriptions, dan push-delivery outbox;
- billing/admin: accounts, payments, credit lots, append-only credit ledger, webhook events, product/usage settings, admins, dan audit logs; dan
- persona history: migration `027` memisahkan histori sesuai persona.

Migration `026` mereset kontrak notifikasi lama dan menggantinya dengan digest Food & Drink mingguan. Dokumentasi atau data fixture yang masih memakai jadwal harian, topik profil, `read_at`, atau push-test adalah historis.

## Integrasi eksternal

| Integrasi | Penggunaan | Default |
| --- | --- | --- |
| SearchApi Google Trends | Related queries, interest, geography, evidence Opportunity Finder, weekly digest | Nonaktif tanpa env dan feature flag |
| Bright Data | Trending-now candidate preview/curation dan demo source preview | Nonaktif |
| 9Router | Structured AI analysis melalui OpenAI-compatible transport | Nonaktif tanpa provider config dan consent/gate terkait |
| Duitku sandbox | Checkout dan callback pembayaran | Memerlukan merchant config server-side |
| Web Push | Delivery tambahan untuk weekly digest | Opsional; inbox tetap dapat digunakan |

Provider data selalu diperlakukan sebagai evidence terbatas. Search interest bukan penjualan, market size, revenue, profit, atau jaminan permintaan.

## Security dan reliability yang diterapkan

- password menggunakan Argon2id;
- Auth.js session dan server-side ownership checks;
- request mutation memakai same-origin checks dan bounded JSON bodies;
- schema validation menggunakan Zod strict pada boundary penting;
- private responses memakai `private, no-store`;
- provider URL, model, timeout, concurrency, response size, dan explicit opt-in dibatasi;
- SQL value menggunakan replacements/bind parameters;
- billing callback diverifikasi secara constant-time dan idempoten;
- credit ledger append-only serta reservation/release untuk panggilan AI;
- notification worker memakai PostgreSQL advisory lease, row locking, retry terbatas, dan durable push outbox; dan
- report download memeriksa owner, analysis/roadmap fingerprint, serta completion gate kembali di server.

## Proses background dan command operasional

Deployment VPS `venturex.web.id` memakai `compose.yaml`, dijalankan dengan
`./deploy/compose` atau `docker compose --env-file .env.production`.
`compose.production.yaml` hanya dipertahankan untuk kompatibilitas perintah lama.
Pengaturan HTTPS AI, host gateway, subnet privat dan rotasi log ada di file utama,
sehingga tidak hilang ketika app dibuat ulang tanpa file tambahan. Next.js dan
notification worker berada dalam container aplikasi; PostgreSQL memakai volume
persisten. Nginx host meneruskan HTTPS ke `127.0.0.1:3000`. 9Router berjalan
langsung melalui systemd, dengan restart otomatis dan timer pemeriksaan HTTP.
Transport AI dari container memakai HTTPS Nginx pada `/v1/`, dibatasi ke jaringan
Docker dan loopback. Runbook dan batas verifikasi ada di `deploy/README.txt`.
Mutasi progres laporan dan notifikasi memvalidasi origin terhadap `APP_URL`
publik agar hostname internal Next.js di dalam container tidak menyebabkan 403.
`./deploy/verify-ai` memeriksa konfigurasi HTTPS, resolusi host, keterjangkauan
gateway dan keberadaan model dari dalam container tanpa melakukan inferensi.
Adapter AI bersama mencatat metadata aman bila pemanggil tidak memasang logger
khusus; deadline aplikasi dibedakan dari client abort. Analisis detail Entrepreneur
yang dibatalkan tidak disimpan sebagai snapshot parsial baru.

| Command | Fungsi |
| --- | --- |
| `pnpm dev` | Menjalankan Next.js dan notification worker terkoordinasi |
| `pnpm start` | Menjalankan production server dan notification worker terkoordinasi |
| `pnpm notifications:setup` | Membuat VAPID key lokal pada file ignored |
| `pnpm notifications:worker` | Menjalankan scheduler/push worker secara terpisah |
| `pnpm trend:preview` | Preview kandidat Bright Data/offline fixture |
| `pnpm trend:curate` | Menyiapkan candidate curation |
| `pnpm catalog:import` | Preview/import curated catalogue dengan confirmation gates |
| `pnpm catalog:lifecycle` | Review, validate, dan publish catalogue secara audited |
| `pnpm db:migrate` | Menjalankan migration Umzug |
| `pnpm db:seed:reference` | Mengisi reference data |
| `pnpm test:e2e` | Menjalankan browser E2E harness |

## Batas implementasi yang perlu dibaca dengan benar

- API Design memuat endpoint proposal. Gunakan daftar route handler di dokumen ini untuk status runtime.
- Curated catalogue tidak otomatis diisi dari provider live. Import dimulai sebagai `DRAFT` dan harus melewati factual review serta publication approval.
- AI tidak menghitung core score. Score deterministik berasal dari policy/server dan menyatakan insufficient data bila input tidak memadai.
- Local demo dan public HTTP provider transport bukan jalur produksi normal.
- Notification delivery remote bersifat best effort; inbox adalah sumber state aplikasi.
- Completion roadmap adalah deklarasi pengguna, bukan bukti keberhasilan bisnis.
- Billing adalah sandbox dan tidak menyediakan refund, auto-debit, atau perubahan status finansial manual oleh admin.

## Menjaga snapshot ini tetap sinkron

Perbarui dokumen ini ketika salah satu hal berikut berubah: route handler, page route, domain module, migration, package/runtime baseline, environment contract, worker, atau external integration. PRD/FSD harus diperbarui terpisah bila perubahan tersebut juga mengubah requirement produk.
