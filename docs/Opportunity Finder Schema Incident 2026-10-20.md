# Diagnosis dan perbaikan schema Opportunity Finder

## Status akhir v19: kontrak output terstruktur

Insiden lanjutan `ai_b4be7dce-1f2e-4cdc-a5e8-3f26dfed8a0d` gagal `unrecognized_keys` pada root, meskipun upstream HTTP 200. Nama properti tambahan tidak tersedia dalam log. Perbaikan batas array v18 tidak menyelesaikan kepatuhan struktur secara menyeluruh: adapter sebelumnya menghasilkan teks biasa dan hanya memvalidasi schema sesudah respons diterima.

Perbaikan v19 mengirim schema Zod persona melalui strict `response_format.json_schema`, memakai envelope transport `{ result: ... }`, dan tetap memvalidasi envelope/hasil/referensi/grounding sebelum penyimpanan. Union bertag literal yang disjoint diterjemahkan dari `oneOf` ke `anyOf`. Envelope dilepas di adapter sehingga API dan penyimpanan tetap sama. Root diagnostic kini membaca tipe objek root dengan benar, bukan melaporkannya sebagai undefined hanya karena tidak ada field contract untuk root.

Probe kecil HTTP 200 dan pasangan uji live awal berhasil, tetapi pengujian lanjutan membuktikan gateway menerima schema lengkap tanpa selalu menegakkannya: narrative dan referensi objek dapat dikembalikan sebagai string. Karena itu schema generator yang SAMA juga disertakan di system message. Tes membuktikan equality schema system dengan response format. Ini panduan kompatibilitas tambahan, bukan klaim constrained decoding yang terjamin.

Batas instruksi dasar dan konteks profil tetap 16 KiB. Schema di system/response format dan overhead 1 KiB diperhitungkan tersendiri, tetap di bawah hard cap adapter 48 KiB; batas respons, timeout, concurrency tidak berubah. Tidak ada schema retry atau downgrade otomatis. Respons invalid tetap tidak disimpan. Materialisasi awal sekarang memeriksa respons sebelum retry semantik dapat menggantinya.

Verifikasi kode final:

- Offline: **166 lulus, 0 gagal**, dua tes live sengaja dilewati pada perintah offline, tujuh file pengujian. Laporan: `artifacts/opportunity-structured-output-offline.json`.
- Live: **dua persona lulus**, ENTREPRENEUR sekitar 24.958 ms dan UMKM_EXISTING sekitar 42.864 ms. Masing-masing tepat satu panggilan provider, lulus schema/materialisasi/grounding, dan mencapai mock repository. Laporan: `artifacts/opportunity-structured-output-live.json`.
- Live hanya memakai profil/evidence sintetis. Resolver profil, pembukaan token, dan repository dimock; adapter/model, context builder, fact catalog, materialisasi dan grounding nyata. Tidak ada data profil pengguna yang dipakai, tidak memanggil SearchApi, tidak menulis database. Ini bukan pengujian browser atau database end-to-end.
- TypeScript dan ESLint untuk file TypeScript yang disentuh: lulus.
- Tujuh kegagalan service yang disebut dalam laporan v18 di bawah sudah diselesaikan: assertion schema persona/version diperbarui, mock parser mendukung suffix prompt retry, assertion normalisasi memeriksa nilai server yang benar, dan respons invalid diperiksa sebelum retry. Tes penolakan klaim finansial, referensi salah, duplikasi, lintas konteks, dan kedaluwarsa tetap aktif.

Hasil live menunjukkan perbaikan bekerja pada sampel tersebut; tidak menjamin semua respons model selanjutnya. UI pada akun pengguna dan penyimpanan database belum diuji ulang. Tidak ada commit, migrasi, atau perubahan data pengguna.

## Bukti insiden

Request `ai_6892d665-2289-4900-ad38-5c7579e59b7a`: provider HTTP 200, 54.151 ms, timeout 120.000 ms, tanpa abort. `ideas[0].evidenceGapRefs` berisi enam elemen, melampaui maksimum lima. Schema gagal sebelum grounding; HTTP 502 adalah pemetaan kegagalan output provider. Log tidak menunjukkan isi referensi sehingga validitas masing-masing referensi belum diketahui.

Prompt sebelumnya menyebut maksimum lima pada hasil insufficiency, tetapi tidak pada setiap ide. Katalog menawarkan lebih dari lima gap. Instruksi yang tidak lengkap ini merupakan celah kesesuaian prompt dengan validator; keputusan internal model tidak dapat dibuktikan dari log.

## Perubahan

- Prompt v18 menyertakan batas semua array dari diagnostic contract dalam tuple ringkas. Batas gap diagnostic memakai konstanta yang sama dengan validator Zod.
- Model diminta memilih gap unik paling relevan hingga maksimum, bukan menyalin seluruh katalog, dan menghitung ulang array sebelum mengirim.
- Instruksi berulang dipadatkan agar pengujian profil sintetis dua puluh produk tetap memenuhi batas prompt 16 KiB. Data profil dan katalog tidak dipotong.
- Tidak ada perubahan API, database, timeout, atau penambahan retry schema. Output invalid tetap ditolak sebelum penyimpanan.
- Diperbaiki import `containsNumericMention` yang hilang dan deklarasi tipe diagnostic untuk hitungan attempt/normalisasi yang sudah dipakai di service.

## Arsitektur personalisasi

Implementasi aktif membangun katalog fakta dari profil tersimpan milik pengguna terautentikasi dan satu bukti SearchApi terpilih. Persona ENTREPRENEUR memakai konteks memulai usaha; UMKM_EXISTING memakai konteks pengembangan usaha serta produk/harga yang sudah ada. Kontrak API/FSD mengizinkan lokasi, catatan, dan nilai finansial yang relevan melalui consent versi aktif; akun/email/kredensial/sesi bukan konteks model.

Ini konteks inferensi, bukan training/fine-tuning. Profil adalah informasi yang dinyatakan pengguna; sinyal pencarian bukan bukti penjualan atau kelayakan finansial. Hasil tetap hipotesis privat dengan asumsi, keterbatasan, gap, dan eksperimen. Menggabungkan konteks memungkinkan personalisasi, tetapi peningkatan kualitas hasil harus dibuktikan melalui evaluasi per persona, bukan diasumsikan.

Dokumen `docs/PRD.md` dan `docs/FSD.md` tidak tersedia; padanan kanonis adalah `docs/VENTUREX_AI_PRD.md` dan `docs/VENTUREX_AI_FSD.md`, termasuk amendemen SearchApi 18 Oktober 2026. Prompt Codex yang direvisi berada di `docs/Opportunity Finder Codex Implementation Prompt.md`.

## Verifikasi v18 (historis, digantikan hasil v19 di atas)

- Regresi terarah: 5 lulus, mencakup kedua persona, lima versus enam referensi katalog nyata, tanpa truncation/retry tambahan, serta batas prompt profil besar.
- Adapter 9Router, context, fact catalog, grounding, dan route: 109 pengujian lulus di lima file.
- `pnpm exec tsc --noEmit`: lulus.
- ESLint pada empat file TypeScript yang disentuh: lulus.
- Suite service lengkap: 34 lulus, 7 gagal. Laporan: `artifacts/opportunity-schema-regression.json`. Kegagalan menyangkut identity schema generik versus schema persona, ekspektasi penolakan angka yang sekarang dinormalisasi, dan jalur insufficiency/retry. Suite ini belum hijau; perubahan kebijakan angka/retry di luar koreksi batas gap ini tidak dilakukan.
- Browser dan inferensi provider live belum dijalankan ulang. Pengujian sintetis tidak menjamin LLM selalu mengikuti batas. Structured output tingkat provider memerlukan verifikasi dukungan adapter/provider terlebih dahulu; tidak diasumsikan tersedia.

Tidak ada commit, migrasi, atau perubahan data pengguna.
