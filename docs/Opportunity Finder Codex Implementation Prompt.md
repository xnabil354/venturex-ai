# Prompt Codex: Opportunity Finder yang Dipersonalisasi per Persona

Salin isi dokumen ini sebagai instruksi kerja Codex pada checkout VentureX yang benar. Prompt ini menggabungkan diagnosis insiden terbaru dengan rancangan pemrosesan profil Entrepreneur dan UMKM Existing yang telah disetujui pemilik produk.

---

## Instruksi kerja untuk Codex

Kerjakan stabilisasi Opportunity Finder agar hipotesis AI memakai profil yang tepat untuk persona pengguna, evidence SearchApi yang dipilih, dan kontrak output tervalidasi. Lakukan perubahan terkecil yang benar-benar diperlukan berdasarkan kondisi kode saat ini. Jangan menganggap seluruh pekerjaan di bawah belum ada: audit implementasi aktif lebih dahulu, pertahankan implementasi yang sudah sesuai, lalu ubah kekurangannya.

### Bahasa dan pengalaman membaca, prompt v20

Fokus revisi ini adalah kenyamanan membaca bagi calon pengusaha dan pemilik usaha awam. Pakai Bahasa Indonesia yang hangat, santai, sopan, dan tetap menyapa dengan Anda. Kalimat pendek dan aktif, satu poin satu gagasan. Hindari jargon, emoji, janji keuntungan, dan bahasa promosi berlebihan. Konsep cukup dua kalimat: ide yang bisa dicoba dan cara mulai mencobanya. Penjelasan kecocokan membahas alasan, bukan menyalin daftar profil; fakta terverifikasi tetap ditambahkan server.

Contoh gaya bahasa, hanya ilustrasi: “Coba tawarkan pilihan rasa teh di gerai Anda. Ajak calon pembeli mencicipi, lalu catat rasa yang mereka pilih.” Jangan menganggap contoh tersebut sebagai fakta pengguna atau produk yang sudah ada. Angka tetap hanya dari sumber yang sesuai atau parameter eksperimen terstruktur; aturan schema dan grounding v19 tetap berlaku.

Susun hasil sebagai bacaan bertahap:

- Pertahankan penanda “Ide awal · perlu dicoba” dan privasi di dekat judul. Tampilkan konsep, calon pelanggan, alasan ide relevan, serta petunjuk pencarian dengan bahasa sehari-hari.
- Beri fokus visual pada “Mulai dari langkah kecil”, dengan daftar tindakan bernomor. Nyatakan bahwa ini rencana percobaan yang belum diketahui hasilnya.
- Detail asumsi, informasi yang belum tersedia, dan keterbatasan tetap lengkap dalam disclosure “Yang masih perlu dicari tahu”. Jangan menghapusnya untuk membuat ide terlihat lebih meyakinkan.
- Sumber, waktu, provider, dan model tersedia dalam disclosure tersendiri. Tombol simpan tetap terlihat dan bekerja seperti sebelumnya.
- Desktop dapat memakai dua kolom untuk alasan dan petunjuk; ponsel menjadi satu kolom. Gunakan token DESIGN.md, lebar baca nyaman, jarak antarbagian yang jelas, native details/summary, fokus keyboard, dan target sentuh minimal 44 px. Jangan menambah chart, animasi dekoratif, atau shadow besar pada kartu bacaan.
- Layout yang sama berlaku untuk Finder dan Saved Opportunities, termasuk hipotesis lama tanpa enrichment opsional. Teks lama tidak diregenerasi otomatis.

Verifikasi state simpan/error, kompatibilitas data lama, pengungkapan detail lewat keyboard, overflow desktop/ponsel, batas request profil besar, dan schema/grounding dengan provider live memakai data sintetis. Pisahkan QA preview komponen dari pengujian sesi akun dan database nyata.

### 1. Baca sumber kebenaran dan amankan kondisi checkout

Sebelum mengubah kode:

1. Pastikan repository dan branch yang aktif benar.
2. Baca `AGENTS.md`, `DESIGN.md`, `docs/PRD.md`, `docs/FSD.md`, `docs/Database Design.md`, `docs/API Design.md`, dan `docs/Tech Stack Requirement.md`. Jika nama dokumen berbeda atau tidak tersedia, temukan dokumen kanonis penggantinya dan laporkan pemetaan tersebut; jangan mengarang isi dokumen.
3. Baca panduan Next.js yang relevan dari `node_modules/next/dist/docs/` sesuai instruksi `AGENTS.md` sebelum menyentuh route handler atau perilaku App Router.
4. Periksa `git status --short` dan diff sebelum mengedit. Checkout ini dapat berisi pekerjaan lokal lain, termasuk Trend Radar. Jangan membuang, mereset, menimpa, atau merapikan perubahan yang tidak terkait. Jangan commit kecuali diminta secara eksplisit.
5. Telusuri implementasi aktual pada `src/opportunity/`, route `/api/v1/opportunities/ideas`, consent UI, resolver profil, adapter 9Router, dan evaluasi personalisasi yang sudah ada. Dokumen dan kode aktif menentukan kontrak; jangan mengubah API/database hanya untuk menyamarkan kegagalan model.

### 2. Diagnosis insiden yang harus dipertahankan

#### Insiden terbaru: properti output di luar schema

Request `ai_b4be7dce-1f2e-4cdc-a5e8-3f26dfed8a0d` menerima HTTP 200 dalam 32.611 ms, lalu gagal `unrecognized_keys` pada root `$`. Nama/nilai properti tambahan tidak tercantum dalam log; jangan mengarangnya. `receivedTypeCategory=undefined` pada diagnostic lama berasal dari lookup root tanpa field contract, bukan bukti bahwa JSON kosong.

Perbaikan wajib sekarang adalah structured output pada transport Opportunity Finder, bukan menambah larangan teks satu per satu:

- Aktifkan `supportsStructuredOutputs` di adapter hanya untuk panggilan yang meminta mode terstruktur; kirim `response_format.type=json_schema` dengan `strict=true`.
- Bentuk schema dari Zod persona yang sama dengan validator. Envelope transport adalah `{ result: HASIL }`, sehingga union outcome tidak berada pada root. Union diskriminatif bertag literal yang terpisah dikirim sebagai `anyOf`, padanan `oneOf` untuk cabang yang saling eksklusif. Semua objek tetap `additionalProperties=false`.
- Gateway terpasang menerima response format tetapi pengujian lanjutan menunjukkan schema lengkap dapat diabaikan. Sertakan schema hasil generator yang SAMA dalam system message sebagai `OUTPUT_JSON_SCHEMA`; uji equality antara schema system dan response format. SDK menyediakan response format, sementara parser/validator lokal tetap memeriksa envelope serta hasil dan menghasilkan diagnostic privat. Kembalikan hanya isi result ke service; jangan ubah API atau persistence.
- Prompt v19 meminta envelope tersebut dan melarang metadata katalog muncul sebagai properti hasil. Jangan menghapus field tambahan diam-diam atau membuat field wajib opsional. Referensi dan grounding tetap diperiksa sebelum persistensi dan sebelum retry semantik mengganti respons.
- Tetap batasi instruksi dasar dan konteks profil 16 KiB. Budget body menambahkan ukuran schema terhitung di system dan response format serta overhead 1 KiB, dengan hard cap adapter 48 KiB. Diagnostic menghitung ukuran system/prompt aktual termasuk schema. Jangan memperbesar batas konteks profil, respons, timeout, atau concurrency. Schema adalah overhead kontrak terukur, bukan data profil tambahan.
- Verifikasi dengan mock transport yang memeriksa wire schema serta provider live memakai profil/evidence sintetis kedua persona. Bedakan repository mock dari penyimpanan database nyata dan dari QA browser.
- Bila provider mengabaikan schema, tetap tolak output invalid tanpa retry schema atau downgrade diam-diam. Sukses beberapa sampel tidak menjamin semua inference berikutnya.

Bagian ini menggantikan strategi prompt-only v18 di riwayat berikut. Pertahankan izin profil per persona dan seluruh grounding; jangan menganggap kebebasan menyusun hipotesis sebagai izin mengarang fakta pasar/finansial.

#### Riwayat: array evidence gap melebihi kontrak

Request `ai_6892d665-2289-4900-ad38-5c7579e59b7a` menerima HTTP 200 dalam 54.151 ms, tanpa abort. Validasi menolak `ideas[0].evidenceGapRefs`: 6 elemen, minimum 1 dan maksimum 5. Grounding belum dijalankan. Ini kegagalan kepatuhan output terhadap schema, bukan timeout atau kegagalan SearchApi.

Diagnosis kode: instruksi lama menyebut batas 1–5 gap hanya untuk `INSUFFICIENT_EVIDENCE`; instruksi gap per hipotesis tidak menyebut maksimum. Katalog memuat lebih dari lima gap yang sah. Katalog adalah pilihan referensi, bukan daftar yang harus disalin seluruhnya. Log tidak berisi raw output sehingga tidak membuktikan apakah keenam referensi valid atau unik.

Perbaikan terarah:

- Sertakan batas seluruh array sebagai `[path,minItems,maxItems]` yang dibentuk dari kontrak diagnostic server, termasuk `ideas[].evidenceGapRefs` dan root `evidenceGapRefs`. Gunakan konstanta batas yang sama dengan schema Zod; uji batas prompt terhadap schema agar tidak drift.
- Instruksikan model memilih gap unik paling relevan dengan konsep/eksperimen, maksimal lima per hasil terkait, lalu menghitung ulang semua array sebelum mengirim JSON. Jangan membatasi katalog input ke lima: produk yang berbeda dapat membutuhkan gap berbeda.
- Pertahankan validator strict, pemeriksaan referensi/owner/freshness/duplikasi, serta grounding sebelum penyimpanan. Jangan memperbesar batas, memotong array, menghapus gap diam-diam, atau menambahkan retry berbayar untuk menyamarkan respons invalid.
- Naikkan versi prompt menjadi `opportunity-profile-searchapi-hybrid-v18`. Padatkan instruksi berulang tanpa menghapus fakta profil, batas persona, atau aturan grounding; tetap uji profil sintetis dengan dua puluh produk terhadap batas prompt 16 KiB.
- Regresi wajib: kedua persona menerima batas array; lima referensi katalog sah lolos sampai materialisasi; enam ditolak tanpa penyimpanan/retry; unknown/duplicate/cross-owner/stale tetap ditolak. Pengujian mock tidak membuktikan model live selalu patuh.

Prioritas diagnosis insiden adalah paragraf terbaru ini. Insiden berikut adalah riwayat kegagalan lain, bukan penyebab request di atas.

Log terakhir menunjukkan:

- provider `ninerouter`, model `cx/gpt-6-luna-xhigh`;
- upstream menyelesaikan respons dengan HTTP 200 dalam sekitar 61,5 detik;
- `timeoutMs` 120.000, `abortOrigin` `NONE`, dan body respons selesai diterima;
- kegagalan terjadi pada validasi schema (`INVALID_RESPONSE`), bukan timeout, koneksi, autentikasi, atau pencarian SearchApi;
- lima objek `ideas[0].experiments[*].parameters[*]` tidak memiliki enum `kind`, padahal schema mewajibkannya;
- tidak ada hipotesis yang boleh disimpan setelah respons gagal divalidasi.

Akar masalah yang terlihat adalah instruksi generation prompt sebelumnya hanya menyebut “parameter bertipe PROPOSED” dan daftar jenis/unit. Instruksi itu tidak memetakan bentuk objek lengkap untuk setiap `kind`, sementara validator Zod menggunakan schema strict dan discriminated union. Perlakukan waktu respons 61,5 detik sebagai temuan latency provider yang terpisah; jangan salah klasifikasikan insiden schema ini sebagai timeout dan jangan mengubah timeout untuk menutupi error schema.

### 3. Perbaiki kesesuaian prompt dan schema tanpa melemahkan validasi

Jadikan schema server yang ada sebagai sumber kebenaran. Prompt generation harus menyebut seluruh field wajib, tipe, enum, unit, nullability, dan batas jumlah objek secara eksplisit. Parameter eksperimen mengikuti bentuk berikut:

- `SAMPLE_SIZE`: `status="PROPOSED"`, `kind="SAMPLE_SIZE"`, `value` bilangan bulat positif, `unit="PEOPLE"`, `sourceRef=null`.
- `INTERVIEW_COUNT`: bentuk sama dengan `kind="INTERVIEW_COUNT"` dan `unit="PEOPLE"`.
- `DURATION`: `kind="DURATION"`, `value` bilangan bulat positif, `unit="DAYS"`.
- `PRODUCT_VARIANT_COUNT`: `kind="PRODUCT_VARIANT_COUNT"`, `value` bilangan bulat positif, `unit="VARIANTS"`.
- `PRICE_TEST`: `kind="PRICE_TEST"`, `min` dan `max` bilangan bulat positif dengan `min <= max`, `unit="IDR"`; gunakan `min` dan `max`, bukan `value`.
- Semua varian memakai `sourceRef=null`, tidak boleh kehilangan `kind`, tidak boleh memiliki properti tambahan, dan hanya boleh memuat field milik variannya.

Jangan mengubah schema menjadi permissive, membuat `kind` opsional, menyuntik nilai default untuk memperbaiki output model, atau menyimpan output parsial. Jika provider mendukung format/schema terstruktur, periksa kontrak adapter dan dokumentasi yang sudah tersedia sebelum memakainya; validasi server tetap wajib. Pastikan prompt dan schema tidak menjadi dua kontrak yang diam-diam berbeda.

### 3A. Insiden terbaru: numeric grounding setelah schema lolos

Log terbaru berbeda dari insiden schema di atas: upstream merespons HTTP 200, body selesai diterima, `schemaValidationOutcome=PASSED`, dan grounding menolak `ideas[0].concept` serta `validationSteps[0..1]` sebagai `UNSUPPORTED_NUMBER`. Jangan klasifikasikan ini sebagai timeout atau masalah konfigurasi 9Router.

- Angka pada `concept` dinilai `OTHER_CONTEXTUAL_NUMBER` tanpa kecocokan sumber. Pertahankan penolakan ini; jangan menerima klaim numerik naratif hanya untuk membuat generation berhasil. Larang jumlah, metrik angka, nilai finansial, dan periode dalam narrative, assumptions, limitations, serta experiment.action. Angka profil hanya boleh dijelaskan di `profileFit` dengan ref yang cocok; fakta SearchApi dijelaskan secara kualitatif karena server menambahkan nilai yang dirujuk. Nama produk bernomor hanya boleh disalin persis dari fakta profil yang dirujuk.
- `materializeHybridOpportunityResult` membangun `validationSteps` dengan menggabungkan action model dan angka parameter terstruktur. Jika beberapa parameter digabung sebagai daftar, setiap segmen numerik harus tetap terbaca sebagai tindakan eksperimen prospektif tersendiri. Jangan melonggarkan grounding umum: format setiap `SAMPLE_SIZE`, `INTERVIEW_COUNT`, `DURATION`, `PRODUCT_VARIANT_COUNT`, dan `PRICE_TEST` menjadi frasa tindakan yang jelas sebelum validasi.
- Log tidak memuat teks mentah dan karena itu tidak membuktikan klaim mana yang menghasilkan setiap span. Tambahkan regresi sintetis yang melewati jalur typed-output → materialisasi → grounding, termasuk beberapa parameter dalam satu eksperimen dan parameter durasi pada posisi berikutnya. Angka parameter terstruktur yang dirender server harus lolos sebagai rencana; angka tambahan yang ditulis model di action/concept tetap harus gagal.
- Naikkan versi prompt ketika aturan generation berubah. Jangan mencatat teks narasi/profil mentah ke diagnostic.

### 4. Gunakan persona autentikasi dan profil tersimpan yang sesuai

Persona harus ditentukan server dari pengguna terautentikasi dan data profil yang tersimpan. Browser hanya boleh mengirim referensi sinyal yang diterbitkan server, persetujuan eksplisit, dan versi consent yang sah; nilai profil dari browser bukan sumber berwenang. Baca ulang profil dan referensi terkait di server saat generation dimulai, lalu validasi pemilik, kelengkapan, dan freshness sumber.

**Calon Pengusaha (`ENTREPRENEUR`)** — buat hipotesis memulai usaha. Gunakan field yang tersedia dan relevan dari profil calon pengusaha, mengikuti konfigurasi profil yang kanonis:

- jenis produk pilihan dan kategori minat;
- target pelanggan dan kanal penjualan;
- pengalaman dan komitmen waktu;
- rentang modal/budget yang dinyatakan pengguna;
- lokasi yang dinyatakan pengguna;
- tujuan bisnis dan catatan bebas.

Jangan mengasumsikan pengguna sudah memiliki usaha, pelanggan, produk terjual, inventori, omzet, atau hasil operasional.

**UMKM Existing (`UMKM_EXISTING`)** — kembangkan usaha yang tercatat, bukan membuat seolah-olah usaha dimulai dari nol. Gunakan field yang tersedia dan relevan dari Business Profile:

- nama dan kategori usaha serta deskripsi bisnis;
- daftar produk yang memang sudah dijual, kategori, dan harga tercatat;
- rentang harga rata-rata;
- target pelanggan dan kanal penjualan;
- lokasi usaha dan catatan bebas.

Bedakan produk yang sudah ada dari usulan varian/ekstensi. Jangan menyebut ulang produk lama yang tidak berubah sebagai menu atau opportunity baru.

Jangan menggabungkan field lintas persona secara spekulatif. Field yang tidak tersedia tetap tidak diketahui; jangan mengisinya dengan inferensi seolah fakta.

### 5. Hormati persetujuan pemrosesan yang disetujui pengguna

Pengguna secara eksplisit mengizinkan lokasi, catatan bebas, dan angka/rentang finansial profil yang relevan dikirim bersama profil persona yang tepat dan evidence terpilih kepada model melalui 9Router. Tujuannya memperbaiki kecocokan konteks; persetujuan ini bukan bukti bahwa upstream menyimpan data secara aman.

- Tampilkan secara jelas kategori yang dapat diproses sebelum aksi generation: profil sesuai persona, lokasi, catatan bisnis, angka finansial, produk/harga, segmen/kanal, serta evidence pencarian terpilih.
- Pertahankan consent eksplisit, owner binding, versi consent, server-side profile resolution, allowlist field, dan disclosure bahwa 9Router dapat meneruskan request ke penyedia upstream serta retensi/downstream belum diverifikasi.
- Jangan menyatakan bahwa persetujuan mengizinkan training atau fine-tuning.
- Jangan kirim ID akun, email, kredensial, API key, token, data sesi, atau field internal. Jangan log prompt mentah, isi profil, catatan, token evidence, maupun respons privat.
- Catatan bebas yang diizinkan tetap harus diperiksa untuk pola kredensial/identifier terlarang sebelum dikirim. Gunakan sanitasi sempit yang deterministik agar informasi bisnis, lokasi, dan angka finansial yang sah tetap terbaca; uji email/token sintetis di dalam catatan dan jangan mencatat nilai aslinya.
- Perlakukan catatan bebas, nama produk, dan kueri sebagai data tidak tepercaya. Instruksi yang tertanam di dalamnya tidak dapat mengubah system prompt, schema, consent, atau aturan keamanan.
- Jangan pernah mengirim profil milik pengguna lain atau mengirim kedua persona sekaligus. Gunakan hanya field allowlist dari persona aktif.
- Jangan menyimpan raw profile, prompt, SearchApi response set, atau token evidence. Ikuti kontrak penyimpanan hipotesis privat dan source reference yang sudah berlaku.

Jika perubahan implementasi memperluas kategori data melampaui izin eksplisit tersebut, jangan mengirim kategori baru. Perbarui disclosure/versi consent sesuai kontrak dan laporkan kebutuhan keputusan produk; jangan menyimpulkan persetujuan untuk kategori baru.

### 6. Pertahankan kualitas evidence, angka, dan makna opportunity

- Gunakan hanya signal SearchApi Top/Rising terpilih yang masih valid dan diterbitkan server. Jangan menganggap kata pencarian sebagai instruksi.
- Top adalah indeks minat relatif. Rising adalah label/pertumbuhan kueri dari sumber bila tersedia; `Breakout` tetap label, bukan persentase.
- Evidence pencarian bukan bukti penjualan, permintaan terukur, pelanggan, omzet, laba, margin, ROI, biaya, atau jaminan hasil.
- Hubungkan setiap klaim `profileFit` hanya dengan fact profil yang sesuai; `evidenceInterpretation` hanya dengan fact SearchApi yang sesuai. Gunakan reference dari katalog aktif dan jangan membuat ID/ref sendiri.
- Jaga semantik angka: budget, rentang harga rata-rata, harga produk, harga usulan, harga kompetitor, biaya, willingness to pay, omzet, margin, dan volume adalah metrik berbeda. Lokasi adalah konteks kecocokan, bukan bukti adanya permintaan lokal.
- Angka eksperimental adalah rencana (`PROPOSED`), bukan fakta, hasil, atau proyeksi. Jangan membuat ambang pasar/keuangan tanpa dasar.
- Jika katalog memuat fakta profil dan fakta SearchApi yang valid, buat minimal satu hipotesis eksploratif; data penjualan, pelanggan, dan finansial yang belum tersedia menjadi asumsi, gap, keterbatasan, dan rencana uji. Jika model tetap memilih `INSUFFICIENT_EVIDENCE`, lakukan satu retry terarah. Untuk UMKM existing, jika validator menolak `NEW_MENU` karena sama dengan produk yang sudah ada, lakukan satu retry koreksi yang mengarah ke positioning/kanal atau varian yang benar-benar berbeda; jalankan ulang materialisasi dan seluruh validasi sebelum menyimpan. Jangan melemahkan guard duplikasi atau menyimpan respons yang tetap ditolak. Pertahankan hasil insufficiency hanya jika konteks memang tidak memiliki fakta profil atau sinyal pencarian yang dapat dirujuk; jangan menyebut hipotesis sebagai peluang yang sudah terbukti.

Untuk query `kopi hitam`, uji bahwa signal pilihan digunakan sebagai evidence pencarian dengan interpretasi sesuai jenis Top/Rising yang diterima server. Hasilnya harus berubah berdasarkan persona dan profil synthetic yang diberikan: calon pengusaha menerima hipotesis memulai usaha sesuai preferensi/budget/waktu/lokasi; UMKM menerima hipotesis pengembangan yang mempertimbangkan produk/harga yang telah ada. Jangan menyatakan query ini membuktikan demand, volume pelanggan, atau potensi pendapatan.

### 7. Error handling, latency, dan persistensi

- Bedakan kegagalan transport/timeout, HTTP/provider error, malformed JSON, schema invalid, grounding invalid, token stale/ownership mismatch, dan insufficiency evidence. Pesan UI harus sesuai kategori aktual dan tidak menyalahkan koneksi 9Router pada respons HTTP 200 yang gagal schema.
- Terapkan fail-closed: simpan hanya setelah schema lengkap, fact references/ownership/freshness, grounding, dan kontrak hasil semua lulus. Kegagalan validasi tidak boleh membuat record parsial.
- Jangan menambah retry otomatis untuk inference yang lambat atau invalid; satu klik tidak boleh diam-diam memicu beberapa inference berbayar.
- Pertahankan timeout Opportunity Finder yang sudah dikonfigurasi. Perubahan timeout, response cap, concurrency, atau biaya hanya boleh dilakukan bila ada bukti dan analisis trade-off; jangan memperpanjang deadline sebagai solusi schema.
- Diagnostic boleh mencatat request/correlation ID, fase, durasi, status upstream, path schema yang aman, dan kategori kegagalan. Jangan mencatat nilai privat atau isi raw output.

### 8. Batas perubahan

- Jangan mengubah route/API response shape, persistence schema, database, migrasi, lifecycle Opportunity global, kontrak Trend Radar, atau data source tanpa bukti bahwa kebutuhan tidak dapat dipenuhi dengan kontrak yang ada. Jika benar-benar perlu, jelaskan sumber dokumen dan dampak kompatibilitas lebih dahulu.
- Jangan melakukan refactor luas atau mengubah perilaku Opportunity Finder lain yang tidak berhubungan.
- Pertahankan design system yang ditetapkan `DESIGN.md`; perubahan UI hanya untuk consent/error state yang diperlukan, responsif dan aksesibel.
- Gunakan kode dan pola repo, TypeScript strict, validasi schema server, dan Next.js versi terpasang.

### 9. Verifikasi yang diminta dari implementer

Tambahkan atau perbarui verifikasi deterministik yang fokus pada kontrak ini, lalu jalankan perintah QA yang tersedia dan laporkan hasil aktual. Minimal cakup:

1. Masing-masing dari lima jenis parameter eksperimen valid bila field/unit/value tepat.
2. `kind` hilang, unit salah, nilai nol/pecahan, properti tambahan, `PRICE_TEST` tanpa batas atau `min > max` ditolak sebelum persistence.
3. Output synthetic untuk Entrepreneur dan UMKM membuktikan hanya profil owner dan persona yang tepat masuk ke projection/provider payload.
4. Lokasi, catatan, budget/harga yang diizinkan hadir bila tersedia; email/token/account identifier sintetis di dalam catatan disanitasi, sedangkan informasi bisnis yang lain tetap tersedia.
5. Prompt injection synthetic dalam query/catatan tidak mengubah instruksi sistem atau menciptakan klaim.
6. Top index, Rising growth, dan `Breakout` tidak tertukar dengan angka penjualan/finansial.
7. Narasi tidak mengulang metrik atau periode SearchApi tanpa referensi; setiap parameter eksperimen terstruktur dirender sebagai tindakan prospektif dan tetap lolos grounding saat ada beberapa parameter.
8. Query `kopi hitam` berhasil diproses dengan evidence token synthetic dan respons model synthetic yang memenuhi schema; tidak perlu memanggil model live untuk membuktikan validasi deterministik.
9. HTTP 200 dengan output tanpa `kind` diklasifikasikan schema-invalid, tidak sebagai timeout, tidak disimpan, dan tidak di-retry otomatis.
10. Kasus timeout yang benar tetap diklasifikasikan timeout; kasus insufficiency tetap tidak disimpan sebagai hypothesis.

Jangan membuat inference live berbayar atau memakai profil nyata hanya untuk QA bila hal itu tidak diminta. Alur aplikasi normal hanya mengirim kategori yang telah disetujui setelah checkbox consent aktif. Gunakan fixture sintetis untuk test otomatis. Bedakan hasil test deterministik dari evaluasi kualitas model langsung; jangan mengklaim model lebih relevan/akurat sebelum ada evaluasi output yang nyata dan terukur.

### 10. Kriteria selesai dan laporan

Pekerjaan selesai bila:

- akar insiden schema di atas ditangani pada instruksi generation yang benar;
- parameter eksperimen terstruktur tetap lolos grounding, sedangkan angka naratif tanpa sumber tetap ditolak;
- kedua persona memakai field allowlist yang tepat dan server-authoritative;
- izin data yang disetujui terlihat jelas di consent dan tidak mengirim field terlarang;
- validasi schema dan grounding tetap ketat, dengan no-persistence/no-retry saat gagal;
- verifikasi deterministik dan QA yang relevan dijalankan tanpa mengganggu pekerjaan lokal yang tidak terkait;
- tidak ada perubahan API/database di luar kebutuhan yang sudah didokumentasikan.

Pada laporan akhir, jelaskan: diagnosis berbasis log, file yang diubah, alur data per persona, sumber/field yang dikirim dan dikecualikan, verifikasi yang dijalankan beserta hasil aktual, apakah inference live dilakukan, keterbatasan latency/model, serta risiko atau pekerjaan yang masih tersisa. Jangan menyebut perbaikan sebagai teruji bila perintah QA belum dijalankan.
