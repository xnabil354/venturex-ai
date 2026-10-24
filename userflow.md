# User Flow — VENTUREX AI

Dokumen ini memetakan alur pengguna VENTUREX AI yang tersedia untuk dua persona: **Calon Pengusaha** dan **UMKM Existing**. Area dan tindakan **admin sengaja tidak dicakup**.

> Prinsip umum: seluruh halaman aplikasi memerlukan autentikasi dan onboarding lengkap. Data, skor, risiko, serta analisis adalah bantuan pengambilan keputusan—bukan jaminan keberhasilan bisnis.

## 1. Akses, autentikasi, dan onboarding

```mermaid
flowchart TD
    start([Mulai]) --> landing[Landing]
    landing --> register[Daftar akun]
    landing --> login[Login]
    register --> regValid{Input valid dan email belum digunakan?}
    regValid -- Tidak --> regError[Pesan validasi / email sudah digunakan] --> register
    regValid -- Ya --> regSuccess[Akun dibuat]
    regSuccess --> login
    login --> credentials{Kredensial valid?}
    credentials -- Tidak --> loginError[Pesan: email atau password tidak sesuai] --> login
    credentials -- Ya --> session[Sesi pengguna dibuat]
    session --> userType{Persona sudah dipilih?}
    userType -- Belum --> selectType[Pilih tujuan penggunaan]
    selectType --> confirmType{Konfirmasi pilihan persona}
    confirmType -- Ubah --> selectType
    confirmType -- Calon Pengusaha --> entrepreneurSetup[Isi profil calon pengusaha]
    confirmType -- UMKM Existing --> businessSetup[Isi profil bisnis]
    userType -- Sudah --> profileComplete{Profil wajib lengkap?}
    entrepreneurSetup --> entrepreneurValid{Profil valid?}
    entrepreneurValid -- Tidak --> entrepreneurSetup
    entrepreneurValid -- Ya --> dashboardE[Dashboard Calon Pengusaha]
    businessSetup --> businessValid{Profil valid?}
    businessValid -- Tidak --> businessSetup
    businessValid -- Ya --> dashboardB[Dashboard UMKM Existing]
    profileComplete -- Tidak; Calon Pengusaha --> entrepreneurSetup
    profileComplete -- Tidak; UMKM Existing --> businessSetup
    profileComplete -- Ya; Calon Pengusaha --> dashboardE
    profileComplete -- Ya; UMKM Existing --> dashboardB
    dashboardE --> logout[Logout]
    dashboardB --> logout
    logout --> landing
```

## 2. Jalur Calon Pengusaha — Discover → Analyze → Start

```mermaid
flowchart TD
    dashboard[Dashboard Calon Pengusaha] --> trends[Trend Radar]
    dashboard --> finder[Opportunity Finder]
    trends --> trendDetail[Detail tren dan evidence]
    trendDetail --> finder
    finder --> configure[Atur konteks pencarian / geografi]
    configure --> generate{Hipotesis tersedia atau dapat dibuat?}
    generate -- Tidak ada hasil --> noResults[Empty state dan ajakan ubah konteks / profil] --> configure
    generate -- Gagal --> finderError[Pesan kegagalan; data yang tersedia tetap dapat dibuka] --> finder
    generate -- Ya --> cards[Daftar hipotesis / opportunity]
    cards --> detail[Detail hipotesis milik pengguna]
    detail --> review[Pelajari konsep, target, kebutuhan, evidence, skor awal, Fit Score, dan risiko]
    review --> evidenceLimit{Evidence atau data skor cukup?}
    evidenceLimit -- Terbatas --> limited[Label keterbatasan / skor atau risiko dapat UNKNOWN] --> analysisChoice
    evidenceLimit -- Cukup --> analysisChoice{Lakukan analisis mendalam?}
    analysisChoice -- Belum --> saveChoice
    analysisChoice -- Ya, setuju --> consent[Berikan consent analisis]
    consent --> analyze[Analisis berbasis profil, histori pencarian, dan sampel pasar]
    analyze --> analysisResult{Analisis tersedia?}
    analysisResult -- Parsial / provider gagal --> partial[Gunakan hasil structured yang tersedia dan tampilkan batasan] --> saveChoice
    analysisResult -- Ya --> analysisView[Review insight, kebutuhan konsep, skor/faktor, risiko, evidence] --> saveChoice
    saveChoice{Simpan permanen?} -- Ya --> save[Hipotesis tersimpan] --> compareChoice
    saveChoice -- Tidak --> compareChoice
    compareChoice{Bandingkan 2–3 hipotesis yang dianalisis?} -- Ya --> compare[Compare: skor, cakupan, konteks, kompetisi, risiko, kebutuhan, evidence]
    compare --> selectWinner[Pilih hipotesis untuk ditindaklanjuti]
    compareChoice -- Tidak --> selectWinner
    selectWinner --> eligible{Hipotesis tersimpan, dianalisis, skor valid, dan milik pengguna?}
    eligible -- Tidak --> eligibilityHint[Perbaiki syarat: simpan / lengkapi analisis / kembali ke detail] --> detail
    eligible -- Ya --> startupRoadmap[Buat atau buka Startup Roadmap]
    startupRoadmap --> stages[Kerjakan 6 tahap validasi secara bertahap]
    stages --> stageProgress[Centang atau buka kembali status tahap]
    stageProgress --> allDone{Seluruh 6 tahap selesai?}
    allDone -- Belum --> stages
    allDone -- Ya --> report[Unduh laporan perjalanan PDF atau XLSX]
```

## 3. Jalur UMKM Existing — Discover → Analyze → Grow

```mermaid
flowchart TD
    dashboard[Dashboard UMKM Existing] --> trends[Trend Radar]
    dashboard --> finder[Opportunity Finder]
    trends --> trendDetail[Detail tren dan evidence]
    trendDetail --> finder
    finder --> sourceChoice[Pilih basis eksplorasi: nama bisnis, kategori, atau produk profil]
    sourceChoice --> query[Server menyelesaikan key terhadap profil bisnis]
    query --> results{Hipotesis pertumbuhan tersedia?}
    results -- Tidak ada hasil --> noResults[Empty state; ubah basis eksplorasi atau profil] --> sourceChoice
    results -- Gagal --> finderError[Pesan kegagalan; halaman tidak mengarang data] --> finder
    results -- Ya --> cards[Daftar hipotesis pertumbuhan]
    cards --> detail[Detail hipotesis milik pengguna]
    detail --> review[Pelajari konsep, estimasi harga, evidence, Opportunity Score, Business Fit, dan risiko]
    review --> analysisChoice{Lakukan analisis mendalam?}
    analysisChoice -- Belum --> saveChoice
    analysisChoice -- Ya, setuju --> consent[Berikan consent analisis]
    consent --> analyze[Analisis profil bisnis, histori sinyal, sampel pasar, dan validasi konsep]
    analyze --> analysisResult{Analisis lengkap, fresh, dan terverifikasi?}
    analysisResult -- Parsial / provider gagal --> partial[Tampilkan hasil yang tersedia beserta keterbatasan] --> saveChoice
    analysisResult -- Tidak; konsep tidak selaras --> correction[Perbaiki atau ulangi analisis sesuai guard] --> detail
    analysisResult -- Ya --> analysisView[Review faktor Business Fit, cakupan, kompleksitas, risiko, kompetisi, dan evidence] --> saveChoice
    saveChoice{Simpan hipotesis?} -- Ya --> save[Hipotesis tersimpan] --> compareChoice
    saveChoice -- Tidak --> compareChoice
    compareChoice{Bandingkan 2–3 hipotesis?} -- Ya --> compare[Compare tanpa pemenang otomatis; tampilkan perbedaan konteks dan data yang hilang]
    compare --> selectWinner[Pilih hipotesis untuk dikembangkan]
    compareChoice -- Tidak --> selectWinner
    selectWinner --> eligible{Tersimpan, analisis fresh/terverifikasi, dan milik pengguna?}
    eligible -- Tidak --> eligibilityHint[Lengkapi syarat lalu kembali ke detail] --> detail
    eligible -- Ya --> growthRoadmap[Buat atau buka Growth Roadmap]
    growthRoadmap --> stages[Kerjakan 5 tahap pertumbuhan]
    stages --> stageProgress[Centang atau buka kembali status tahap]
    stageProgress --> allDone{Seluruh 5 tahap selesai?}
    allDone -- Belum --> stages
    allDone -- Ya --> report[Unduh laporan perjalanan PDF atau XLSX]
```

## 4. Navigasi dan alur pendukung pengguna

```mermaid
flowchart LR
    app[Pengguna terautentikasi dan onboarding selesai]
    app --> dashboard[Dashboard sesuai persona]
    app --> trends[Trend Radar]
    app --> opportunities[Opportunities / Finder]
    app --> saved[Saved / arsip hipotesis]
    app --> roadmaps[Library roadmap]
    app --> profile[Profil]
    app --> billing[Billing]
    app --> notifications[Notifikasi]

    profile --> editProfile[Perbarui profil]
    editProfile --> refresh[Rekomendasi atau konteks berikutnya memakai profil terbaru]
    profile --> switchPersona[Ubah persona dengan konfirmasi]
    switchPersona --> onboarding[Setup profil persona tujuan]

    saved --> savedDetail[Buka detail, save/unsave, atau hapus hipotesis privat dengan konfirmasi]
    savedDetail --> compare[Tambahkan maksimum 3 item ke Compare]
    roadmaps --> roadmapDetail[Buka roadmap dan progresnya]

    notifications --> inbox[Baca inbox digest tren mingguan]
    inbox --> trendDetail[Buka konteks tren bila tersedia]
    notifications --> preference[Hanya aktifkan/nonaktifkan digest]
    preference --> pushChoice{Ingin Web Push?}
    pushChoice -- Ya --> preparePush[Klik pertama: siapkan service worker]
    preparePush --> subscribePush[Klik berikutnya: beri izin dan daftarkan perangkat]
    pushChoice -- Tidak / tidak didukung --> inbox

    billing --> entitlement[Lihat paket dan saldo kredit]
    entitlement --> paidAction{Aksi AI berbayar terkunci?}
    paidAction -- Tidak --> opportunities
    paidAction -- Ya --> checkout[Pilih paket atau top up]
    checkout --> duitku[Bayar di halaman hosted Duitku sandbox]
    duitku --> return[Halaman kembali: pembayaran sedang diverifikasi]
    return --> callback[Callback provider memverifikasi pembayaran]
    callback --> updated[Entitlement / kredit diperbarui]
    updated --> opportunities
```

## Aturan lintas alur

- User hanya dapat membaca atau mengubah profil, hipotesis, saved opportunity, roadmap, laporan, billing, dan notifikasi miliknya sendiri.
- Saat data jaringan dimuat, UI menyediakan state loading, sukses, kosong, dan error. Kegagalan provider/AI tidak boleh menghilangkan data structured yang masih tersedia.
- Compare memerlukan 2–3 item. Data dengan versi, cakupan, atau geografi yang berbeda tidak diberi pemenang otomatis.
- Menyimpan roadmap saja belum membuka laporan: seluruh tahap roadmap harus ditandai selesai oleh pengguna. Penyelesaian adalah deklarasi pengguna, bukan bukti keberhasilan bisnis.
- Notifikasi tidak otomatis membuat opportunity, analisis, skor, atau roadmap. Inbox tetap tersedia tanpa izin Web Push.
