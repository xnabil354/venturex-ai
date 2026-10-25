# Analisis mendalam calon pengusaha — v2

Acuan: BRD Step 5 Analyze dan bagian 18–19, PRD-SCORE-001–007, FSD-SCORE-001–003, FSD-AI-002, serta Tech Stack Requirement bagian 58–59. V2 menggantikan halaman simulator V1 pada alur hipotesis privat. Compare dan roadmap tetap di luar scope.

## Alur

Reliability repair, 25 October 2026: pembatalan request diperiksa sebelum
panggilan provider, setelah pengambilan bukti, ketika AI gagal, dan sebelum
penyimpanan. Request yang dibatalkan tidak disimpan sebagai analisis parsial baru.
Kegagalan provider yang sebenarnya tetap mengikuti aturan hasil parsial dan
insufficient data; angka skor tidak dibuat untuk mengganti faktor yang kosong.

1. Buka **Lihat Detail Score** dari Finder atau Saved sebagai ENTREPRENEUR.
2. Halaman membaca hipotesis berdasarkan `{ id, userId, userType: ENTREPRENEUR }`, profil terbaru dan referensi aktif. Membuka halaman tidak memanggil provider.
3. Pengguna dapat mengonfirmasi estimasi modal minimum, menyetujui pemrosesan dan menekan **Analisis peluang ini**.
4. Server membaca profil lengkap: produk, kategori, segmen, kanal, budget, lokasi, pengalaman, waktu, tujuan dan catatan relevan melalui context builder existing. ID akun, email dan kredensial tidak dikirim ke AI.
5. Ambil histori TIMESERIES satu tahun untuk kueri sinyal hipotesis dengan geo/properti aslinya; cari satu sampel Google Maps memakai produk pilihan + kota profil. Kedua permintaan berjalan paralel, memakai adapter/cache/budget SearchApi existing. Tidak ada auto retry berbayar.
6. AI menerima konteks, hipotesis, referensi aktif dan ringkasan bukti. AI hanya mengusulkan kategori, segmen, kanal, kebutuhan pengalaman/waktu, kompleksitas dan penjelasan kualitatif. Tidak ada field skor, probabilitas atau estimasi finansial dari AI. Semua kebutuhan konsep ditandai perkiraan, bukan fakta terverifikasi. ID di luar katalog dibuang; narasi berangka ditolak tanpa membuang bukti pasar yang berhasil.
7. Sistem menghitung kedua skor secara deterministik, lalu menyimpan snapshot. Provider failure menghasilkan analisis parsial berstatus jelas; hipotesis tetap tersedia.

## Opportunity Score awal

| Faktor | Bobot | Normalisasi dan dasar |
|---|---:|---|
| Momentum | 25% | `100 × recentMean / (recentMean + previousMean)` dalam satu seri. Recent/prior masing-masing jendela 91 hari relatif ke titik terakhir; minimal 4 titik valid per jendela dan span 150 hari. Stabil = 50; kedua mean nol = unknown. |
| Minat relatif | 20% | Mean recent dalam histori. Jika histori tidak tersedia, gunakan indeks Top asli 0–100 dengan label historis. Bukan penjualan/volume pasar. |
| Tekanan sampel kompetitor | 15% | `100 / (1 + n/5)`, n listing unik pada maksimal 20 baris hasil pertama yang alamatnya cocok dengan kota profil. Sampel nol tetap unknown, bukan 100. Bukan jumlah seluruh pesaing atau pangsa pasar. |
| Kesesuaian target konsumen | 15% | Persentase ID segmen usulan yang cocok dengan segmen aktif profil. Bukan respons pembelian. |
| Kemudahan pelaksanaan | 15% | Rubrik kompleksitas konsep: SIMPLE=100, STANDARD=60, COMPLEX=25. Klasifikasi AI adalah asumsi. Tidak mengulang kemampuan personal yang dinilai di Fit. |
| Kestabilan pencarian | 10% | `100 × positiveFraction / (1 + CV)`. CV=populasi standar deviasi/mean seluruh titik valid. Minimal 40 titik, span 270 hari, 10 bulan teramati; mean nol tetap unknown. Ini proxy kestabilan pencarian, bukan daya tahan usaha. |

TIMESERIES dinormalisasi adapter existing (timestamp positif, exact-query, 0–100, null tidak diisi nol). Statistik snapshot menyimpan count, bulan teramati, span, recent/prior mean, positiveFraction dan CV agar faktor dapat direkonstruksi. Normalisasi tidak membandingkan indeks mentah dari dua permintaan atau geo berbeda.

## Fit Score awal

Policy v2 berbeda dari simulator V1; formula dan versi ditampilkan agar keduanya tidak dibandingkan sebagai model yang sama.

| Faktor | Bobot | Dasar |
|---|---:|---|
| Modal | 30% | `min(100, 100 × profile.budget.max / capitalMin)` dari estimasi pengguna; estimasi nol yang dikonfirmasi bernilai 100. Estimasi kosong = unknown. |
| Minat | 20% | Exact category ID match, 100 atau 0; referensi profil kosong = unknown. |
| Kanal | 20% | Persentase kanal usulan yang cocok dengan profil; tidak ada kebutuhan/referensi = unknown. |
| Pengalaman | 15% | Urutan BEGINNER/SOME_EXPERIENCE/EXPERIENCED; mencukupi=100, kurang satu tingkat=50, dua tingkat=0. Kebutuhan konsep diperkirakan AI. |
| Waktu | 15% | Urutan LIMITED/PART_TIME/FULL_TIME, aturan yang sama. Tidak diasumsikan sebagai jumlah jam tertentu. |

Location Fit belum diberi angka karena belum ada kebutuhan geografis operasional yang tervalidasi. Lokasi dipakai untuk menentukan sampel lokal; ketidakcocokan cakupan geo histori dengan kota profil dinyatakan sebagai keterbatasan. Catatan bebas membantu interpretasi tetapi tidak dianggap fakta pasar.

## Kelengkapan dan interpretasi

Semua bobot tiap model berjumlah 1. Nilai faktor dibulatkan dua desimal; agregat memakai nilai faktor tersimpan sehingga dapat direkonstruksi. Cakupan = jumlah bobot faktor bernilai valid × 100. Data kosong tetap null, bukan nol.

V2 boleh menampilkan **skor awal** jika minimal 3 faktor dan cakupan bobot 60%. `score = Σ(nilai faktor tersedia × bobot) / Σ(bobot tersedia)`, dibulatkan dua desimal. Ini renormalisasi eksplisit untuk skor awal, bukan skor penuh dengan faktor tersembunyi. Di bawah batas itu: score=null, status=INSUFFICIENT_DATA. Semua skor numerik berstatus PRELIMINARY meskipun cakupan 100%; model heuristik ini belum dikalibrasi secara empiris dan tidak menyatakan probabilitas keberhasilan. Cakupan bukan confidence. Satu Top index 100 hanya mengisi 20% dan tidak menghasilkan skor keseluruhan.

## Bukti, risiko dan kegagalan parsial

Listing disaring berdasarkan kota, dideduplikasi place_id atau nama+alamat, dan dibatasi maksimal 20; simpan maksimal 5 contoh. URL Maps dibuat server, tidak disalin dari URL bebas provider. Sampel kosong atau gagal tidak menjadi kesimpulan tidak ada pesaing. Referensi integrasi: [SearchApi Google Maps](https://www.searchapi.io/docs/google-maps), engine `google_maps`, `q`, `local_results.title/address/place_id`.

Risiko awal mencakup modal di atas budget, kebutuhan pengalaman/waktu lebih besar dari profil, dan kompleksitas konsep. Tidak ada label risiko rendah otomatis. Target dan kebutuhan awal tetap hipotesis untuk diuji. Biaya, margin, transaksi dan penerimaan pembeli tidak dibuat dari profil atau Google Trends.

Jika AI gagal, bukti pasar tetap disimpan; gunakan interpretasi snapshot sebelumnya hanya jika fingerprint input sama. Jika satu sumber pasar gagal, faktor terkait kosong dan sumber lain tetap dipakai. Pengguna dapat memperbarui setelah cooldown; kegagalan penyimpanan tidak mengganti hasil lama pada UI. Diagnostik tidak mencetak prompt, profil atau API key.

## Penyimpanan, cache dan akses

Snapshot bertipe/versioned disimpan di `user_generated_opportunities.hypothesis.analysis` (JSONB existing): requirement refs dan asumsi, score/factor/basis, statistik tren, sampel listing terbatas, risiko, warnings, model, waktu dan fingerprint HMAC. Tidak ada migrasi atau mutasi katalog Opportunity global. Raw profil/prompt/histori penuh tidak disimpan. Snapshot malformed atau versi tak dikenal tidak menghilangkan hipotesis induk dari daftar.

Fingerprint mencakup profil lengkap, referensi aktif, hipotesis tanpa snapshot, sumber, model, versi dan estimasi modal. Hasil cocok berlaku 24 jam. Perubahan profil atau estimasi membuat hasil stale; UI tetap menampilkan hasil tersimpan dengan penanda. Satu analisis aktif per user, request identik yang bersamaan dikoaleskan, cooldown 60 detik per proses. Cache/budget/dedup tidak menjamin koordinasi lintas instance. Menghapus hipotesis juga menghapus snapshot JSONB-nya.

POST `/api/v1/opportunities/ideas/{id}/analysis`, body strict `{ consent: true, refresh?: boolean, capitalMin?: integer | null }`, batas 2048 byte. Wajib same-origin, UUID valid, autentikasi, onboarding selesai, owner dan persona ENTREPRENEUR. Unknown fields ditolak. 200 dapat membawa hasil parsial; 400 invalid input, 401 belum login, 403 tidak berhak, 404 tidak ada/owner lain, 429 cooldown, 503 konfigurasi/penyimpanan belum tersedia. Response private/no-store. Route maxDuration 180 detik; deadline analisis gabungan 160 detik, browser 175 detik, agar kegagalan provider dapat disimpan sebagai hasil parsial sebelum koneksi berakhir. Tidak ada request provider saat GET.


## Entrepreneur review and permanent save amendment (21 October 2026)

For private ENTREPRENEUR hypotheses, saving moves from Finder cards to the bottom of the score-detail page after Opportunity Score, Fit Score, target consumers, competition, risks, initial needs and evidence. Profile fields are loaded from the authenticated account; opening a detail page makes no paid inference request. Explicit consent and an analysis action remain required. The only optional financial input here is the concept's estimated minimum capital, displayed as Rp with Indonesian thousands separators and submitted as a whole numeric rupiah amount. It is separate from the account's available budget.

PATCH /api/v1/opportunities/ideas keeps the existing {id, saved} fields and adds optional reviewed:true and analysisFingerprint (64 lowercase hexadecimal characters). Entrepreneur saves require reviewed:true, both numeric scores, structured concept requirements, and a current profile-bound analysis. The server compares the supplied fingerprint to the stored snapshot under a transaction row lock. Unknown/missing data is never replaced with invented scores to unlock saving. Conflicting or incomplete saves return 409 ANALYSIS_CHANGED or ANALYSIS_REQUIRED. Repeat saves are idempotent.

Once an entrepreneur hypothesis is saved, isSaved cannot return to false, DELETE is rejected with 409 SAVED_PERMANENT, and its analysis snapshot is immutable. Existing saved entrepreneur records are preserved and protected. Unsubmitted hypotheses remain deletable. UMKM behavior is outside this change. Data stays in existing user_generated_opportunities JSONB and saved fields, with no migration or TTL added; no provider call is needed to reopen stored scores. This amendment supersedes earlier unsave/delete instructions for private entrepreneur hypotheses only.


## Local competitor matching v2 (21 October 2026)

Normalize administrative locality prefixes (including Kota/Kabupaten Administrasi), Jkt. aliases and directional Jakarta names before matching. Match complete locality names rather than arbitrary substrings, preserve Jakarta Utara/Selatan/Timur/Barat/Pusat distinctions, and reject street-only occurrences. Google Maps queries combine product, canonical city, profile province when present, and Indonesia. No guessed coordinates or automatic paid retries are added.

Retain optional competitors.diagnostics in existing analysis JSONB: receivedCount, inspectedCount (maximum 20), invalidCount, outsideCityCount and duplicateCount. sampleCount is the unique locally matching count; at most five example places remain stored. Counters contain no extra raw addresses. The Competition disclosure shows these counters, distinguishes empty provider results from filtered results and keeps zero samples unknown. Old snapshots without diagnostics remain readable. Provider error envelopes are not treated as empty search evidence.

The local Maps cache key moves to LOCAL_COMPETITOR_SAMPLE_V2, and input fingerprints include competitor matching version 2, preventing reuse of old empty samples for new analyses. Saved permanent snapshots stay immutable. Reanalysis applies only to unsaved hypotheses using existing consent and owner checks; the scoring formula and weights do not change.
