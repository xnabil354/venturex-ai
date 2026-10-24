# Dokumentasi VENTUREX AI

Direktori ini memisahkan tiga jenis dokumen: kondisi implementasi saat ini, sumber requirement/desain, dan catatan operasional atau historis. Mulai dari [Current Implementation](Current%20Implementation.md) ketika ingin memahami apa yang benar-benar tersedia di codebase sekarang.

## Sumber utama

- [Current Implementation](Current%20Implementation.md) — snapshot route, modul, persistence, integrasi, dan batas implementasi aktual.
- [Product Requirement Document](VENTUREX_AI_PRD.md) — tujuan dan scope produk.
- [Functional Specification Document](VENTUREX_AI_FSD.md) — perilaku sistem yang disetujui.
- [API Design](API%20Design.md) — kontrak HTTP, termasuk proposal yang belum tentu memiliki route handler.
- [Database Design](Database%20Design.md) — desain logis dan aturan persistence.
- [Tech Stack Requirement](Tech%20Stack%20Requirement.md) — baseline teknologi dan engineering constraints.
- [Design system](../DESIGN.md) — aturan UI yang wajib diikuti.

Jika dokumen requirement dan implementasi berbeda, jangan diam-diam mengubah kontrak produk. Catat perbedaannya di Current Implementation, lalu lakukan change control pada PRD/FSD/API/Database Design sebelum mengubah perilaku.

## Konfigurasi fitur

- [Entrepreneur Profile Configuration](Entrepreneur%20Profile%20Configuration.md)
- [Business Profile Configuration](Business%20Profile%20Configuration.md)
- [Dashboard Foundation Configuration](Dashboard%20Foundation%20Configuration.md)
- [Trend Intelligence Configuration](Trend%20Intelligence%20Configuration.md)
- [Trend Evidence Provenance](Trend%20Evidence%20Provenance.md)
- [9Router Provider Configuration](9Router%20Provider%20Configuration.md)
- [Billing Sandbox MVP](Billing%20Sandbox%20MVP.md)
- [Trend Notifications](Trend%20Notifications.md)
- [Journey Reports](Journey%20Reports.md)
- [Local Synthetic AI Demo](Local%20Synthetic%20AI%20Demo.md)

## Opportunity Finder dan roadmap

- [Entrepreneur Deep Analysis](Entrepreneur%20Deep%20Analysis.md)
- [Entrepreneur MVP Completion](Entrepreneur%20MVP%20Completion.md)
- [Existing Business Completion](Existing%20Business%20Completion.md)
- [Opportunity Finder Entrepreneur Score Detail](Opportunity%20Finder%20Entrepreneur%20Score%20Detail.md)
- [Opportunity Finder Personalization Evaluation](Opportunity%20Finder%20Personalization%20Evaluation.md)
- [Opportunity Finder Readability Review](Opportunity%20Finder%20Readability%20Review.md)

## Catatan verifikasi dan insiden

Dokumen berikut adalah bukti historis atau runbook sempit. Dokumen ini tidak menggantikan snapshot implementasi atau kontrak utama:

- [Opportunity Finder Schema Incident — 20 October 2026](Opportunity%20Finder%20Schema%20Incident%202026-10-20.md)
- [Opportunity Finder Timeout Smoke Test Plan](Opportunity%20Finder%20Timeout%20Smoke%20Test%20Plan.md)
- [Trend Radar Insufficient Data Fix](Trend%20Radar%20Insufficient%20Data%20Fix.md)
- [Release Verification — 22 October 2026](Release%20Verification%202026-10-22.md)
- [Opportunity Finder Codex Implementation Prompt](Opportunity%20Finder%20Codex%20Implementation%20Prompt.md)

## Artefak referensi

- [Business Requirement Document](VENTUREX_AI_BRD.md)
- `venturex-ai-pricing-report.html` dan `venturex-ai-pricing-report.pdf` — artefak laporan harga, bukan kontrak runtime.

## Aturan pemeliharaan

Saat codebase berubah:

1. perbarui `Current Implementation.md` untuk route, modul, migration, command, atau integrasi yang berubah;
2. perbarui dokumen feature terkait bila perilaku pengguna berubah;
3. perbarui API/Database Design jika kontrak HTTP atau persistence berubah;
4. perbarui PRD/FSD hanya melalui keputusan produk yang eksplisit; dan
5. pertahankan catatan insiden sebagai histori—jangan mengubahnya menjadi dokumentasi kondisi terkini.
