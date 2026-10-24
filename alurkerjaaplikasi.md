# Alur Kerja Aplikasi — VENTUREX AI

Dokumen ini menjelaskan bagaimana komponen aplikasi bekerja dari permintaan pengguna hingga data/presentasi dikembalikan. Cakupan utamanya adalah aplikasi pengguna; alur administrasi tidak ditampilkan.

## 1. Siklus permintaan aplikasi

```mermaid
flowchart TD
    browser[Browser: React client components] --> page[Next.js App Router]
    page --> pageKind{Jenis permintaan?}

    pageKind -- Halaman baca --> serverPage[Server Component / page service]
    pageKind -- Aksi / mutasi --> route[Route Handler /api/v1]
    pageKind -- Autentikasi --> authRoute[Auth.js /api/auth]

    authRoute --> authService[Auth service: verifikasi Argon2id]
    authService --> session{Kredensial valid?}
    session -- Tidak --> authError[Respons autentikasi generik]
    session -- Ya --> cookie[Secure HttpOnly session cookie]
    cookie --> browser

    serverPage --> sessionCheck{Halaman protected?}
    route --> sessionCheck
    sessionCheck -- Ya --> auth[Auth.js: baca sesi]
    auth --> allowed{Sesi, persona, dan ownership valid?}
    allowed -- Tidak --> denied[401 / 403 atau redirect onboarding]
    allowed -- Ya --> validation
    sessionCheck -- Tidak --> validation[Validasi input/boundary]
    route --> validation
    validation --> valid{Schema, same-origin, dan batas body valid?}
    valid -- Tidak --> badRequest[400 / pesan validasi]
    valid -- Ya --> service[Application service sesuai domain]
    serverPage --> service
    service --> repository[Repository]
    repository --> orm[Sequelize 6]
    orm --> db[(PostgreSQL 18)]
    db --> service
    service --> response[DTO / page model / respons private no-store bila data pribadi]
    response --> page
    page --> browser
```

## 2. Kerja fitur Discover: katalog tren dan Opportunity Finder

```mermaid
flowchart TD
    user[Pengguna onboarding lengkap] --> dashboard[Dashboard]
    dashboard --> trends[Halaman Trends]
    dashboard --> finder[Halaman Opportunities]

    trends --> trendMode{Kebutuhan pengguna}
    trendMode -- Katalog terkurasi --> trendService[TrendService server-side]
    trendService --> trendRepo[Repository tren dan evidence]
    trendRepo --> db[(PostgreSQL: trends, trend_evidences, provenance)]
    db --> trendView[Daftar/detail tren dan evidence]

    trendMode -- Eksplorasi Radar --> radarValidation[Validasi geografi dan konteks]
    radarValidation --> radarEnabled{SearchApi dan feature flag aktif?}
    radarEnabled -- Ya --> searchApi[SearchApi Google Trends]
    searchApi --> radarResult[Related queries / interest / geografi sementara]
    radarEnabled -- Tidak atau gagal --> radarFallback[State unavailable / data tersimpan tetap dapat dibaca]
    radarResult --> trendView

    finder --> profileContext[Ambil profil sesuai persona]
    profileContext --> finderService[Opportunity service]
    finderService --> hypotheses[(PostgreSQL: hipotesis privat / arsip)]
    finderService --> signalRequest{Perlu sinyal atau evidence eksternal?}
    signalRequest -- Ya, tersedia --> searchApi
    signalRequest -- Tidak / gagal --> localData[Gunakan data structured yang tersedia; jangan membuat fakta]
    hypotheses --> candidate[Hipotesis dan opportunity card]
    radarResult --> candidate
    localData --> candidate
    candidate --> detail[Detail: konsep, skor, Fit, risiko, kompetisi, evidence, batasan]
```

## 3. Kerja analisis, scoring, simpan, roadmap, dan laporan

```mermaid
flowchart TD
    detail[Detail opportunity / hipotesis] --> action{Aksi pengguna}

    action -- Simpan --> saveCheck[Periksa sesi dan ownership]
    saveCheck --> saved[(Simpan relasi atau state hipotesis di PostgreSQL)]
    saved --> savedView[Arsip Saved]

    action -- Analisis mendalam --> consent[Consent eksplisit]
    consent --> analysisGuard[Validasi persona, ownership, body, entitlement/kredit, dan batas provider]
    analysisGuard --> analysisInput[Gabungkan profil, hipotesis, evidence, histori, dan sampel yang dibatasi]
    analysisInput --> provider{Provider AI tersedia?}
    provider -- Ya --> ai[9Router / provider AI via adapter terjaga]
    ai --> qualitative[Output kualitatif terstruktur]
    provider -- Tidak / gagal --> partial[Hasil parsial atau pesan gagal; data structured tetap tampil]
    qualitative --> scoring[Server menghitung Opportunity Score, Fit Score, cakupan, dan risiko secara deterministik]
    scoring --> snapshot[(Simpan snapshot analisis versioned di PostgreSQL)]
    snapshot --> detail
    partial --> detail

    action -- Bandingkan --> selection[Ambil 2–3 item terpilih]
    selection --> compareGuard[Validasi ownership, persona, analisis, dan kelayakan]
    compareGuard --> compare[Matrix perbandingan tanpa pemenang otomatis]

    action -- Buat roadmap --> roadmapGuard{Tersimpan, dianalisis, eligible, dan milik pengguna?}
    roadmapGuard -- Tidak --> ineligible[409 / arahan melengkapi syarat]
    roadmapGuard -- Ya --> roadmapGenerator[Generator roadmap deterministik dan idempoten]
    roadmapGenerator --> roadmap[(Roadmap dan metadata tersimpan)]
    roadmap --> progress[Pengguna mengubah progres tahap]
    progress --> progressStore[(journey_roadmap_progress)]
    progressStore --> complete{Semua tahap selesai?}
    complete -- Belum --> roadmap
    complete -- Ya --> reportGuard[Server memeriksa owner, fingerprint, analisis, dan completion]
    reportGuard --> export[Generate PDFKit PDF atau ExcelJS XLSX]
    export --> download[Unduhan laporan privat]
```

## 4. Billing, notifikasi, dan proses latar

```mermaid
flowchart TD
    aiAction[Aksi AI berbayar] --> billingCheck[Billing service memeriksa entitlement dan kredit]
    billingCheck --> entitlement{Paket aktif atau kredit trial tersedia?}
    entitlement -- Ya --> reserve[Cadangkan kredit di ledger]
    reserve --> invokeAI[Panggil alur analisis / generasi]
    invokeAI --> settle{Respons valid?}
    settle -- Ya --> debit[Debit kredit append-only]
    settle -- Tidak --> release[Lepaskan reservasi kredit]
    entitlement -- Tidak --> billingPage[Halaman Billing]
    billingPage --> checkout[Browser mengirim productCode]
    checkout --> checkoutService[Server menentukan harga, kredit, order, dan pemilik]
    checkoutService --> duitku[Duitku sandbox POP]
    duitku --> returnPage[Halaman return: status masih diverifikasi]
    duitku --> callback[Callback HMAC ke server]
    callback --> paymentStore[(Payment, credit lots, dan ledger)]
    paymentStore --> billingCheck

    worker[Notification worker setiap menit] --> lease[Ambil PostgreSQL advisory lease]
    lease --> schedule{Senin ≥ 12.00 WIB dan preferensi aktif?}
    schedule -- Tidak --> worker
    schedule -- Ya --> digestSource[SearchApi: Food & Drink Worldwide, month-to-date]
    digestSource --> digestResult{Data usable?}
    digestResult -- Ya --> notificationStore[(Simpan weekly digest dan inbox)]
    digestResult -- Tidak / gagal --> retry[Retry terbatas atau status NO_DATA / UNAVAILABLE]
    notificationStore --> push{Perangkat Web Push terdaftar?}
    push -- Ya --> outbox[(Push-delivery outbox)] --> pushProvider[Push service]
    push -- Tidak --> inbox[Inbox tetap dapat diakses aplikasi]
    pushProvider --> inbox
```

## Batas penting

- Browser tidak menerima secret provider, harga authoritative, ownership decision, atau perhitungan core score.
- Katalog tren terkurasi memakai layanan internal dan PostgreSQL; hasil Radar dari provider bersifat sementara dan tidak otomatis menjadi katalog.
- Provider eksternal bersifat opsional dan gagal secara graceful. Search interest bukan bukti penjualan, pendapatan, atau kepastian permintaan.
- Callback pembayaran adalah satu-satunya jalur yang menyelesaikan transaksi; halaman return tidak dapat mengubah status finansial.
- Notifikasi Web Push best effort; inbox aplikasi adalah sumber state notifikasi pengguna.
