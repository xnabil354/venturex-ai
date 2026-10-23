# Existing Pengusaha: Discover, Analyze, Grow

Tanggal: 22 Oktober 2026. Scope hanya UMKM_EXISTING; kontrak Entrepreneur tetap berlaku.

Implementasi memakai snapshot `hypothesis.businessAnalysis` dan `hypothesis.growthRoadmap` pada JSONB yang sudah ada. Tidak ada relasi palsu ke katalog Opportunity, migrasi, atau perubahan konfigurasi provider. Detail, Compare, analisis dan roadmap selalu memeriksa owner dan persona di server. GET tidak memanggil provider.

Analisis eksplisit dengan consent membaca profil bisnis terbaru, histori satu tahun dari sinyal asal, sampel listing lokal, dan usulan kebutuhan kualitatif AI. AI tidak menghasilkan skor/angka finansial. Opportunity Score menggunakan enam faktor dan bobot yang sama dengan model preliminary yang terdokumentasi di Entrepreneur Deep Analysis, tetapi Business Fit memiliki model sendiri: Product Category proxy 25%, Customer 25%, Channel 20%, Price 30%. Harga konsep adalah estimasi rentang yang diisi pengguna, bukan harga produk lama atau prediksi AI. Operational/Brand Fit dikecualikan secara eksplisit. Minimal tiga faktor dan cakupan 60%; lainnya insufficient data. Cakupan bukan confidence.

Risiko menggunakan konflik komponen Business Fit dan kompleksitas: kompleks atau minimal dua konflik = HIGH; satu konflik = MEDIUM; tidak ada konflik hanya menghasilkan LOW bila empat faktor lengkap dan kompleksitas SIMPLE; selain itu UNKNOWN. Ini risiko pelaksanaan awal, bukan risiko usaha keseluruhan. Seluruh label memiliki alasan dan batasan.

Snapshot mengandung fingerprint HMAC profil lengkap, referensi, sumber, hipotesis, estimasi, model, versi. Berlaku 24 jam. Penyimpanan analisis menggunakan row lock dan fingerprint hipotesis untuk mencegah overwrite hasil konkurensi. Reanalysis Existing diperbolehkan, termasuk saved, tetapi tidak menimpa roadmap lama. Roadmap dibuat idempotent untuk fingerprint analisis tertentu setelah saved, analisis lengkap dan fresh; lima tahap, tindakan, tujuan, timeline dan output. Snapshot lama tetap dapat dibaca dengan penanda bila sumber analisis berubah. Unsave tidak menghapus roadmap; delete dengan konfirmasi menghapus seluruh hipotesis privat sesuai amendment Existing yang berlaku.

Finder, Saved dan library roadmap Existing memakai pagination 12 + lookahead. Compare 2–3 hipotesis Existing menampilkan faktor, cakupan, risiko, kompetisi, evidence dan perbedaan konteks, tanpa pemenang otomatis.

Query Trend Radar/Finder Existing dapat dipilih eksplisit dari nama bisnis, kategori atau produk profil saat ini. Client mengirim key, bukan query bebas; server menyelesaikan key terhadap profil pemilik. Default tetap nama bisnis, perubahan membersihkan hasil sebelumnya, dan tidak memanggil provider otomatis. Ini menggantikan larangan selector pada amendment 18 Oktober khusus Existing. Entrepreneur tidak berubah.

Validasi: unit formula/null/batas, owner/role, concurrency, pagination, route, UI state; typecheck dan pengujian regresi. QA browser desktop/mobile mencakup Analyze, Save, Compare dan Growth Roadmap dengan bukti sintetis yang dilabeli.

## Hasil verifikasi 22 Oktober 2026

- Regresi penuh: 171 file passed, 5 skipped; 1.345 tes passed, 42 skipped. Tes opsional provider/lingkungan tidak diaktifkan oleh run ini.
- Setelah perubahan berikutnya, pengujian terarah analisis bisnis, repository, formula, generator, UI, Trend Radar dan API dijalankan kembali: 49 tes passed, kemudian 20 tes passed pada pemeriksaan tambahan. Angka ini adalah run terpisah, bukan total unik.
- Integrasi PostgreSQL 18: 11 tes passed, di database disposable dengan seluruh 20 migrasi repository yang sudah ada. Tidak ada migrasi aplikasi baru.
- Browser Chromium: desktop 1365×900 dan mobile 390×844 passed; tablet 820×1180 passed pada run terpisah. Alur: login/onboarding Existing, profil, selector produk tanpa request provider otomatis, Saved halaman 6 dari 62 hipotesis, detail Business Fit, penolakan analisis ketika provider pengujian dinonaktifkan dengan hasil lama tetap tampil, Compare, pembuatan Growth Roadmap melalui POST nyata, library dan pembukaan kembali, unsave/save. Pemeriksaan overflow lulus pada skenario yang diuji. Screenshot tablet dipertahankan di artifacts/existing-business-qa.
- Build produksi Next.js, TypeScript dan lint file implementasi passed. Build/QA menggunakan direktori .next-e2e agar server development pengguna tidak dihentikan. Include/type imports yang dibuat otomatis saat QA dikembalikan ke direktori development normal.
- Semua data browser merupakan fixture sintetis berlabel. Tidak dilakukan panggilan SearchApi/9Router berbayar, benchmark model nyata, pengujian seluruh browser/perangkat fisik, atau kalibrasi empiris skor. Formula/grounding dan kegagalan parsial provider diuji melalui dependency injection; keberhasilan inferensi langsung bukan klaim dari QA ini.

Perubahan dokumen BRD, PRD, FSD, API dan Database menautkan kontrak ini. Snapshot menyimpan konteks rencana terbatas (nama bisnis, nama produk dan kanal), tanpa raw profil lengkap, prompt, atau histori penuh. Analisis memeriksa ulang fingerprint profil setelah provider selesai; hasil dari profil yang berubah tidak dipersist sebagai analisis terbaru.

## Existing analysis grounding and Compare correction (22 October 2026)

F01/F02 remediation: the selected hypothesis is the fixed analysis subject. Before scoring or persistence, a separate bounded semantic review checks summary, rationale, initial needs, assumptions and target/channel suggestions against that subject. Its response binds the exact selected title and candidate summary. Only ALIGNED is accepted; explicit CONCEPT_DRIFT permits one corrected generation and a fresh review. UNCERTAIN, invalid review and unavailable review fail closed without replacing the stored analysis. No transport/schema/reference failure triggers the concept-retry branch. The entire attempt shares a 160-second deadline and request cancellation. Model review is a guard, not a guarantee of semantic correctness; live sampling remains necessary.

Accepted snapshots add optional conceptAlignmentVersion = business-concept-alignment-v1 to existing JSONB. Fingerprints include that version. Legacy snapshots remain stored, but their scores are hidden pending reanalysis and cannot enter Compare or create a new Growth Roadmap. Stored roadmaps remain readable. No migration, provider configuration change or Entrepreneur contract change. Normal partial-data behavior keeps missing factors unknown. Target segments may differ from the profile when relevant to the selected concept.

Compare uses fresh, complete, reviewed Existing analyses. It displays the query, one-year geography context, direction from recent versus previous mean, relative stability, actual complexity/value and rationale, with explicit missing data and optional factor detail. A changed query/geography is flagged. Direction is descriptive, not a sales-growth/lifecycle classification. Back navigation respects from=saved or finder. Score weights remain unchanged.
