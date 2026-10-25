# Billing Sandbox MVP

Amendemen produk ini menggantikan pengecualian payment gateway dan admin dashboard sebelumnya, khusus untuk MVP billing di bawah ini.

## Produk dan entitlement

| Produk | Harga | Kredit | Masa berlaku |
| --- | ---: | ---: | --- |
| Free trial | Rp0 | 5 | Sekali setelah onboarding; AI aktif sampai kredit trial habis |
| Premium | Rp84.000 | 25 | 30 hari |
| Pro | Rp146.000 | 50 | 30 hari |
| Top up 10 | Rp20.000 | 10 | Tidak kedaluwarsa |
| Top up 30 | Rp50.000 | 30 | Tidak kedaluwarsa |
| Top up 100 | Rp150.000 | 100 | Tidak kedaluwarsa |

Premium dan Pro hanya berbeda pada jatah kredit. Tarif aksi AI adalah Buat hipotesis 2 kredit dan Analisis mendalam 3 kredit. Trend Insight, local synthetic demo, serta roadmap deterministik tidak dipotong kredit.

Aksi AI berbayar membutuhkan paket Premium/Pro aktif atau kredit Free trial yang tersisa. Ketika paket berakhir, akun kembali ke Free dan aksi berbayar terkunci, meski kredit top up masih tersisa. Sistem memakai lot yang akan kedaluwarsa paling awal terlebih dahulu.

Setelah paket berbayar yang pernah aktif berakhir tanpa paket pengganti yang sudah aktif, setiap halaman aplikasi terproteksi mengarahkan pengguna ke `/billing`. `/billing` dan `/billing/return` tetap dapat dibuka untuk perpanjangan dan verifikasi pembayaran. Pengguna Free yang belum pernah memiliki paket berbayar tidak terkena pengalihan ini. Tab yang sedang terbuka mengalihkan ke billing setelah pembaruan status saat batas masa paket, event billing, atau fokus ulang. Akses halaman dipulihkan setelah callback pembayaran mengaktifkan paket baru; kredit top up yang tersisa tetap tersimpan.

Pembelian plan sebelum periode aktif berakhir dijadwalkan sesudah periode tersebut, kecuali paket yang sama dengan paket aktif: Premium aktif tidak dapat membeli Premium lagi dan Pro aktif tidak dapat membeli Pro lagi. UI menonaktifkan tombolnya; checkout server juga menolak sebelum membuat order. Upgrade Premium ke Pro terjadi segera, tanpa prorata; sisa kredit plan Premium hangus dan top up tetap ada. Tidak ada auto-debit, refund, maupun perubahan finansial oleh admin.

## Integrasi Duitku

Provider adalah Duitku **sandbox** dengan model POP. Browser hanya mengirim `productCode`; harga, kredit, order ID, status, dan user pemilik semuanya ditentukan server.

- Checkout: server membuat `billing_payments` berstatus `PENDING`, lalu memanggil `https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry`. Pada MVP sandbox, channel `BC` (BCA Virtual Account) dipilih server-side dan pengguna menyelesaikan pembayaran pada halaman hosted Duitku. Channel Virtual Account harus aktif pada project merchant.
- Return page hanya memberi tahu bahwa pembayaran sedang diverifikasi; ia tidak mengubah status lokal.
- Callback: `POST /api/v1/billing/duitku/callback`, memakai HMAC-SHA256 pada `merchantCode + amount + merchantOrderId`, dibandingkan secara constant-time. Duplikasi dan callback terlambat aman terhadap idempotensi.
- Secret hanya disimpan pada environment server: `DUITKU_MERCHANT_CODE`, `DUITKU_API_KEY`, dan `APP_URL`.

## Akun, ledger, dan admin

`billing_accounts` menyimpan entitlement saat ini; `billing_payments` menyimpan order provider; `credit_lots` menyimpan saldo yang dapat dipakai; `credit_ledger_entries` adalah catatan append-only grant, reservation, release, debit, forfeit, dan expire; `billing_webhook_events` menjaga idempotensi callback.

Credit usage dicadangkan sebelum panggilan AI, diselesaikan setelah respons valid, dan dilepas jika aksi gagal. Admin memakai tabel `admins` dan sesi `ADMIN` terpisah, tetapi masuk melalui `/login` yang sama. Area `/admin` hanya dapat memantau transaksi, mengubah harga/jatah lima SKU tetap, serta mengubah biaya kredit dua aksi AI. Setiap perubahan konfigurasi diaudit; tidak ada refund, perubahan status pembayaran, atau rekonsiliasi manual.

Harga dan jatah kredit dikonfigurasi di database. Checkout menyimpan snapshot harga dan jatah kredit pada payment, sehingga invoice `PENDING`, callback, dan transaksi lama tidak berubah saat operator memperbarui pengaturan. Biaya aksi AI dapat bernilai 0–100; nilai 0 tidak memotong kredit tetapi tetap memerlukan entitlement aktif.

## Kontrak API

- `GET /api/v1/billing` — status paket dan saldo untuk pemilik sesi.
- `GET /api/v1/billing/events` — stream SSE privat untuk memberi tahu sesi pemilik ketika saldo atau entitlement berubah; browser mengambil ulang saldo dari `GET /api/v1/billing`.
- `POST /api/v1/billing/checkout` — `{ "productCode": "PREMIUM_30" | "PRO_30" | "CREDITS_10" | "CREDITS_30" | "CREDITS_100" }`; respons membawa URL POP. Same-origin dan rate limited. Paket yang sama dengan paket aktif ditolak dengan `409 PLAN_ALREADY_ACTIVE` tanpa invoice baru.
- `POST /api/v1/billing/duitku/callback` — endpoint provider, bukan endpoint browser.
- `GET /billing?payment=verifying` — URL kembali dari Duitku yang langsung menampilkan pemberitahuan verifikasi di halaman billing; tidak mengubah status finansial. URL lama `/billing/return` tetap mengarahkan ke alamat ini untuk invoice yang sudah terbit.

Ringkasan billing juga memuat tarif kedua aksi AI yang saat ini berlaku. UI memeriksa saldo dan tarif terkini sebelum mengirim aksi, menampilkan blok peringatan jika kredit kurang, serta tetap mengandalkan validasi kredit transaksional di server. Notifikasi perubahan saldo dikirim setelah transaksi berhasil; reconnect stream dan tab yang kembali aktif mengambil ulang ringkasan untuk memulihkan event yang terlewat.

## Verifikasi

Benar bila Duitku sandbox menerima create invoice dan callback bertanda tangan valid secara idempoten mengaktifkan entitlement/kredit tepat satu kali; database ledger dapat menjelaskan setiap perubahan saldo; dan test signature menolak amount/order/merchant yang dimodifikasi. Ini juga diuji terhadap OWASP ASVS V2 (authz), V4 (input), V8 (data integrity), V13 (API), dan V16 (secrets).
