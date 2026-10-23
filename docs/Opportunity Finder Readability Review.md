# Opportunity Finder: bahasa dan keterbacaan

Revisi ini hanya memperbaiki bahasa generation dan tampilan bacaan hasil di Finder serta Saved Opportunities. Prompt v20 meminta kalimat pendek, aktif, hangat, santai, sopan, dan tetap menyapa Anda. Konsep diarahkan menjadi dua kalimat; penjelasan kecocokan membahas alasan tanpa mengulang daftar profil. Server juga menghindari pengulangan `label: nilai` ketika keduanya identik. Schema, referensi, grounding, consent, dan kontrak API/database tetap berlaku.

Tampilan memakai identitas DESIGN.md: kertas putih, parchment untuk rencana percobaan, wine untuk penomoran tindakan, tanpa animasi kartu dan shadow berlebihan. Konsep dibatasi lebar bacanya dan line-height diperlonggar. Alasan kecocokan dan petunjuk pencarian memakai dua kolom di desktop, satu kolom di ponsel. Asumsi, informasi yang belum tersedia, keterbatasan, serta sumber tetap lengkap melalui disclosure native. Penanda ide awal dan keterangan rencana percobaan tetap terlihat sebelum detail dibuka.

Hipotesis tersimpan lama mendapatkan layout baru tanpa diubah isinya. Gaya bahasa v20 berlaku untuk generation berikutnya; tidak ada regenerasi otomatis, migrasi, atau perubahan data pengguna.

## Verifikasi

- **182 tes offline lulus, 0 gagal**, dua tes live dilewati pada perintah offline. Cakupan: adapter, context, katalog fakta, materialisasi, grounding, route, halaman Finder/Saved, state timeout/simpan, disclosure, dan data lama tanpa field opsional. Laporan: `artifacts/opportunity-readability-offline.json`.
- **Dua tes provider live lulus**, masing-masing tepat satu panggilan model untuk profil sintetis ENTREPRENEUR dan UMKM_EXISTING. Schema/materialisasi/grounding mencapai mock repository. Laporan: `artifacts/opportunity-readable-prompt-live.json`. Ini bukan pengujian penyimpanan database atau sesi akun pengguna, dan bukan pengukuran kualitas bahasa oleh pengguna nyata.
- **TypeScript dan ESLint lulus** pada file yang disentuh.
- **Preview browser desktop 1440 px dan ponsel 390 px lulus**: tidak ada overflow saat detail tertutup maupun terbuka; disclosure bisa dibuka/ditutup dengan Enter; tinggi target disclosure 48 px. Preview memakai markup komponen Finder yang sebenarnya dan CSS Tailwind proyek, dengan fixture sintetis. Ini bukan halaman akun terautentikasi yang di-hydrate; perilaku fetch/simpan dicakup oleh pengujian komponen.
- Pemeriksaan visual mengoreksi utility `min-h-44` yang menjadi 176 px pada token spacing proyek. Disclosure baru memakai token `min-h-button` (48 px). Konfirmasi ulang tidak menunjukkan ruang kosong tersebut.
- Detector Impeccable pada dua komponen hasil tidak memberi temuan. React review: komponen bacaan tidak menambah state/effect/fetch; disclosure memakai native browser, data lama tetap ditangani, dan teks dirender sebagai teks React tanpa HTML mentah.

## Bukti visual

- Desktop: `artifacts/hypothesis-readability-desktop.png`
- Ponsel: `artifacts/hypothesis-readability-mobile.png`
- Detail terbuka: `artifacts/hypothesis-readability-desktop-expanded.png`, `artifacts/hypothesis-readability-mobile-expanded.png`
- Pengukuran browser: `artifacts/hypothesis-readability-browser.json`

Hasil ini membuktikan skenario yang diuji. Kepatuhan setiap respons model berikutnya dan penilaian kenyamanan oleh pengguna nyata tetap perlu diamati; tidak ada klaim bebas bug secara mutlak.
