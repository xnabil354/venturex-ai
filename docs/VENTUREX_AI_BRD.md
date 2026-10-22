# BUSINESS REQUIREMENT DOCUMENT (BRD)

Product Owner implementation amendment, 21 October 2026: complete the private entrepreneur journey with mandatory exploration product, preliminary risk indicator, paginated archives, owner-scoped Compare and Startup Roadmap from reviewed saved hypotheses. See `Entrepreneur MVP Completion.md` for policy, contracts and acceptance. This connects the active private flow without publishing hypotheses into the archived catalog.
## VENTUREX AI — Future Trend Intelligence & Business Growth Navigator

**Dokumen:** Business Requirement Document (BRD)
**Versi:** 2.0
**Status:** Revised MVP Baseline
**Kategori Solusi:** AI-Powered Business Opportunity Intelligence & Decision Support Platform
**Industri Fokus:** Food & Beverage (F&B)
**Target Pengguna:** Calon Pengusaha F&B dan UMKM F&B yang sudah berjalan
**Platform:** Web Fullstack
**Fokus SDG:** SDG 8 — Digital Innovation for Economic Challenges

---

# 1. Document Control

## 1.1 Tujuan Dokumen

Business Requirement Document (BRD) ini menjadi acuan bisnis utama untuk pengembangan VENTUREX AI.

Dokumen menjelaskan:

- masalah bisnis yang ingin diselesaikan;
- target pengguna;
- kebutuhan calon pengusaha dan UMKM existing;
- tujuan bisnis;
- ruang lingkup MVP;
- kebutuhan bisnis utama;
- aturan bisnis;
- kebutuhan data dan AI;
- user journey;
- indikator keberhasilan;
- risiko;
- acceptance criteria.

BRD ini menjadi dasar sebelum masuk ke tahap PRD/SRS, UI/UX, database, arsitektur sistem, API, pengembangan frontend-backend, testing, dan deployment.

---

# 2. Executive Summary

VENTUREX AI adalah platform web berbasis AI yang membantu pengguna di sektor **Food & Beverage (F&B)** dalam dua kondisi:

1. **Calon Pengusaha F&B**
   Pengguna yang ingin memulai usaha F&B tetapi masih kesulitan menentukan peluang produk, target konsumen, tingkat persaingan, kebutuhan awal, dan langkah memulai usaha.

2. **UMKM F&B yang Sudah Berjalan**
   Pengguna yang sudah memiliki bisnis F&B dan membutuhkan bantuan untuk membaca tren pasar, menemukan peluang menu atau produk baru, menganalisis relevansinya terhadap bisnis, dan menentukan langkah pengembangan berikutnya.

VENTUREX tidak hanya memberikan ide melalui AI. Sistem dirancang sebagai **business decision support platform** yang menghubungkan:

**Profil Pengguna + Data Tren + Analisis Peluang + AI Explanation + Action Roadmap**

VENTUREX memiliki dua jalur utama:

### Untuk Calon Pengusaha
**DISCOVER → ANALYZE → START**

Mencari peluang → menganalisis kelayakan awal → mendapatkan roadmap memulai usaha.

### Untuk UMKM Existing
**DISCOVER → ANALYZE → GROW**

Mencari peluang → menganalisis kecocokan dengan bisnis → mendapatkan roadmap pengembangan.

VENTUREX tidak menjamin keberhasilan bisnis. Seluruh rekomendasi berfungsi sebagai pendukung keputusan berdasarkan data dan konteks yang tersedia.

---

# 3. Background dan Business Context

## 3.1 Latar Belakang

Industri Food & Beverage memiliki perubahan tren yang cepat. Preferensi konsumen, menu populer, bahan makanan, konsep produk, harga, pola konsumsi, dan tingkat persaingan dapat berubah dalam waktu relatif singkat.

Permasalahan tersebut dirasakan oleh dua kelompok.

### A. Calon Pengusaha F&B

Calon pengusaha sering memiliki minat dan modal, tetapi belum memahami:

- produk apa yang memiliki peluang;
- tren mana yang hanya viral dan mana yang cukup relevan;
- siapa target konsumennya;
- tingkat persaingannya;
- kisaran kebutuhan modal;
- langkah validasi sebelum benar-benar membuka usaha.

Akibatnya, keputusan awal sering dibuat berdasarkan tren sesaat, rekomendasi orang lain, atau asumsi pribadi.

### B. UMKM F&B Existing

UMKM yang sudah berjalan menghadapi masalah berbeda, seperti:

- sulit mengetahui perubahan preferensi konsumen;
- sulit menentukan menu baru;
- sulit melihat peluang pengembangan;
- informasi tren tersebar;
- keterbatasan waktu untuk melakukan market research;
- kesulitan menerjemahkan informasi menjadi tindakan.

VENTUREX dirancang untuk melayani kedua kebutuhan tersebut dalam satu platform dengan alur yang berbeda.

## 3.2 Kesesuaian dengan SDG 8

VENTUREX mendukung **SDG 8 — Digital Innovation for Economic Challenges** melalui:

- dukungan terhadap lahirnya usaha F&B yang lebih terarah;
- penguatan UMKM yang telah berjalan;
- pemanfaatan teknologi digital untuk pengambilan keputusan;
- optimalisasi pengembangan produk;
- perluasan pemahaman pasar;
- peningkatan akses terhadap business intelligence sederhana.

## 3.3 Business Opportunity

VENTUREX tidak berhenti pada pertanyaan:

> “Apa yang sedang tren?”

Tetapi membantu menjawab dua pertanyaan bisnis:

### Calon Pengusaha

> “Dengan kondisi saya, peluang usaha F&B apa yang layak saya pertimbangkan dan bagaimana cara memulainya?”

### UMKM Existing

> “Dengan kondisi bisnis saya saat ini, peluang apa yang relevan untuk dikembangkan dan apa langkah berikutnya?”

---

# 4. Problem Statement

## 4.1 Masalah Calon Pengusaha

Calon pengusaha F&B sering kesulitan mengubah minat, modal, lokasi, dan informasi tren menjadi pilihan usaha yang lebih terarah dan dapat divalidasi.

### Permasalahan Turunan

1. Bingung memilih jenis produk atau usaha F&B.
2. Sulit mengetahui apakah tren memiliki peluang atau hanya viral sementara.
3. Tidak mengetahui target konsumen yang sesuai.
4. Tidak memiliki gambaran awal mengenai kompetitor.
5. Sulit menyesuaikan peluang dengan modal yang tersedia.
6. Tidak mengetahui langkah validasi sebelum membuka usaha.
7. Informasi bisnis tersebar di berbagai sumber.

## 4.2 Masalah UMKM Existing

UMKM F&B yang sudah berjalan sering kesulitan membaca perubahan pasar dan menerjemahkan informasi tren menjadi keputusan pengembangan bisnis.

### Permasalahan Turunan

1. Sulit mengetahui tren F&B yang relevan.
2. Tidak semua tren sesuai dengan karakter bisnis.
3. Kesulitan memilih menu atau produk baru.
4. Analisis kompetitor masih terbatas.
5. Informasi konsumen tidak terstruktur.
6. Pengembangan produk sering berdasarkan intuisi.
7. Tidak mengetahui prioritas langkah setelah peluang ditemukan.

---

# 5. Business Need

VENTUREX harus menyediakan satu platform yang dapat memberikan pengalaman berbeda berdasarkan status pengguna.

## 5.1 Business Need — Calon Pengusaha

Sistem dibutuhkan untuk membantu pengguna:

- membentuk profil kesiapan bisnis;
- melihat tren F&B;
- menemukan peluang usaha;
- mencocokkan peluang dengan modal, minat, lokasi, dan target pasar;
- membandingkan beberapa peluang;
- memahami risiko awal;
- memperoleh Startup Roadmap.

## 5.2 Business Need — UMKM Existing

Sistem dibutuhkan untuk membantu pengguna:

- menyimpan profil bisnis;
- melihat tren relevan;
- menemukan peluang produk/menu baru;
- menganalisis kecocokan peluang;
- melihat target konsumen dan kompetisi;
- memahami risiko;
- memperoleh Growth Roadmap.

---

# 6. Product Vision

## 6.1 Vision Statement

> **Menjadi platform AI yang membantu calon pengusaha dan UMKM Food & Beverage menemukan peluang yang lebih relevan serta mengambil keputusan bisnis secara lebih terarah berdasarkan data.**

## 6.2 Value Proposition — Calon Pengusaha

> **VENTUREX membantu calon pengusaha F&B menemukan peluang usaha yang sesuai dengan kondisi mereka, memahami potensi dan risikonya, serta memperoleh langkah validasi sebelum memulai bisnis.**

## 6.3 Value Proposition — UMKM Existing

> **VENTUREX membantu UMKM F&B memahami tren pasar, menemukan peluang pengembangan produk, menganalisis kecocokannya, dan menentukan langkah pertumbuhan berikutnya.**

## 6.4 Product Principles

VENTUREX harus:

- sederhana;
- actionable;
- relevan terhadap konteks pengguna;
- berbasis data/evidence;
- transparan;
- mudah dipahami pengguna non-teknis;
- tidak memberikan klaim keberhasilan pasti;
- menempatkan keputusan akhir pada pengguna.

---

# 7. Business Objectives

## BO-01 — Meningkatkan Akses Market Insight

Memberikan informasi tren dan peluang F&B dalam satu platform yang mudah dipahami.

## BO-02 — Membantu Opportunity Discovery

Membantu calon pengusaha menemukan peluang usaha dan UMKM existing menemukan peluang pengembangan.

## BO-03 — Meningkatkan Relevansi Rekomendasi

Menyesuaikan rekomendasi berdasarkan profil pengguna, bukan hanya berdasarkan tren umum.

## BO-04 — Mendukung Pengambilan Keputusan

Menyediakan indikator, analisis, risiko, dan evidence untuk membantu pengguna menilai peluang.

## BO-05 — Mengubah Insight Menjadi Action

Memberikan roadmap yang dapat digunakan untuk melakukan validasi dan langkah bisnis berikutnya.

## BO-06 — Mendukung Digitalisasi Ekonomi F&B

Menyediakan business intelligence sederhana untuk pengguna yang belum memiliki akses terhadap alat analitik profesional.

---

# 8. Target User

VENTUREX MVP memiliki **dua primary user segment**.

## 8.1 User Segment A — Calon Pengusaha F&B

Pengguna yang:

- belum memiliki bisnis aktif;
- memiliki ketertarikan pada F&B;
- memiliki modal atau range budget tertentu;
- ingin mengetahui peluang usaha;
- membutuhkan panduan validasi dan langkah awal.

### Informasi Minimum

Pengguna minimal memberikan:

- lokasi;
- minat/kategori;
- estimasi modal;
- target konsumen yang diminati;
- preferensi channel;
- tingkat pengalaman;
- waktu/kesiapan menjalankan bisnis.

## 8.2 User Segment B — UMKM F&B Existing

Pengguna yang:

- sudah memiliki bisnis;
- memiliki produk/menu;
- memiliki pelanggan;
- ingin mengembangkan bisnis;
- membutuhkan insight pasar.

### Informasi Minimum

Pengguna minimal memberikan:

- nama bisnis;
- kategori;
- lokasi;
- produk/menu;
- target konsumen;
- price range;
- sales channel.

## 8.3 Out of Target MVP

MVP tidak difokuskan pada:

- perusahaan F&B enterprise;
- bisnis non-F&B;
- ERP operations;
- accounting;
- supply chain management;
- investasi atau financial trading.

---

# 9. User Persona

## 9.1 Persona A — Calon Pengusaha F&B

**Status:** Belum memiliki usaha aktif
**Tujuan:** Menemukan peluang F&B yang realistis untuk dimulai
**Kondisi:** Memiliki minat dan budget tetapi belum yakin memilih bisnis

### Goals

- menemukan peluang usaha;
- mengetahui target pasar;
- menyesuaikan peluang dengan modal;
- memahami risiko awal;
- mengetahui cara memulai.

### Pain Points

- terlalu banyak ide;
- tidak tahu tren yang relevan;
- takut salah memilih produk;
- tidak tahu langkah validasi.

---

## 9.2 Persona B — Pemilik UMKM F&B

**Status:** Usaha sudah berjalan
**Tujuan:** Mengembangkan produk dan bisnis
**Kondisi:** Memiliki pelanggan dan produk tetapi membutuhkan arah pengembangan

### Goals

- mengikuti perubahan pasar;
- menemukan peluang menu baru;
- memahami konsumen;
- meningkatkan kemampuan pengambilan keputusan.

### Pain Points

- informasi tersebar;
- sulit memilih tren;
- tidak tahu peluang yang cocok;
- pengembangan masih berdasarkan asumsi.

---

# 10. Product Concept

VENTUREX mempunyai satu intelligence engine tetapi dua user journey.

## 10.1 Shared Stage — DISCOVER

Sistem membantu menemukan:

- tren F&B;
- emerging products;
- rising ingredients;
- consumer interest;
- opportunity categories.

## 10.2 Shared Stage — ANALYZE

Sistem menganalisis:

- trend strength;
- target consumer;
- competition;
- market signal;
- risk;
- personal/business fit;
- feasibility;
- evidence.

## 10.3 Path A — START

Digunakan untuk calon pengusaha.

Output:

- rekomendasi peluang;
- estimasi kebutuhan awal;
- target konsumen;
- risiko;
- validation checklist;
- Startup Roadmap.

## 10.4 Path B — GROW

Digunakan untuk UMKM existing.

Output:

- peluang produk/menu;
- business fit;
- competition insight;
- risk;
- Growth Roadmap;
- recommendation for experimentation.

---

# 11. Scope MVP

## 11.1 In Scope

1. Authentication.
2. User Type Selection.
3. Entrepreneur Profile untuk calon pengusaha.
4. Business Profile untuk UMKM existing.
5. Dashboard sesuai tipe pengguna.
6. Trend Radar.
7. Opportunity Finder.
8. Opportunity Detail.
9. AI Opportunity Analysis.
10. Opportunity Score.
11. Fit Score.
12. Risk Indicator.
13. Evidence / Source.
14. Save Opportunity.
15. Compare Opportunity.
16. Startup Roadmap untuk calon pengusaha.
17. Growth Roadmap untuk UMKM existing.
18. Responsive interface.
19. Backend.
20. Database.
21. AI integration.
22. Online deployment.

## 11.2 Out of Scope

Tidak termasuk:

- POS;
- inventory;
- accounting;
- payroll;
- procurement;
- supplier marketplace;
- payment gateway;
- loan service;
- delivery management;
- social media automation;
- ERP;
- CRM lengkap;
- automatic purchasing;
- native mobile app;
- advanced financial forecasting;
- autonomous business execution.

---

# 12. User Type Selection

Setelah registrasi, pengguna harus memilih kondisi saat ini.

```text
Apa tujuan Anda menggunakan VENTUREX?

[ Saya ingin memulai bisnis F&B ]
            atau
[ Saya sudah memiliki bisnis F&B ]
```

Pilihan tersebut menentukan onboarding dan rekomendasi berikutnya.

---

# 13. As-Is Business Process

## 13.1 Calon Pengusaha Tanpa VENTUREX

```text
Ingin membuka bisnis
      ↓
Cari ide di internet/social media
      ↓
Melihat tren
      ↓
Bingung memilih
      ↓
Membandingkan secara manual
      ↓
Memilih berdasarkan asumsi
      ↓
Langsung mencoba bisnis
```

Risiko:

- tidak sesuai modal;
- salah target;
- mengikuti tren sesaat;
- tidak melakukan validasi.

## 13.2 UMKM Existing Tanpa VENTUREX

```text
Ingin mengembangkan usaha
      ↓
Mencari tren
      ↓
Melihat kompetitor
      ↓
Mengumpulkan informasi manual
      ↓
Memilih menu/produk
      ↓
Melakukan eksperimen
```

Risiko:

- memakan waktu;
- insight tidak terstruktur;
- pemilihan peluang kurang terukur.

---

# 14. To-Be Business Process

## 14.1 Calon Pengusaha

```text
REGISTER
   ↓
PILIH "CALON PENGUSAHA"
   ↓
ENTREPRENEUR PROFILE
   ↓
TREND RADAR
   ↓
OPPORTUNITY MATCHING
   ↓
OPPORTUNITY SCORE + FIT SCORE
   ↓
AI ANALYSIS
   ↓
COMPARE OPPORTUNITY
   ↓
STARTUP ROADMAP
   ↓
VALIDASI IDE
```

## 14.2 UMKM Existing

```text
REGISTER
   ↓
PILIH "SUDAH PUNYA BISNIS"
   ↓
BUSINESS PROFILE
   ↓
TREND RADAR
   ↓
OPPORTUNITY MATCHING
   ↓
BUSINESS FIT + OPPORTUNITY SCORE
   ↓
AI ANALYSIS
   ↓
GROWTH ROADMAP
   ↓
VALIDASI PENGEMBANGAN
```

---

# 15. High-Level User Journey

## 15.1 Journey A — Calon Pengusaha

### Step 1 — Register / Login

Pengguna membuat akun.

### Step 2 — Select User Type

Memilih:

**Saya ingin memulai bisnis F&B.**

### Step 3 — Entrepreneur Profile

Pengguna mengisi:

- lokasi;
- minat F&B;
- budget;
- pengalaman;
- preferred customer;
- sales channel;
- time commitment.

### Step 4 — Discover

Sistem menampilkan tren dan peluang yang relevan.

### Step 5 — Analyze

Pengguna membuka peluang dan melihat:

- Opportunity Score;
- Fit Score;
- target consumer;
- competition;
- risk;
- kebutuhan awal;
- evidence.

### Step 6 — Compare

Pengguna dapat membandingkan beberapa peluang.

### Step 7 — Start

Sistem membuat Startup Roadmap.

---

## 15.2 Journey B — UMKM Existing

### Step 1 — Register / Login

Pengguna membuat akun.

### Step 2 — Select User Type

Memilih:

**Saya sudah memiliki bisnis F&B.**

### Step 3 — Business Profile

Mengisi profil bisnis.

### Step 4 — Discover

Sistem menampilkan tren relevan.

### Step 5 — Analyze

Sistem menampilkan peluang yang cocok dengan bisnis.

### Step 6 — Compare

Pengguna dapat membandingkan peluang.

### Step 7 — Grow

Sistem membuat Growth Roadmap.

---

# 16. Business Requirements

## BR-001 — User Account

Sistem harus menyediakan register, login, logout, dan akun pengguna.

**Priority:** Must Have

---

## BR-002 — User Type Selection

Sistem harus meminta pengguna memilih:

1. Calon Pengusaha F&B; atau
2. Pemilik UMKM F&B Existing.

Pilihan digunakan untuk menyesuaikan onboarding dan rekomendasi.

**Priority:** Must Have

---

## BR-003 — Entrepreneur Profile

Untuk calon pengusaha, sistem minimal menyimpan:

- location;
- interest/category;
- estimated budget;
- experience level;
- target customer preference;
- preferred sales channel;
- time commitment.

**Priority:** Must Have

---

## BR-004 — Business Profile

Untuk UMKM existing, sistem minimal menyimpan:

- business name;
- category;
- location;
- current products;
- target consumer;
- average price range;
- sales channel.

**Priority:** Must Have

---

## BR-005 — Profile Update

Pengguna harus dapat memperbarui profilnya.

**Priority:** Must Have

---

## BR-006 — Trend Radar

Sistem harus menampilkan tren Food & Beverage dari sumber data yang tersedia.

Minimal menampilkan:

- trend name;
- category;
- direction;
- period;
- source;
- updated date.

**Priority:** Must Have

---

## BR-007 — Personalized Trend Relevance

Sistem harus dapat menyaring atau mengurutkan tren berdasarkan profil pengguna.

**Priority:** Must Have

---

## BR-008 — Opportunity Finder

Sistem harus menghasilkan peluang bisnis atau produk F&B.

### Calon Pengusaha

Peluang berupa:

- jenis produk;
- konsep bisnis;
- product opportunity.

### UMKM Existing

Peluang berupa:

- menu baru;
- product extension;
- variant opportunity;
- market opportunity.

**Priority:** Must Have

---

## BR-009 — Opportunity Detail

Setiap opportunity minimal memiliki:

- opportunity name;
- description;
- related trend;
- target consumer;
- competition;
- risk;
- opportunity score;
- fit score;
- reason;
- evidence.

**Priority:** Must Have

---

## BR-010 — Opportunity Score

Sistem memberikan indikator untuk membandingkan attractiveness sebuah peluang.

Contoh:

**Opportunity Score: 82/100**

Score bukan probabilitas keberhasilan.

**Priority:** Must Have

---

## BR-011 — Fit Score

Sistem memberikan indikator kesesuaian peluang terhadap profil pengguna.

### Calon Pengusaha

Dipengaruhi misalnya oleh:

- budget;
- location;
- interest;
- experience;
- execution feasibility.

### UMKM Existing

Dipengaruhi misalnya oleh:

- current business category;
- current products;
- consumer segment;
- price range;
- sales channel.

**Priority:** Must Have

---

## BR-012 — Risk Indicator

Sistem harus menampilkan risiko dasar suatu peluang.

Contoh:

- Low;
- Medium;
- High.

Risiko dapat berkaitan dengan:

- competition;
- required capital;
- trend volatility;
- execution complexity;
- market uncertainty.

**Priority:** Must Have

---

## BR-013 — AI Opportunity Analysis

AI harus menjelaskan opportunity menggunakan bahasa sederhana.

Minimal:

- why this opportunity;
- why it fits;
- target consumer;
- potential;
- competition;
- risks;
- next action.

**Priority:** Must Have

---

## BR-014 — Evidence and Source

Insight berbasis data eksternal harus menyertakan sumber atau evidence yang relevan.

**Priority:** Must Have

---

## BR-015 — Compare Opportunities

Pengguna harus dapat membandingkan minimal dua opportunity berdasarkan:

- Opportunity Score;
- Fit Score;
- trend;
- competition;
- risk;
- execution feasibility.

**Priority:** Should Have

---

## BR-016 — Save Opportunity

Pengguna dapat menyimpan opportunity.

**Priority:** Should Have

---

## BR-017 — Startup Roadmap

Untuk calon pengusaha, sistem harus menghasilkan roadmap untuk menguji dan memulai peluang.

Minimal:

- stage;
- action;
- objective;
- estimated cost/range bila tersedia;
- timeline;
- expected output.

Contoh:

1. market validation;
2. competitor checking;
3. prototype;
4. test selling;
5. evaluation;
6. initial launch decision.

**Priority:** Must Have

---

## BR-018 — Growth Roadmap

Untuk UMKM existing, sistem harus menghasilkan roadmap pengembangan.

Contoh:

1. customer survey;
2. prototype new menu;
3. limited test selling;
4. margin review;
5. feedback analysis;
6. rollout decision.

**Priority:** Must Have

---

## BR-019 — Personalized Dashboard

Dashboard harus menyesuaikan tipe pengguna.

### Dashboard Calon Pengusaha

Minimal:

- recommended opportunities;
- trending F&B;
- saved opportunities;
- Startup Roadmap status.

### Dashboard UMKM Existing

Minimal:

- business summary;
- relevant trends;
- growth opportunities;
- saved opportunities;
- Growth Roadmap.

**Priority:** Must Have

---

# 17. Business Rules

## RULE-001

Pengguna harus memilih tipe pengguna saat onboarding.

## RULE-002

Calon pengusaha dan UMKM existing menggunakan data profile yang berbeda.

## RULE-003

VENTUREX hanya memberikan decision support.

## RULE-004

Tidak boleh menyatakan suatu bisnis atau produk pasti berhasil.

## RULE-005

Opportunity Score bukan probability of success.

## RULE-006

Fit Score menggambarkan kesesuaian berdasarkan data pengguna yang tersedia, bukan jaminan keberhasilan.

## RULE-007

AI tidak boleh membuat fakta pasar tanpa dasar data.

## RULE-008

Jika data tidak cukup, sistem harus menyatakan keterbatasan analisis.

## RULE-009

Rekomendasi harus mempertimbangkan profil pengguna.

## RULE-010

Insight berbasis data eksternal harus memiliki source reference bila tersedia.

## RULE-011

Keputusan akhir tetap dilakukan pengguna.

## RULE-012

Scope MVP hanya Food & Beverage.

---

# 18. Opportunity Scoring Concept

Opportunity Score digunakan untuk menunjukkan attractiveness relatif suatu peluang.

Komponen awal dapat mencakup:

| Faktor | Fungsi |
|---|---|
| Trend Momentum | Melihat arah perkembangan tren |
| Demand Signal | Mengukur indikasi minat pasar |
| Competition | Mengukur kondisi persaingan |
| Consumer Relevance | Mengukur kecocokan target pasar |
| Execution Feasibility | Melihat kemudahan implementasi |
| Market Sustainability | Mengurangi ketergantungan pada tren sesaat |

Bobot final ditentukan pada tahap desain analitik.

Score harus memiliki penjelasan.

---

# 19. Fit Scoring Concept

## 19.1 Fit Score — Calon Pengusaha

Contoh faktor:

| Faktor | Fungsi |
|---|---|
| Budget Fit | Kesesuaian dengan modal |
| Interest Fit | Kesesuaian dengan minat |
| Location Fit | Relevansi lokasi |
| Experience Fit | Tingkat kesulitan dibanding pengalaman |
| Channel Fit | Kesesuaian cara penjualan |
| Time Fit | Kesesuaian kebutuhan waktu |

## 19.2 Fit Score — UMKM Existing

Contoh faktor:

| Faktor | Fungsi |
|---|---|
| Product Fit | Kesesuaian dengan produk saat ini |
| Customer Fit | Kesesuaian dengan pelanggan |
| Price Fit | Kesesuaian price range |
| Channel Fit | Kesesuaian channel |
| Operational Fit | Kemudahan diterapkan |
| Brand Fit | Kesesuaian dengan karakter usaha |

---

# 20. Data Requirements

## 20.1 User Account

- user_id;
- email;
- password hash;
- user_type;
- created_at.

## 20.2 Entrepreneur Profile

- user_id;
- location;
- interest;
- budget_range;
- experience_level;
- target_customer_preference;
- preferred_channel;
- time_commitment.

## 20.3 Business Profile

- user_id;
- business_name;
- business_category;
- location;
- product_list;
- target_customer;
- price_range;
- sales_channel.

## 20.4 Trend Data

- trend_id;
- name;
- category;
- period;
- direction;
- signal;
- source;
- updated_at.

## 20.5 Opportunity Data

- opportunity_id;
- name;
- category;
- related_trend;
- opportunity_score;
- fit_score;
- target_consumer;
- competition;
- risk;
- reason;
- evidence.

## 20.6 Roadmap

- roadmap_id;
- user_id;
- opportunity_id;
- roadmap_type;
- stage;
- action;
- objective;
- timeline;
- expected_output.

---

# 21. Potential Data Sources

Sumber dapat berasal dari:

- Google Trends atau sumber trend data yang tersedia secara legal;
- data pemerintah;
- open datasets;
- berita;
- sumber ekonomi;
- sumber pasar yang memiliki izin;
- prepared dataset untuk prototype;
- input pengguna.

Prinsip:

> **Official, legal, transparent, and explainable first.**

MVP tidak boleh bergantung pada scraping yang melanggar Terms of Service platform lain.

---

# 22. AI Requirements

## AI-01 — Context Awareness

AI harus mengetahui apakah pengguna adalah calon pengusaha atau UMKM existing.

## AI-02 — Grounded Analysis

Output harus berdasarkan:

- user profile;
- opportunity data;
- trend data;
- evidence yang tersedia.

## AI-03 — Explainability

AI harus menjelaskan alasan rekomendasi secara sederhana.

## AI-04 — Structured Output

Format minimal:

- opportunity summary;
- relevance;
- target consumer;
- competition;
- risk;
- recommendation;
- next steps.

## AI-05 — No Unsupported Claim

AI tidak boleh mengarang angka atau fakta pasar.

## AI-06 — Human Decision

AI berfungsi sebagai advisor, bukan pengambil keputusan otomatis.

---

# 23. Non-Functional Requirements

## NFR-01 — Usability

Dapat digunakan oleh pengguna non-teknis.

## NFR-02 — Responsive

Desktop, tablet, dan mobile browser.

## NFR-03 — Performance

Respons sistem berada pada waktu yang layak untuk penggunaan aplikasi web.

## NFR-04 — Security

Authentication, authorization, dan perlindungan data pengguna.

## NFR-05 — Privacy

Profil pengguna tidak boleh diakses user lain.

## NFR-06 — Reliability

Core flow harus stabil saat demo.

## NFR-07 — Explainability

User dapat memahami alasan rekomendasi.

## NFR-08 — Maintainability

Sistem mudah dikembangkan setelah MVP.

## NFR-09 — Graceful Fallback

Jika API eksternal gagal, sistem tetap dapat menjalankan demo menggunakan data fallback/cached/prepared dataset.

---

# 24. MVP Prioritization — MoSCoW

## MUST HAVE

- Register/Login
- User Type Selection
- Entrepreneur Profile
- Business Profile
- Dashboard
- Trend Radar
- Opportunity Finder
- Opportunity Detail
- Opportunity Score
- Fit Score
- Risk Indicator
- AI Analysis
- Evidence
- Startup Roadmap
- Growth Roadmap
- Backend
- Database
- Deployment

## SHOULD HAVE

- Compare Opportunities
- Save Opportunity
- Confidence Indicator
- User History

## COULD HAVE

- roadmap progress tracking;
- advanced visualization;
- recommendation feedback;
- regional trend filtering;
- opportunity history.

## WON'T HAVE IN MVP

- POS;
- ERP;
- accounting;
- inventory;
- procurement;
- native mobile app;
- payment gateway;
- supplier marketplace;
- autonomous decision making.

---

# 25. Key Screens

1. Landing Page
2. Register
3. Login
4. User Type Selection
5. Entrepreneur Profile Setup
6. Business Profile Setup
7. Personalized Dashboard
8. Trend Radar
9. Opportunity Explorer
10. Opportunity Detail
11. Compare Opportunities
12. Startup Roadmap
13. Growth Roadmap
14. Saved Opportunities
15. Profile / Settings

---

# 26. Example Use Case A — Calon Pengusaha

## Kondisi

Pengguna:

- belum memiliki bisnis;
- lokasi Jakarta;
- tertarik pada minuman;
- modal Rp10 juta;
- target anak muda;
- ingin berjualan online + offline.

## Sistem

VENTUREX membaca profil dan trend data.

Sistem menghasilkan beberapa opportunity.

### Contoh Output

**Opportunity:** Matcha Takeaway Beverage
**Opportunity Score:** 83/100
**Fit Score:** 86/100
**Competition:** Medium
**Risk:** Medium

### Why It Fits

- kategori sesuai minat;
- range modal relatif sesuai asumsi model;
- target konsumen cocok;
- execution complexity masih dapat diuji melalui MVP sederhana.

### Startup Roadmap

**Week 1**
Validasi target konsumen.

**Week 2**
Survey kompetitor dan supplier.

**Week 3**
Buat prototype 2–3 menu.

**Week 4**
Test selling.

**Week 5**
Evaluasi demand, feedback, dan margin.

**Week 6**
Go / Revise / Stop Decision.

---

# 27. Example Use Case B — UMKM Existing

## Kondisi

Pengguna memiliki coffee shop.

- lokasi Jakarta;
- produk utama coffee;
- target 18–30 tahun;
- price range Rp20.000–Rp40.000.

## Sistem

VENTUREX menemukan opportunity relevan.

### Contoh Output

**Opportunity:** Matcha Latte Series
**Opportunity Score:** 84/100
**Business Fit:** 88/100
**Competition:** Medium
**Risk:** Medium

### Growth Roadmap

**Week 1**
Survey pelanggan existing.

**Week 2**
Buat dua prototype.

**Week 3**
Limited test selling.

**Week 4**
Evaluasi feedback dan margin.

**Week 5**
Rollout / Revise / Stop.

---

# 28. Business Success Metrics

## 28.1 MVP / Hackathon Metrics

MVP dianggap berhasil apabila:

- dua tipe user dapat onboarding;
- profile masing-masing tersimpan;
- trend dapat ditampilkan;
- recommendation dapat dibuat;
- Opportunity Score tampil;
- Fit Score tampil;
- AI dapat menjelaskan recommendation;
- Startup Roadmap bekerja;
- Growth Roadmap bekerja;
- aplikasi dapat diakses online;
- core flow stabil.

## 28.2 Future Product Metrics

- Opportunity View Rate;
- Opportunity Save Rate;
- Comparison Usage;
- Roadmap Generation Rate;
- Recommendation Acceptance Rate;
- Validation Completion Rate;
- User Retention;
- Time to Decision;
- User Satisfaction.

Tidak boleh mengklaim peningkatan omzet atau keberhasilan bisnis sebelum terdapat data pengguna nyata.

---

# 29. Competition Alignment

VENTUREX mendukung kebutuhan kompetisi melalui empat aspek.

## Innovation

Diferensiasi:

**Trend Data + User Context + Opportunity Intelligence + AI Explanation + Roadmap**

## UI/UX

Dua jenis user mendapat experience sesuai kebutuhan.

## Technical Implementation

MVP menunjukkan:

- frontend;
- backend;
- authentication;
- database;
- data processing;
- AI;
- scoring;
- deployment.

## Impact

### Untuk Calon Pengusaha

Membantu mengurangi keputusan awal yang hanya berdasarkan asumsi.

### Untuk UMKM Existing

Membantu menemukan peluang pengembangan yang lebih terarah.

---

# 30. Assumptions

1. Pengguna memberikan data profil secara benar.
2. Pengguna memahami bahwa rekomendasi bukan jaminan.
3. Data tren dapat diperoleh secara legal.
4. AI API tersedia.
5. Dataset fallback tersedia untuk demo.
6. MVP hanya F&B.
7. Analisis tidak menggantikan riset lapangan sepenuhnya.

---

# 31. Constraints

1. Waktu hackathon terbatas.
2. Data pasar lokal mungkin terbatas.
3. Tidak semua platform mempunyai public API.
4. AI berisiko hallucination.
5. Data real-time tidak selalu tersedia.
6. Financial estimate tidak boleh dibuat terlalu presisi tanpa data.
7. Tim harus menjaga scope agar tidak berubah menjadi ERP.

---

# 32. Dependencies

- data source;
- AI service;
- database;
- hosting;
- frontend/backend framework;
- source integration;
- internet connection;
- fallback dataset.

---

# 33. Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| AI hallucination | Informasi salah | Grounded AI + structured input |
| Trend dianggap jaminan | User salah memahami | Disclaimer |
| Fit Score disalahartikan | False confidence | Explain score |
| Data source gagal | Demo terganggu | Cached/fallback data |
| Data tidak fresh | Insight lemah | Timestamp |
| Scope terlalu besar | MVP tidak selesai | MoSCoW |
| Recommendation terlalu generik | Value rendah | Profile-based matching |
| User data bocor | Trust/security issue | Auth + authorization |
| Calon pengusaha dan UMKM tercampur | UX membingungkan | Separate onboarding flows |

---

# 34. Acceptance Criteria

MVP dinyatakan memenuhi BRD jika:

1. User dapat register/login.
2. User dapat memilih tipe pengguna.
3. Calon pengusaha dapat membuat Entrepreneur Profile.
4. UMKM dapat membuat Business Profile.
5. Profile tersimpan.
6. Trend Radar dapat ditampilkan.
7. Sistem dapat menghasilkan opportunity.
8. Opportunity Score tampil.
9. Fit Score tampil.
10. Risk indicator tampil.
11. AI dapat menjelaskan opportunity.
12. Evidence/source dapat ditampilkan.
13. Calon pengusaha dapat menghasilkan Startup Roadmap.
14. UMKM dapat menghasilkan Growth Roadmap.
15. User dapat menyimpan opportunity.
16. Compare dapat digunakan minimal dua opportunity bila fitur Should Have selesai.
17. Aplikasi responsive.
18. Aplikasi online.
19. Core flow dapat didemonstrasikan tanpa critical error.
20. Sistem tidak menjanjikan keberhasilan bisnis.

---

# 35. Requirement Traceability Matrix

| Business Objective | Requirements |
|---|---|
| BO-01 Market Insight | BR-006, BR-007, BR-014 |
| BO-02 Opportunity Discovery | BR-008, BR-009 |
| BO-03 Personalization | BR-002, BR-003, BR-004, BR-011 |
| BO-04 Decision Support | BR-010, BR-011, BR-012, BR-013 |
| BO-05 Actionable Decision | BR-017, BR-018 |
| BO-06 Digitalization | BR-001 s.d. BR-019 |

---

# 36. Proposed MVP Workflow

```text
                        USER
                          ↓
                REGISTER / LOGIN
                          ↓
                SELECT USER TYPE
                   ↙             ↘
          CALON PENGUSAHA      UMKM EXISTING
                 ↓                  ↓
       ENTREPRENEUR PROFILE    BUSINESS PROFILE
                   ↘             ↙
                     TREND RADAR
                          ↓
                  OPPORTUNITY FINDER
                          ↓
            OPPORTUNITY + FIT SCORING
                          ↓
                   AI ANALYSIS
                          ↓
              RISK + EVIDENCE + FIT
                          ↓
                COMPARE / SELECT
                   ↙             ↘
          STARTUP ROADMAP      GROWTH ROADMAP
                   ↘             ↙
                      USER ACTION
```

---

# 37. High-Level System Context

```text
                  EXTERNAL / MARKET DATA
                           ↓
                    DATA PROCESSING
                           ↓
                   TREND INTELLIGENCE
                           ↓
          ┌────────────────┴────────────────┐
          ↓                                 ↓
 ENTREPRENEUR PROFILE                BUSINESS PROFILE
          ↓                                 ↓
          └───────── OPPORTUNITY MATCHING ──┘
                           ↓
               OPPORTUNITY SCORING
                           ↓
                     FIT SCORING
                           ↓
                    AI REASONING
                           ↓
              EXPLAINED RECOMMENDATION
                           ↓
          ┌────────────────┴────────────────┐
          ↓                                 ↓
   STARTUP ROADMAP                   GROWTH ROADMAP
```

---

# 38. Definition of Done — MVP

MVP dianggap selesai apabila:

- frontend dan backend berjalan;
- database berjalan;
- authentication berjalan;
- dua user flow tersedia;
- profile tersimpan;
- trend data ditampilkan;
- opportunity dapat direkomendasikan;
- scoring dapat dihitung;
- AI analysis berjalan;
- Startup Roadmap berjalan;
- Growth Roadmap berjalan;
- aplikasi responsive;
- aplikasi deployed;
- repository tersedia;
- dokumentasi teknis tersedia;
- aplikasi stabil untuk live demo.

---

# 39. Future Development

## Phase 2

- roadmap progress tracking;
- regional trend analysis;
- deeper competitor analysis;
- feedback loop;
- historical opportunity tracking.

## Phase 3

### Calon Pengusaha

- business model assistant;
- advanced capital planning;
- break-even simulation;
- validation tracker.

### UMKM Existing

- sales integration;
- menu performance analysis;
- demand forecasting;
- multi-branch intelligence.

## Phase 4

- incubator dashboard;
- institution partnership;
- API;
- advanced business intelligence;
- collaborative workspace.

---

# 40. Key Business Decision

VENTUREX memiliki dua fungsi bisnis yang berbeda tetapi tetap berada di dalam satu produk.

## Calon Pengusaha

> **VENTUREX membantu memilih dan memvalidasi peluang sebelum usaha dimulai.**

## UMKM Existing

> **VENTUREX membantu menemukan dan memvalidasi peluang pertumbuhan setelah usaha berjalan.**

VENTUREX bukan:

- POS;
- ERP;
- accounting system;
- inventory system.

VENTUREX adalah:

> **AI-Powered F&B Business Opportunity Intelligence & Decision Support Platform.**

---

# 41. Final Product Definition

> **VENTUREX AI — Future Trend Intelligence & Business Growth Navigator adalah platform web berbasis AI yang membantu calon pengusaha dan UMKM Food & Beverage memahami tren pasar, menemukan peluang yang relevan, menganalisis potensi, kecocokan, kompetisi dan risiko, serta mendapatkan roadmap tindakan sesuai kondisi bisnis pengguna.**

---

# 42. Core Message

## Untuk Calon Pengusaha

**Discover → Analyze → Start**

> Temukan peluang → pahami peluang → validasi dan mulai.

## Untuk UMKM Existing

**Discover → Analyze → Grow**

> Temukan peluang → pahami kecocokan → kembangkan bisnis.

## Unified Value

> **Discover Trends. Analyze Opportunities. Start or Grow Smarter.**

---

# 43. Reference Basis

BRD versi 2.0 merupakan pengembangan dari BRD VENTUREX sebelumnya dengan perubahan utama:

1. Fokus industri tetap Food & Beverage.
2. Target tidak lagi hanya UMKM existing.
3. Ditambahkan **Calon Pengusaha F&B** sebagai primary user segment.
4. Dibuat dua onboarding dan user journey.
5. Ditambahkan Entrepreneur Profile.
6. Ditambahkan Fit Score untuk kebutuhan calon pengusaha.
7. Ditambahkan Startup Roadmap.
8. Growth Roadmap tetap digunakan untuk UMKM existing.
9. Sistem tetap diposisikan sebagai decision support, bukan pemberi jaminan bisnis.
10. Scope tetap dikendalikan agar realistis untuk MVP Fullstack Hackathon.

---

**END OF DOCUMENT**

## Product Owner decision amendment, 14 October 2026

For the local hackathon flow, Trend Radar uses manually requested live Google Trends observations through the configured Bright Data adapter. The 2025 curated catalog is retained as an archive and is not used as fallback or displayed in Dashboard, Trend Radar, or Opportunity Finder. AI-generated ideas are private, user-owned hypotheses, not globally published Opportunities. No automated publication is authorized.


## Entrepreneur review and permanent save amendment (21 October 2026)

For private ENTREPRENEUR hypotheses, saving moves from Finder cards to the bottom of the score-detail page after Opportunity Score, Fit Score, target consumers, competition, risks, initial needs and evidence. Profile fields are loaded from the authenticated account; opening a detail page makes no paid inference request. Explicit consent and an analysis action remain required. The only optional financial input here is the concept's estimated minimum capital, displayed as Rp with Indonesian thousands separators and submitted as a whole numeric rupiah amount. It is separate from the account's available budget.

PATCH /api/v1/opportunities/ideas keeps the existing {id, saved} fields and adds optional reviewed:true and analysisFingerprint (64 lowercase hexadecimal characters). Entrepreneur saves require reviewed:true, both numeric scores, structured concept requirements, and a current profile-bound analysis. The server compares the supplied fingerprint to the stored snapshot under a transaction row lock. Unknown/missing data is never replaced with invented scores to unlock saving. Conflicting or incomplete saves return 409 ANALYSIS_CHANGED or ANALYSIS_REQUIRED. Repeat saves are idempotent.

Once an entrepreneur hypothesis is saved, isSaved cannot return to false, DELETE is rejected with 409 SAVED_PERMANENT, and its analysis snapshot is immutable. Existing saved entrepreneur records are preserved and protected. Unsubmitted hypotheses remain deletable. UMKM behavior is outside this change. Data stays in existing user_generated_opportunities JSONB and saved fields, with no migration or TTL added; no provider call is needed to reopen stored scores. This amendment supersedes earlier unsave/delete instructions for private entrepreneur hypotheses only.

## Existing Pengusaha completion amendment (22 October 2026)

The authorized UMKM_EXISTING improvement is specified in [Existing Business Completion.md](Existing%20Business%20Completion.md). This adds business-specific private hypothesis analysis, deterministic preliminary Opportunity Score and Business Fit, reasoned execution risk, owner-scoped Compare, five-stage private Growth Roadmap and 12-item paginated archives. It does not alter Entrepreneur behavior or provider configuration. Optional businessAnalysis and growthRoadmap snapshots use existing hypothesis JSONB; no catalog foreign key or migration is introduced. POST /api/v1/opportunities/ideas/{id}/analysis dispatches by authenticated persona; Existing accepts strict {consent:true,refresh?:boolean,proposedPrice?:{min:integer,max:integer}|null}. POST /api/v1/opportunities/ideas/{id}/roadmap creates or reopens the owner's Growth snapshot; a new snapshot requires saved state, complete and fresh business analysis. Existing saves remain reversible, and stored roadmaps remain readable after unsave.

For Existing only, Trend Radar and Finder accept an optional queryKey: business (default), category, or product:0 through product:19. The server resolves it against the authenticated current profile and active category; client query text is never accepted. Selection is explicit and does not trigger provider requests. This supersedes the 18 October no-selector rule for Existing; Entrepreneur query behavior remains unchanged. Score weights, coverage, missing-data rules, risk thresholds, snapshot freshness and persistence behavior are defined in the linked configuration.


## Approved daily trend notification extension ? 22 October 2026

The product owner approved daily in-app digests and optional per-device Web Push for both user roles. Requirements NOTIF-001 through NOTIF-007, scheduling semantics, owner-scoped APIs, migration 021 and delivery limitations are specified in [Trend Notifications.md](Trend%20Notifications.md). This extension does not generate opportunities, scores or roadmaps automatically.


## Amendment: journey reports and roadmap completion (22 October 2026)

See [Journey Reports](Journey%20Reports.md) for the authorized two-persona PDF/XLSX export, explicit stage completion gate, owner-scoped progress persistence/API, and device support acceptance contract.
