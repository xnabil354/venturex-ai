# PRODUCT REQUIREMENT DOCUMENT (PRD)
## VENTUREX AI — Future Trend Intelligence & Business Growth Navigator

**Dokumen:** Product Requirement Document (PRD)
**Versi:** 1.0
**Status:** Draft Baseline untuk MVP Hackathon
**Sumber Utama:** Business Requirement Document (BRD) VENTUREX AI v2.0
**Produk:** VENTUREX AI
**Industri Fokus:** Food & Beverage (F&B)
**Platform:** Web Fullstack
**Target Pengguna:** Calon Pengusaha F&B dan UMKM F&B Existing
**Product Model:** AI-Powered Business Opportunity Intelligence & Decision Support Platform
**Fokus SDG:** SDG 8 — Digital Innovation for Economic Challenges

---

# 1. Document Purpose

## 1.1 Tujuan PRD

Product Requirement Document (PRD) ini menerjemahkan kebutuhan bisnis pada BRD VENTUREX AI v2.0 menjadi kebutuhan produk yang lebih spesifik, terukur, dapat diuji, dan dapat digunakan sebagai acuan oleh:

- Product Owner / Product Manager;
- System Analyst;
- Business Analyst;
- UI/UX Designer;
- Frontend Developer;
- Backend Developer;
- AI/ML Engineer;
- QA / Tester;
- DevOps / Deployment Engineer.

PRD menjawab pertanyaan:

> **Apa yang harus dibangun, bagaimana perilaku produk seharusnya bekerja, dan kapan suatu fitur dianggap selesai?**

PRD ini **tidak menggantikan BRD**. BRD tetap menjadi sumber kebutuhan bisnis utama, sedangkan PRD menjadi turunan untuk implementasi produk.

---

# 2. Source of Truth dan Traceability

## 2.1 BRD Reference

PRD ini mengacu pada BRD VENTUREX AI v2.0 yang menetapkan:

- dua tipe pengguna;
- fokus industri Food & Beverage;
- alur **Discover → Analyze → Start** untuk calon pengusaha;
- alur **Discover → Analyze → Grow** untuk UMKM existing;
- Trend Radar;
- Opportunity Finder;
- Opportunity Score;
- Fit Score;
- Risk Indicator;
- AI Opportunity Analysis;
- Evidence / Source;
- Startup Roadmap;
- Growth Roadmap;
- dashboard yang dipersonalisasi;
- deployment sebagai aplikasi web fullstack.

## 2.2 Requirement Mapping Convention

Setiap requirement PRD diberi ID:

- `PRD-AUTH-*` untuk authentication;
- `PRD-ONB-*` untuk onboarding;
- `PRD-PROFILE-*` untuk profile;
- `PRD-DASH-*` untuk dashboard;
- `PRD-TREND-*` untuk Trend Radar;
- `PRD-OPP-*` untuk Opportunity;
- `PRD-SCORE-*` untuk scoring;
- `PRD-AI-*` untuk AI analysis;
- `PRD-COMP-*` untuk compare;
- `PRD-SAVE-*` untuk saved opportunity;
- `PRD-ROAD-*` untuk roadmap;
- `PRD-DATA-*` untuk data;
- `PRD-SEC-*` untuk security;
- `PRD-NFR-*` untuk non-functional requirement.

Setiap requirement penting harus dapat ditelusuri kembali ke BRD.

---

# 3. Product Summary

VENTUREX AI adalah platform web berbasis AI yang membantu pengguna Food & Beverage dalam dua kondisi:

## 3.1 Jalur A — Calon Pengusaha F&B

Pengguna belum memiliki usaha aktif dan membutuhkan bantuan untuk:

- menemukan peluang usaha;
- memahami tren;
- menilai kecocokan peluang dengan kondisi pribadi;
- memahami target konsumen;
- menilai kompetisi dan risiko;
- membandingkan beberapa peluang;
- memperoleh Startup Roadmap.

Alur:

**Discover → Analyze → Start**

## 3.2 Jalur B — UMKM F&B Existing

Pengguna sudah memiliki usaha aktif dan membutuhkan bantuan untuk:

- memahami tren relevan;
- menemukan peluang menu atau produk baru;
- menilai kecocokan dengan bisnis saat ini;
- memahami kompetisi dan risiko;
- membandingkan peluang;
- memperoleh Growth Roadmap.

Alur:

**Discover → Analyze → Grow**

---

# 4. Product Vision

> **VENTUREX membantu calon pengusaha dan UMKM Food & Beverage menemukan peluang yang lebih relevan, memahami alasan di balik peluang tersebut, dan menentukan tindakan berikutnya berdasarkan data serta AI.**

---

# 5. Product Goals

## PG-01 — Personalization

Sistem memberikan rekomendasi berdasarkan profil pengguna, bukan rekomendasi generik.

**Referensi BRD:** BR-002, BR-003, BR-004, BR-007, BR-011.

## PG-02 — Opportunity Discovery

Pengguna dapat menemukan tren dan peluang F&B yang relevan.

**Referensi BRD:** BR-006, BR-007, BR-008.

## PG-03 — Decision Support

Pengguna dapat memahami attractiveness, fit, competition, risk, target consumer, dan evidence suatu peluang.

**Referensi BRD:** BR-009 s.d. BR-014.

## PG-04 — Actionable Output

Pengguna dapat mengubah opportunity menjadi Startup Roadmap atau Growth Roadmap.

**Referensi BRD:** BR-017, BR-018.

## PG-05 — Simple User Experience

Pengguna non-teknis dapat memahami output tanpa harus memahami data science.

**Referensi BRD:** NFR-01, NFR-07.

## PG-06 — Reliable Demo-Ready MVP

Semua core flow harus stabil, online, dan dapat didemonstrasikan.

**Referensi BRD:** MVP Metrics, Definition of Done.

---

# 6. Non-Goals

VENTUREX MVP **bukan**:

- POS;
- ERP;
- inventory management;
- accounting;
- payroll;
- CRM penuh;
- supplier marketplace;
- procurement system;
- payment gateway;
- delivery system;
- loan platform;
- autonomous business execution;
- enterprise analytics platform;
- native mobile application.

VENTUREX juga tidak bertujuan untuk:

- menjamin kesuksesan suatu bisnis;
- menentukan keputusan bisnis secara otomatis;
- menggantikan riset lapangan;
- mengklaim prediksi masa depan sebagai kepastian.

---

# 7. User Segments

## 7.1 Segment A — Calon Pengusaha F&B

### Kondisi

Belum memiliki bisnis F&B aktif.

### Primary Need

> “Saya ingin tahu peluang usaha F&B yang cocok dengan kondisi saya dan apa langkah awal yang harus dilakukan.”

### Minimum Profile

- location;
- interest/category;
- budget range;
- experience level;
- target customer preference;
- preferred sales channel;
- time commitment.

---

## 7.2 Segment B — UMKM F&B Existing

### Kondisi

Sudah memiliki bisnis aktif.

### Primary Need

> “Saya ingin tahu peluang pengembangan apa yang cocok dengan bisnis saya saat ini.”

### Minimum Profile

- business name;
- category;
- location;
- current products;
- target consumer;
- average price range;
- sales channel.

---

# 8. Product Principles

Produk harus mengikuti prinsip berikut.

## PP-01 — Explain Before Recommend

Sistem tidak cukup memberikan rekomendasi. Sistem harus menjelaskan **mengapa** rekomendasi tersebut diberikan.

## PP-02 — Data First, AI Second

Fakta dan indikator berasal dari data/structured input. AI berfungsi untuk reasoning, summarization, dan explanation.

## PP-03 — No False Certainty

Score tidak boleh ditampilkan sebagai peluang sukses absolut.

## PP-04 — Actionable

Insight harus dapat diterjemahkan menjadi tindakan.

## PP-05 — Role-Aware

Experience calon pengusaha dan UMKM existing harus dibedakan.

## PP-06 — Simple by Default

Antarmuka harus memprioritaskan informasi paling penting terlebih dahulu.

---

# 9. MVP Product Scope

## 9.1 Must Have

1. Register/Login.
2. User Type Selection.
3. Entrepreneur Profile.
4. Business Profile.
5. Personalized Dashboard.
6. Trend Radar.
7. Opportunity Finder.
8. Opportunity Detail.
9. Opportunity Score.
10. Fit Score.
11. Risk Indicator.
12. AI Opportunity Analysis.
13. Evidence / Source.
14. Startup Roadmap.
15. Growth Roadmap.
16. Backend API.
17. Database.
18. Responsive Web UI.
19. Online Deployment.

## 9.2 Should Have

1. Save Opportunity.
2. Compare Opportunities.
3. Confidence Indicator.
4. History.

## 9.3 Could Have

1. Roadmap progress tracking.
2. Regional filters.
3. Advanced trend visualization.
4. Recommendation feedback.
5. Opportunity history.

## 9.4 Won't Have in MVP

Semua fungsi operasional ERP/POS dan fitur enterprise yang tercantum pada BRD.

---

# 10. Information Architecture

Struktur navigasi MVP yang direkomendasikan:

```text
Landing
├── Login
├── Register
└── App
    ├── Onboarding
    │   ├── User Type Selection
    │   ├── Entrepreneur Profile
    │   └── Business Profile
    ├── Dashboard
    ├── Trend Radar
    ├── Opportunities
    │   ├── Opportunity Explorer
    │   ├── Opportunity Detail
    │   └── Compare
    ├── Roadmap
    │   ├── Startup Roadmap
    │   └── Growth Roadmap
    ├── Saved
    └── Profile / Settings
```

Catatan:

- Navigation item dapat disederhanakan pada UI akhir.
- `Startup Roadmap` hanya relevan untuk calon pengusaha.
- `Growth Roadmap` hanya relevan untuk UMKM existing.

---

# 11. Primary User Flows

## 11.1 Flow A — Calon Pengusaha

```text
Register
  ↓
Login
  ↓
Select User Type:
"Calon Pengusaha"
  ↓
Fill Entrepreneur Profile
  ↓
Dashboard
  ↓
Explore Trend Radar
  ↓
View Recommended Opportunities
  ↓
Open Opportunity Detail
  ↓
Review Opportunity Score
  ↓
Review Fit Score
  ↓
Review Risk + Evidence
  ↓
Read AI Analysis
  ↓
Compare / Save
  ↓
Generate Startup Roadmap
  ↓
Take Validation Action
```

## 11.2 Flow B — UMKM Existing

```text
Register
  ↓
Login
  ↓
Select User Type:
"Sudah Memiliki Bisnis"
  ↓
Fill Business Profile
  ↓
Dashboard
  ↓
Explore Relevant Trends
  ↓
View Growth Opportunities
  ↓
Open Opportunity Detail
  ↓
Review Opportunity Score
  ↓
Review Business Fit
  ↓
Review Risk + Evidence
  ↓
Read AI Analysis
  ↓
Compare / Save
  ↓
Generate Growth Roadmap
  ↓
Take Validation Action
```

---

# 12. Functional Requirements

# 12.1 Authentication

## PRD-AUTH-001 — Register

Sistem harus memungkinkan pengguna membuat akun.

### Minimum Input

- email;
- password;
- password confirmation.

### Acceptance Criteria

- email wajib valid;
- email tidak boleh digunakan oleh dua akun berbeda;
- password tidak boleh kosong;
- password dan confirmation harus sama;
- akun tersimpan jika seluruh validation berhasil;
- setelah register berhasil, user diarahkan ke login atau onboarding sesuai implementasi.

**BRD Reference:** BR-001.

---

## PRD-AUTH-002 — Login

Sistem harus memungkinkan pengguna masuk menggunakan kredensial yang benar.

### Acceptance Criteria

- kredensial valid menghasilkan session/token;
- kredensial salah menghasilkan pesan error;
- error tidak membocorkan informasi sensitif;
- user yang belum menyelesaikan onboarding diarahkan ke onboarding;
- user yang sudah onboarding diarahkan ke dashboard.

**BRD Reference:** BR-001.

---

## PRD-AUTH-003 — Logout

User dapat keluar dari aplikasi.

### Acceptance Criteria

- session/token user dinonaktifkan atau dihapus;
- user diarahkan ke halaman login/landing;
- protected page tidak dapat diakses setelah logout.

---

# 12.2 User Type Selection

## PRD-ONB-001 — Select User Type

Setelah first login, user harus memilih salah satu:

1. `Saya ingin memulai bisnis F&B`
2. `Saya sudah memiliki bisnis F&B`

### Acceptance Criteria

- hanya satu tipe dapat aktif dalam satu waktu;
- pilihan disimpan;
- pilihan menentukan form onboarding berikutnya;
- user tidak masuk dashboard sebelum minimum profile selesai.

**BRD Reference:** BR-002.

---

## PRD-ONB-002 — Change User Type

Perubahan user type setelah onboarding **bukan core MVP**.

### Product Decision

Untuk MVP, perubahan tipe user sebaiknya tidak dilakukan secara bebas karena struktur profil berbeda.

### Proposed Behavior

Jika tim memilih mendukung perubahan:

- tampilkan warning;
- profile sebelumnya tidak dihapus otomatis;
- user harus melengkapi profile baru.

**Status:** Open Decision / Should Have.

---

# 12.3 Entrepreneur Profile

## PRD-PROFILE-001 — Create Entrepreneur Profile

Untuk user type `Calon Pengusaha`, sistem harus menyediakan form profile.

### Required Fields

- location;
- interest/category;
- budget range;
- experience level;
- preferred customer segment;
- preferred sales channel;
- time commitment.

### Optional Fields

- preferred product type;
- business objective;
- notes.

### Acceptance Criteria

- required field harus lengkap;
- data tersimpan;
- dashboard hanya aktif setelah profile minimum lengkap;
- profile menjadi input personalization.

**BRD Reference:** BR-003.

Final Entrepreneur Profile configuration is frozen in [`Entrepreneur Profile Configuration.md`](Entrepreneur%20Profile%20Configuration.md).

---

## PRD-PROFILE-002 — Entrepreneur Profile Field Behavior

### Proposed Input Types

| Field | Type |
|---|---|
| Location | text/select |
| Interest | multi-select |
| Budget Range | range/select |
| Experience Level | select |
| Target Customer Preference | select/multi-select |
| Preferred Sales Channel | multi-select |
| Time Commitment | select |

Nilai enum dan master data final ditetapkan pada [`Entrepreneur Profile Configuration.md`](Entrepreneur%20Profile%20Configuration.md).

---

## PRD-PROFILE-003 — Update Entrepreneur Profile

User dapat mengubah profile.

### Acceptance Criteria

- perubahan tersimpan;
- recommendation berikutnya menggunakan profile terbaru;
- perubahan tidak menghapus saved opportunity.

**BRD Reference:** BR-005.

---

# 12.4 Business Profile

Business Profile requirements are frozen in [Business Profile Configuration.md](Business%20Profile%20Configuration.md). That document is the source of truth for validation, normalization, reference reuse, transaction behavior, completion, and profile-version semantics.

## PRD-PROFILE-004 — Create Business Profile

Untuk user type `UMKM Existing`, sistem harus menyediakan form bisnis dengan:

### Required Fields

- business name;
- exactly one active F&B business category;
- location text;
- 1–20 current products;
- average price minimum and maximum in integer Rupiah;
- at least one active customer segment;
- at least one active sales channel.

### Optional Fields

- product category;
- product price;
- city and province;
- business description;
- notes.

`operation_model` tetap nullable pada schema, tetapi tidak menjadi input atau tampilan Business onboarding MVP.

### Acceptance Criteria

- profile wajib valid sebelum dashboard aktif;
- product names yang sama setelah normalisasi ditolak sebagai validation error;
- duplicate customer-segment dan sales-channel IDs dinormalisasi, bukan ditolak;
- data tersimpan secara atomic dan digunakan untuk personalization;
- profile completion mengubah `onboarding_status` menjadi `COMPLETED`.

**Configuration Reference:** [Business Profile Configuration.md](Business%20Profile%20Configuration.md).
**BRD Reference:** BR-004.

---

## PRD-PROFILE-005 — Update Business Profile

User dapat memperbarui data bisnis melalui `PUT /api/v1/profile/business`.

### Acceptance Criteria

- perubahan semantic tersimpan dan menaikkan `profile_version`;
- notes-only changes tidak menaikkan `profile_version`;
- current product collection menggunakan full physical replacement;
- inactive historical product rows tidak dipertahankan pada MVP;
- analysis berikutnya menggunakan data terbaru;
- saved data lama tidak hilang tanpa konfirmasi di luar replacement collection yang secara eksplisit dikirim pada PUT.

**Configuration Reference:** [Business Profile Configuration.md](Business%20Profile%20Configuration.md).
**BRD Reference:** BR-005.

---

# 12.5 Dashboard

## PRD-DASH-001 — Personalized Dashboard Routing

Dashboard harus berbeda berdasarkan `user_type`.

**BRD Reference:** BR-019.

---

## PRD-DASH-002 — Dashboard Calon Pengusaha

Minimal menampilkan:

1. greeting/user context;
2. profile completion;
3. top recommended opportunities;
4. relevant/trending F&B topics;
5. saved opportunities;
6. latest Startup Roadmap bila tersedia.

### Empty State

Jika belum ada recommendation:

> “Lengkapi profil agar VENTUREX dapat menemukan peluang yang lebih relevan.”

### Acceptance Criteria

- opportunity card dapat dibuka;
- trend card dapat dibuka;
- CTA ke profile tersedia jika profile incomplete.

---

## PRD-DASH-003 — Dashboard UMKM Existing

Minimal menampilkan:

1. business summary;
2. relevant trends;
3. growth opportunities;
4. saved opportunities;
5. latest Growth Roadmap bila tersedia.

### Acceptance Criteria

- business identity tampil;
- recommendation disesuaikan profile;
- CTA ke opportunity detail tersedia.

### Dashboard Foundation implementation configuration

The final MVP implementation configuration is frozen in `docs/Dashboard Foundation Configuration.md`. It preserves the requirement intent in this document while defining strict completed-user access, server-side role-aware rendering, real profile summaries, and truthful unavailable states for modules not implemented yet.

---

# 12.6 Trend Radar

## PRD-TREND-001 — Trend List

Sistem harus menampilkan daftar tren F&B.

### Minimum Display

- trend name;
- category;
- direction;
- period;
- relevance;
- source indicator;
- last updated.

**BRD Reference:** BR-006.

---

## PRD-TREND-002 — Trend Direction

Trend yang ditampilkan kepada pengguna harus memiliki direction minimal:

- Rising;
- Stable;
- Declining.

### Optional Future States

- Seasonal;
- Spike;
- Emerging.

Enum final dapat berkembang setelah MVP.

### Approved User-Facing v1 Constraint

A Trend surfaced in the approved user-facing List v1 must have a supported non-null direction. A non-user-visible catalog record may have no direction when evidence does not establish one. Do not fabricate a direction. This display constraint does not change database or domain nullability.

---

## PRD-TREND-003 — Personalized Relevance

Trend dapat diurutkan berdasarkan relevansi terhadap profile user.

### Calon Pengusaha

Relevance dapat mempertimbangkan:

- interest;
- budget;
- location;
- channel;
- target customer.

### UMKM Existing

Relevance dapat mempertimbangkan:

- business category;
- current product;
- customer segment;
- price range;
- channel.

**BRD Reference:** BR-007.

---

## PRD-TREND-004 — Trend Detail

Trend detail minimal menampilkan:

- title;
- short description;
- direction;
- period;
- source;
- updated date;
- related opportunities.

### Acceptance Criteria

- user memahami konteks trend;
- related opportunity dapat dibuka.

## Approved Trend User-Facing v1 Staged Delivery

**Status:** Approved staged delivery; implementation pending.
**Initial slice:** `TREND LIST ONLY` on a dedicated authenticated, server-rendered `/trends` route. The initial Trend consumer is not Dashboard-embedded Trend cards.

The route requires an authenticated user with completed onboarding. The server resolves the persisted current user and `userType`; the client cannot authoritatively supply `userId`, `userType`, or `affectedUserType`. Read through `Server Component -> TrendService -> TrendRepository -> PostgreSQL` (`DIRECT_SERVER_SERVICE`). No Trend HTTP API is approved. User-facing Trend access is read-only.

For `PRD-TREND-001`, v1 uses `PUBLISHED` plus persisted `userType` and `affectedUserTypes` for audience eligibility only. The relevance display is general curated business context labeled **Konteks relevansi bisnis**, not profile personalization, a recommendation, or a score. The list may show title, Trend category, optional F&B subject area, signal summary, supported direction, observation period when known, evidence source name, source date when known, material limitations, and catalog update time only when explicitly labeled **Katalog diperbarui**. Source Type is excluded from List v1 as clarified under `PRD-DATA-001`. Missing source date must not be invented; it may be stated as **Tanggal sumber tidak dicantumkan**. Internal DTO data is mapped through a safe server-side display projection, not exposed as a public API contract.

Default order is `createdAt DESC`, then `id ASC`: deterministic catalog ordering, not market freshness, trend strength, relevance ranking, or recommendation ranking. No freshness score, badge, threshold, or real-time claim is approved for v1. Show only real curated persisted records; no fake Trends, evidence, statistics, or AI claims.

The requirements remain intact as target scope under approved staged delivery: `PRD-TREND-003` and `FSD-TREND-002` (profile-aware relevance) are deferred from List v1; `PRD-TREND-004` and `FSD-TREND-003` (Trend Detail and related-Opportunity openability) are deferred with Detail. They are not deleted, optional, or complete. No Opportunity relationship implementation exists for this slice. Relationship capability is unavailable, not an empty result; the existing empty-related-Opportunity copy applies only when a future implemented relationship query succeeds and returns zero records. These deferrals are `CHANGE_CONTROL_REQUIRED / APPROVED STAGED DELIVERY`.

Approved delivery sequence is `/trends` List implementation, followed by a separately scoped Dashboard Trend availability integration. `docs/Dashboard Foundation Configuration.md` remains unchanged here. Dashboard Trends remain `UNAVAILABLE` until implementation and integration; reconcile Dashboard state/copy and any CTA or navigation before declaring Trend v1 release-complete. Do not show a Trend navigation destination before `/trends` is usable. This approved contract does not mean `/trends` is implemented.

---

# 12.7 Opportunity Finder

## PRD-OPP-001 — Generate / Retrieve Opportunities

Sistem harus dapat menampilkan opportunity berdasarkan trend dan profile.

**BRD Reference:** BR-008.

### Calon Pengusaha

Opportunity dapat berupa:

- product opportunity;
- business concept;
- product category.

### UMKM Existing

Opportunity dapat berupa:

- new menu;
- new variant;
- product extension;
- adjacent market opportunity.

---

## PRD-OPP-002 — Opportunity Card

Opportunity card minimal menampilkan:

- opportunity name;
- category;
- short summary;
- Opportunity Score;
- Fit Score;
- risk level;
- trend direction.

### CTA

- `View Analysis`
- optional `Save`

---

## PRD-OPP-003 — Opportunity Detail

Opportunity detail minimal berisi:

1. opportunity name;
2. description;
3. related trend;
4. Opportunity Score;
5. Fit Score;
6. Risk Indicator;
7. target consumer;
8. competition insight;
9. why this opportunity;
10. evidence/source;
11. next action;
12. generate roadmap CTA.

**BRD Reference:** BR-009.

---

## PRD-OPP-004 — Opportunity Filtering

**Should Have**

Filter dapat mencakup:

- category;
- score;
- risk;
- fit;
- trend direction.

Jika waktu MVP terbatas, minimal sorting berdasarkan score.

---

# 12.8 Opportunity Score

## PRD-SCORE-001 — Opportunity Score Range

Score ditampilkan pada rentang:

`0–100`

### Interpretation

Score merepresentasikan **relative attractiveness**, bukan probability of success.

**BRD Reference:** BR-010.

---

## PRD-SCORE-002 — Opportunity Score Components

Komponen dari BRD:

- Trend Momentum;
- Demand Signal;
- Competition;
- Consumer Relevance;
- Execution Feasibility;
- Market Sustainability.

### Implementation Rule

Bobot tidak boleh disembunyikan apabila sudah ditetapkan oleh tim.

Jika formula masih prototype:

- label sebagai `MVP scoring model`;
- hindari klaim bahwa formula sudah tervalidasi ilmiah.

---

## PRD-SCORE-003 — Opportunity Score Explanation

UI harus memberikan penjelasan singkat:

> “Score ini menunjukkan attractiveness relatif berdasarkan beberapa indikator dan bukan jaminan keberhasilan bisnis.”

### Acceptance Criteria

- disclaimer tampil pada score detail;
- user dapat melihat faktor penyusun score.

---

# 12.9 Fit Score

## PRD-SCORE-004 — Fit Score Range

Fit Score menggunakan rentang:

`0–100`

**BRD Reference:** BR-011.

---

## PRD-SCORE-005 — Fit Score Calon Pengusaha

Faktor yang dapat digunakan:

- Budget Fit;
- Interest Fit;
- Location Fit;
- Experience Fit;
- Channel Fit;
- Time Fit.

---

## PRD-SCORE-006 — Fit Score UMKM Existing

Faktor yang dapat digunakan:

- Product Fit;
- Customer Fit;
- Price Fit;
- Channel Fit;
- Operational Fit;
- Brand Fit.

---

## PRD-SCORE-007 — Score State When Data Incomplete

Jika input profile tidak cukup:

- jangan tampilkan false precision;
- tampilkan `Insufficient Data` atau confidence rendah;
- arahkan user melengkapi profile.

---

# 12.10 Risk Indicator

## PRD-SCORE-008 — Risk Level

Minimal:

- Low;
- Medium;
- High.

**BRD Reference:** BR-012.

---

## PRD-SCORE-009 — Risk Factors

Risk dapat berasal dari:

- competition;
- capital requirement;
- trend volatility;
- execution complexity;
- market uncertainty.

### Acceptance Criteria

Risk harus disertai minimal satu alasan.

---

# 12.11 AI Opportunity Analysis

## PRD-AI-001 — AI Input Context

AI hanya boleh menghasilkan analysis setelah menerima minimal:

- user type;
- user/business profile;
- opportunity data;
- score data;
- trend context;
- evidence available.

**BRD Reference:** AI-01, AI-02.

---

## PRD-AI-002 — Structured AI Output

Output AI minimal:

1. `Opportunity Summary`
2. `Why It Is Relevant`
3. `Target Consumer`
4. `Competition`
5. `Potential`
6. `Risks`
7. `Recommended Next Action`

**BRD Reference:** BR-013, AI-04.

---

## PRD-AI-003 — Explainability

AI harus menggunakan bahasa sederhana, singkat, dan actionable.

Tidak diperbolehkan:

- jargon berlebihan;
- klaim tanpa evidence;
- menyatakan `pasti berhasil`;
- mengarang data angka.

---

## PRD-AI-004 — Grounding

AI response harus menggunakan data yang disediakan sistem sebagai dasar utama.

Jika suatu aspek tidak memiliki data:

AI harus menjawab dengan pola seperti:

> “Data yang tersedia belum cukup untuk menilai aspek ini secara kuat.”

**BRD Reference:** RULE-007, RULE-008.

---

## PRD-AI-005 — AI Failure State

Jika AI service gagal:

- application tidak crash;
- user mendapat pesan yang jelas;
- score/data structured tetap dapat ditampilkan;
- tombol `Retry Analysis` tersedia.

### Suggested Message

> “Analisis AI sementara tidak tersedia. Data peluang dan skor tetap dapat dilihat.”

---

# 12.12 Evidence / Source

## PRD-DATA-001 — Evidence Display

Setiap insight yang menggunakan external market data harus menyediakan source reference apabila tersedia.

**BRD Reference:** BR-014.

### Minimum Display

- source name;
- date/update date;
- source type.

### Trend List v1 Staged Delivery

Source Type remains part of this broader target Evidence requirement but is intentionally deferred from Trend List v1 because current Trend evidence persistence and the internal `TrendDto` do not provide an approved structured source-type field or mapping. Do not infer it from `sourceName`, `sourceReference`, URL/domain, `supportingDetail`, Trend category, F&B subject area, or other evidence metadata. A future structured Source Type requires separately approved semantics/taxonomy, authoritative mapping/input, persistence contract if needed, and DTO/display mapping. This Trend List v1 deferral does not narrow `PRD-DATA-001`.

### Optional

- clickable source URL jika legal dan tersedia.

---

## PRD-DATA-002 — Data Timestamp

Trend/opportunity data harus menampilkan:

`Last updated`

untuk membantu user memahami freshness data.

### Approved Trend List v1 Interpretation

Keep the long-term requirement for useful source/freshness context. For Trend List v1, `sourceDate` is the date associated with an evidence source when known; if absent, do not infer or invent a date. Trend `createdAt` and `updatedAt` are catalog-record timestamps, not source or market freshness. Catalog `updatedAt` is optional for List v1; if shown, label it **Katalog diperbarui**. Derived freshness classifications, badges, scores, and thresholds are deferred; no freshness threshold is introduced by this stage.

---

# 12.13 Compare Opportunities

## PRD-COMP-001 — Compare Selection

User dapat memilih minimal dua opportunity.

**Priority:** Should Have
**BRD Reference:** BR-015.

---

## PRD-COMP-002 — Comparison Attributes

Minimal:

- Opportunity Score;
- Fit Score;
- trend;
- competition;
- risk;
- execution feasibility.

---

## PRD-COMP-003 — Compare Limit

Untuk MVP disarankan maksimal 3 opportunities dalam satu layar agar UI tetap jelas.

**Status:** Proposed Product Decision.

---

# 12.14 Save Opportunity

## PRD-SAVE-001 — Save

User dapat menyimpan opportunity.

**Priority:** Should Have
**BRD Reference:** BR-016.

### Acceptance Criteria

- satu user dapat menyimpan banyak opportunity;
- duplicate save tidak membuat duplicate record;
- saved opportunity dapat dibuka kembali.

---

## PRD-SAVE-002 — Remove Saved Opportunity

User dapat menghapus opportunity dari saved list.

### Acceptance Criteria

- penghapusan saved record tidak menghapus master opportunity.

---

# 12.15 Startup Roadmap

## PRD-ROAD-001 — Eligibility

Startup Roadmap hanya tersedia untuk `Calon Pengusaha`.

**BRD Reference:** BR-017.

---

## PRD-ROAD-002 — Generate Startup Roadmap

Input minimal:

- profile;
- selected opportunity;
- risk;
- score;
- available context.

Output minimal:

- stage;
- action;
- objective;
- timeline;
- expected output.

### Recommended MVP Stages

1. Market Validation
2. Competitor Check
3. Prototype
4. Test Selling
5. Evaluation
6. Go / Revise / Stop

---

## PRD-ROAD-003 — Roadmap Actionability

Setiap step harus menggunakan action verb.

Contoh:

- survei;
- bandingkan;
- buat prototype;
- uji;
- evaluasi.

Hindari output terlalu abstrak seperti:

> “Tingkatkan strategi bisnis.”

---

# 12.16 Growth Roadmap

## PRD-ROAD-004 — Eligibility

Growth Roadmap hanya tersedia untuk `UMKM Existing`.

**BRD Reference:** BR-018.

---

## PRD-ROAD-005 — Generate Growth Roadmap

Output minimal:

- stage;
- action;
- objective;
- timeline;
- expected output.

### Recommended MVP Stages

1. Customer Validation
2. Product Prototype
3. Limited Test Selling
4. Margin/Feedback Review
5. Rollout / Revise / Stop

---

# 12.17 Roadmap Persistence

## PRD-ROAD-006 — Save Roadmap

Roadmap yang dihasilkan harus tersimpan agar dapat dibuka kembali.

### Minimum Fields

- roadmap id;
- user id;
- opportunity id;
- roadmap type;
- steps;
- created at.

---

# 13. UX Requirements

## 13.1 General UX

### UX-01

User harus dapat memahami value utama dalam waktu singkat.

### UX-02

Dashboard tidak boleh dipenuhi terlalu banyak chart.

### UX-03

Score harus selalu memiliki label dan explanation.

### UX-04

Primary CTA harus jelas.

Contoh:

- `View Opportunity`
- `Compare`
- `Generate Startup Roadmap`
- `Generate Growth Roadmap`

---

## 13.2 Onboarding UX

Onboarding tidak boleh terasa seperti form administrasi panjang.

Recommended pattern:

### Calon Pengusaha

```text
Step 1: Lokasi
Step 2: Minat
Step 3: Budget
Step 4: Target Konsumen
Step 5: Channel & Experience
```

### UMKM Existing

```text
Step 1: Business Identity
Step 2: Products
Step 3: Customer
Step 4: Price
Step 5: Channel
```

Progress indicator disarankan.

---

## 13.3 Opportunity Detail UX

Information hierarchy:

```text
Opportunity Name
↓
Opportunity Score + Fit Score + Risk
↓
Why This Opportunity
↓
Trend / Consumer / Competition
↓
Evidence
↓
Recommended Action
↓
Generate Roadmap
```

---

# 14. UI States

Setiap core screen minimal harus memiliki state:

1. Loading
2. Success
3. Empty
4. Error

## 14.1 Loading State

Gunakan skeleton/loading indicator.

## 14.2 Empty State

Harus memberikan next action.

Contoh:

> “Belum ada saved opportunity. Jelajahi Opportunity Finder untuk mulai menyimpan peluang.”

## 14.3 Error State

Harus:

- menjelaskan masalah secara sederhana;
- memberikan retry jika memungkinkan;
- tidak menampilkan raw technical error kepada user.

---

# 15. Data Model — Logical Product View

Catatan: ini bukan final ERD, tetapi entity yang dibutuhkan PRD.

## 15.1 User

- id
- email
- password_hash
- user_type
- onboarding_status
- created_at
- updated_at

## 15.2 EntrepreneurProfile

- id
- user_id
- location
- interests
- budget_range
- experience_level
- target_customer_preference
- preferred_sales_channel
- time_commitment

## 15.3 BusinessProfile

- id
- user_id
- business_name
- business_category
- location
- current_products
- target_consumer
- price_range
- sales_channel

## 15.4 Trend

- id
- name
- category
- direction
- period
- signal
- source
- updated_at

## 15.5 Opportunity

- id
- name
- category
- description
- related_trend_id
- target_consumer
- competition
- execution_feasibility
- market_sustainability

## 15.6 UserOpportunityAnalysis

- id
- user_id
- opportunity_id
- opportunity_score
- fit_score
- risk_level
- ai_analysis
- generated_at

## 15.7 Evidence

- id
- opportunity_id / trend_id
- source_name
- source_type
- source_reference
- source_date

## 15.8 SavedOpportunity

- id
- user_id
- opportunity_id
- created_at

## 15.9 Roadmap

- id
- user_id
- opportunity_id
- roadmap_type
- created_at

## 15.10 RoadmapStep

- id
- roadmap_id
- sequence
- stage
- action
- objective
- timeline
- expected_output

---

# 16. Data Requirements

## PRD-DATA-003 — Profile Data

Profile harus menjadi personalization input.

## PRD-DATA-004 — Trend Data

Trend harus memiliki:

- name;
- category;
- direction;
- period;
- source;
- updated_at.

## PRD-DATA-005 — Opportunity Data

Opportunity minimal memiliki:

- category;
- related trend;
- target consumer;
- competition indicator;
- risk input;
- scoring inputs.

## PRD-DATA-006 — Prepared Dataset Fallback

Untuk kebutuhan MVP/hackathon, sistem boleh menggunakan prepared/cached dataset apabila live API tidak tersedia.

### Mandatory Rule

UI atau dokumentasi harus membedakan:

- live data;
- cached/prepared data;

agar tidak misleading.

---

# 17. Scoring Product Requirements

## 17.1 Opportunity Score

Formula detail ditetapkan pada design/analytics phase.

### Requirement

- deterministic untuk input yang sama;
- explainable;
- component-level breakdown tersedia;
- score range 0–100.

## 17.2 Fit Score

Formula berbeda berdasarkan user type.

### Requirement

- input berasal dari user profile;
- tidak boleh menggunakan sensitive data yang tidak dibutuhkan;
- missing input mengurangi confidence, bukan diisi dengan asumsi diam-diam.

## 17.3 Confidence Indicator

**Should Have**

Confidence dapat menunjukkan kualitas/kelengkapan evidence.

Contoh:

- High
- Medium
- Low

Confidence tidak sama dengan Opportunity Score.

---

# 18. Business Logic

## BL-01 — Recommendation Eligibility

Opportunity hanya direkomendasikan jika:

- sesuai kategori F&B;
- memiliki minimum trend/opportunity data;
- dapat dibandingkan dengan profile user.

## BL-02 — Profile Incomplete

Jika profile kurang:

- recommendation dibatasi;
- user diarahkan melengkapi profile.

## BL-03 — Roadmap Eligibility

Roadmap hanya dibuat untuk opportunity yang sudah dipilih.

## BL-04 — User Type

Roadmap type ditentukan oleh user type.

## BL-05 — Score Disclaimer

Setiap score detail harus menyatakan:

> score adalah indikator pendukung keputusan, bukan jaminan hasil bisnis.

---

# 19. Error and Edge Cases

## EC-01 — External API Down

Behavior:

- gunakan fallback data jika tersedia;
- tampilkan updated timestamp;
- AI tetap dapat menggunakan cached data.

## EC-02 — AI API Down

Behavior:

- structured score tetap tampil;
- AI explanation menjadi unavailable;
- user dapat retry.

## EC-03 — No Relevant Opportunity

Behavior:

> “Belum ditemukan peluang yang cukup relevan dengan profil saat ini.”

CTA:

- update profile;
- view broader trends.

## EC-04 — Missing Evidence

Behavior:

- label evidence as limited;
- jangan membuat claim kuat.

## EC-05 — Score Cannot Be Calculated

Behavior:

- tampilkan `Insufficient Data`;
- jangan default ke 0 atau 50 tanpa alasan.

## EC-06 — User Opens Wrong Roadmap Type URL

Behavior:

- authorization/business rule check;
- redirect ke roadmap yang sesuai atau dashboard.

---

# 20. Security Requirements

## PRD-SEC-001 — Authentication

Protected route hanya dapat diakses authenticated user.

## PRD-SEC-002 — Authorization

User hanya dapat mengakses:

- profilnya sendiri;
- saved opportunity-nya sendiri;
- roadmap-nya sendiri.

## PRD-SEC-003 — Password

Password tidak boleh disimpan dalam plain text.

## PRD-SEC-004 — Input Validation

Semua input harus divalidasi frontend dan backend.

## PRD-SEC-005 — Sensitive Error

Raw stack trace/database error tidak boleh ditampilkan di UI production.

## PRD-SEC-006 — Secrets

API key tidak boleh disimpan di frontend/public repository.

---

# 21. Privacy Requirements

## PRD-PRIV-001

VENTUREX hanya mengumpulkan data yang relevan dengan personalization.

## PRD-PRIV-002

Business profile tidak boleh dapat dilihat user lain.

## PRD-PRIV-003

Jika third-party AI digunakan, data yang dikirim harus dibatasi pada data yang dibutuhkan untuk analysis.

---

# 22. Non-Functional Requirements

## PRD-NFR-001 — Responsive

Core flow harus usable pada:

- desktop;
- tablet;
- mobile browser.

## PRD-NFR-002 — Performance

BRD hanya menentukan response time “wajar”, sehingga hard SLA belum tersedia.

### Proposed MVP Target

- normal page navigation: terasa responsif;
- AI generation: tampilkan loading/progress state jika lebih lambat.

Hard numeric SLA ditetapkan setelah benchmark.

## PRD-NFR-003 — Reliability

Core demo flow tidak boleh bergantung pada satu live API tanpa fallback.

## PRD-NFR-004 — Maintainability

Frontend, backend, data layer, dan AI integration harus dipisahkan secara logis.

## PRD-NFR-005 — Accessibility

Minimum:

- form memiliki label;
- button memiliki text/accessible name;
- keyboard navigation dasar;
- text contrast dapat dibaca.

## PRD-NFR-006 — Browser Support

Minimum target:

- current Chrome;
- current Edge;
- current Firefox;
- Safari modern bila memungkinkan.

Exact version matrix bukan requirement BRD dan dapat ditetapkan tim.

---

# 23. Analytics and Product Events

Analytics tidak menjadi core BRD tetapi diperlukan untuk mengukur future product metrics.

Recommended events:

| Event | Purpose |
|---|---|
| user_registered | funnel |
| onboarding_completed | activation |
| trend_viewed | engagement |
| opportunity_viewed | relevance |
| opportunity_saved | intent |
| opportunity_compared | decision support usage |
| startup_roadmap_generated | conversion A |
| growth_roadmap_generated | conversion B |
| ai_analysis_generated | AI usage |
| profile_updated | personalization behavior |

Jangan menyimpan data sensitif yang tidak diperlukan ke analytics.

---

# 24. Product Success Metrics

## 24.1 MVP / Hackathon

Success jika:

- dua onboarding flow berfungsi;
- dua profile type tersimpan;
- Trend Radar tampil;
- opportunity tersedia;
- Opportunity Score tampil;
- Fit Score tampil;
- Risk tampil;
- AI Analysis tampil;
- source/evidence tampil;
- Startup Roadmap berhasil dibuat;
- Growth Roadmap berhasil dibuat;
- aplikasi online;
- demo flow stabil.

## 24.2 Future Metrics

Mengacu BRD:

- Opportunity View Rate;
- Save Rate;
- Compare Usage;
- Roadmap Generation Rate;
- Recommendation Acceptance;
- Validation Completion;
- Retention;
- Time to Decision;
- User Satisfaction.

---

# 25. Acceptance Criteria — End-to-End

# 25.1 E2E Scenario A — Calon Pengusaha

### Given

User baru belum memiliki bisnis.

### When

1. register;
2. login;
3. memilih calon pengusaha;
4. mengisi Entrepreneur Profile;
5. membuka dashboard;
6. melihat trend;
7. membuka opportunity;
8. melihat score, fit, risk, evidence;
9. menjalankan AI Analysis;
10. generate Startup Roadmap.

### Then

- seluruh data tampil sesuai user;
- opportunity dapat dijelaskan;
- roadmap berjenis `startup`;
- user tidak melihat Growth Roadmap sebagai primary action.

---

# 25.2 E2E Scenario B — UMKM Existing

### Given

User sudah memiliki bisnis F&B.

### When

1. register;
2. login;
3. memilih UMKM existing;
4. mengisi Business Profile;
5. membuka dashboard;
6. melihat relevant trend;
7. membuka growth opportunity;
8. melihat score, fit, risk, evidence;
9. menjalankan AI Analysis;
10. generate Growth Roadmap.

### Then

- business profile menjadi personalization input;
- roadmap berjenis `growth`;
- user tidak diarahkan ke Startup Roadmap.

---

# 26. API Capability Requirements

PRD tidak menentukan framework, tetapi backend perlu memiliki capability minimal.

Recommended logical endpoints/capabilities:

```text
/auth/register
/auth/login
/auth/logout

/profile/entrepreneur
/profile/business

/trends
/trends/{id}

/opportunities
/opportunities/{id}
/opportunities/{id}/analysis
/opportunities/{id}/score

/saved-opportunities
/compare

/roadmaps
/roadmaps/{id}
```

Nama endpoint final boleh berubah pada technical design.

---

# 27. AI Integration Contract — Product Level

AI request minimal membawa structured context:

```json
{
  "user_type": "...",
  "profile": {},
  "opportunity": {},
  "trend_context": {},
  "scores": {},
  "risk": {},
  "evidence": []
}
```

AI response secara konseptual:

```json
{
  "summary": "...",
  "why_relevant": "...",
  "target_consumer": "...",
  "competition": "...",
  "potential": "...",
  "risks": [],
  "next_action": "..."
}
```

Catatan:

- JSON di atas adalah **product contract example**, bukan final API schema.
- Final schema ditetapkan pada SRS/API specification.

---

# 28. Roadmap Generation Contract — Product Level

Conceptual structure:

```json
{
  "roadmap_type": "startup | growth",
  "opportunity_id": "...",
  "steps": [
    {
      "sequence": 1,
      "stage": "...",
      "action": "...",
      "objective": "...",
      "timeline": "...",
      "expected_output": "..."
    }
  ]
}
```

---

# 29. UI Component Requirements

Recommended reusable components:

- Navbar / Sidebar;
- User Type Badge;
- Profile Summary Card;
- Trend Card;
- Opportunity Card;
- Score Badge;
- Fit Score Indicator;
- Risk Badge;
- Evidence Card;
- AI Insight Panel;
- Compare Table;
- Roadmap Step Card;
- Empty State;
- Error State;
- Loading Skeleton.

Reusable components membantu konsistensi UI/UX dan maintainability.

---

# 30. Copy and Terminology

Gunakan istilah konsisten.

## Recommended

- Trend Radar
- Opportunity
- Opportunity Score
- Fit Score
- Risk
- Evidence
- Startup Roadmap
- Growth Roadmap

## Hindari

- “Guaranteed success”
- “Pasti laku”
- “Pasti untung”
- “Success probability” untuk Opportunity Score

---

# 31. Product Decision Table

| Topic | Decision |
|---|---|
| Industry | F&B only |
| User types | Calon Pengusaha + UMKM Existing |
| Platform | Web Fullstack |
| Main value | Opportunity Intelligence |
| Core framework | Discover → Analyze → Start/Grow |
| AI role | Reasoning + Explanation |
| Score role | Decision support |
| Deployment | Required |
| POS/ERP | Out of scope |
| Live API dependency | Must have fallback |
| Mobile native | Out of scope |

---

# 32. Open Product Decisions

Konfigurasi Entrepreneur Profile yang tercantum pada [`Entrepreneur Profile Configuration.md`](Entrepreneur%20Profile%20Configuration.md) telah diselesaikan. Hal berikut **belum ditetapkan secara eksplisit di BRD** dan tetap perlu diputuskan sebelum final implementation:

1. final scoring weights;
2. confidence scoring formula;
3. exact external data sources;
4. apakah Compare masuk MVP final atau dipotong jika waktu sempit;
5. apakah user dapat mengganti user type setelah onboarding;
6. exact roadmap duration;
7. exact cache refresh interval;
8. exact performance SLA;
9. exact chart type;
10. exact authentication mechanism.

Open decision tidak boleh diam-diam dianggap sebagai requirement final.

---

# 33. Release Prioritization

## Release 0 — Foundation

- auth;
- database;
- user type;
- profile.

## Release 1 — Discover

- dashboard;
- Trend Radar;
- opportunity list.

The approved first Trend user-facing slice is list-only at `/trends`. Trend List implementation is followed by separate Dashboard Trend availability integration, which is a mandatory gate before Trend v1 is declared release-complete. This sequencing does not remove other Release 1 target requirements.

## Release 2 — Analyze

- opportunity detail;
- scoring;
- fit;
- risk;
- evidence;
- AI analysis.

## Release 3 — Start / Grow

- Startup Roadmap;
- Growth Roadmap;
- save;
- compare.

## Release 4 — Stabilization

- responsive;
- error handling;
- security review;
- fallback data;
- bug fixing;
- deployment;
- demo preparation.

---

# 34. Definition of Ready (DoR)

Sebuah fitur siap masuk development apabila:

- requirement ID tersedia;
- business purpose jelas;
- input/output jelas;
- UI state utama diketahui;
- acceptance criteria tersedia;
- dependency diketahui;
- data yang dibutuhkan diketahui;
- open issue kritis sudah diputuskan.

---

# 35. Definition of Done (DoD)

Sebuah fitur dianggap selesai apabila:

- implementation selesai;
- happy path bekerja;
- validation bekerja;
- error state tersedia;
- authorization diperiksa jika diperlukan;
- responsive diperiksa;
- acceptance criteria lulus;
- tidak terdapat critical bug;
- terintegrasi ke branch/repository utama sesuai workflow tim;
- dapat dijalankan pada deployed environment bila termasuk core demo.

---

# 36. QA Test Areas

Minimum QA coverage:

## Functional

- register/login;
- onboarding;
- profile;
- trend;
- opportunity;
- score;
- AI;
- roadmap;
- save;
- compare.

## Validation

- required field;
- invalid input;
- duplicate account;
- incomplete profile.

## Security

- unauthorized route;
- cross-user data access;
- secret exposure.

## Reliability

- API failure;
- AI failure;
- empty data;
- fallback.

## UX

- mobile;
- desktop;
- loading;
- empty state;
- error state.

---

# 37. Requirement Traceability Matrix

| BRD Requirement | PRD Requirement |
|---|---|
| BR-001 User Account | PRD-AUTH-001 s.d. 003 |
| BR-002 User Type | PRD-ONB-001 |
| BR-003 Entrepreneur Profile | PRD-PROFILE-001 s.d. 003 |
| BR-004 Business Profile | PRD-PROFILE-004 s.d. 005 |
| BR-005 Profile Update | PRD-PROFILE-003, 005 |
| BR-006 Trend Radar | PRD-TREND-001 s.d. 004 |
| BR-007 Trend Relevance | PRD-TREND-003 |
| BR-008 Opportunity Finder | PRD-OPP-001, 002 |
| BR-009 Opportunity Detail | PRD-OPP-003 |
| BR-010 Opportunity Score | PRD-SCORE-001 s.d. 003 |
| BR-011 Fit Score | PRD-SCORE-004 s.d. 007 |
| BR-012 Risk Indicator | PRD-SCORE-008, 009 |
| BR-013 AI Analysis | PRD-AI-001 s.d. 005 |
| BR-014 Evidence | PRD-DATA-001, 002 |
| BR-015 Compare | PRD-COMP-001 s.d. 003 |
| BR-016 Save | PRD-SAVE-001, 002 |
| BR-017 Startup Roadmap | PRD-ROAD-001 s.d. 003 |
| BR-018 Growth Roadmap | PRD-ROAD-004, 005 |
| BR-019 Dashboard | PRD-DASH-001 s.d. 003 |

---

# 38. Competition / Hackathon Readiness

MVP harus mampu menunjukkan live flow berikut.

## Demo A — Calon Pengusaha

```text
Login
→ Choose Calon Pengusaha
→ Profile
→ Dashboard
→ Trend
→ Opportunity
→ Score + Fit + Risk
→ AI Analysis
→ Startup Roadmap
```

## Demo B — UMKM Existing

```text
Login
→ Choose UMKM Existing
→ Business Profile
→ Dashboard
→ Trend
→ Growth Opportunity
→ Score + Fit + Risk
→ AI Analysis
→ Growth Roadmap
```

Jika waktu demo terbatas, satu flow dapat menjadi demo utama dan flow lain diperlihatkan secara singkat, tetapi keduanya harus berfungsi pada MVP sesuai BRD.

---

# 39. Recommended Demo Data Strategy

Agar live demo tidak gagal:

1. sediakan prepared F&B trend dataset;
2. sediakan fallback jika external API unavailable;
3. gunakan beberapa opportunity yang sudah terstruktur;
4. AI tetap menerima structured context;
5. jangan hardcode seluruh output sebagai tampilan statis;
6. pastikan minimal core interaction benar-benar melakukan request/proses sistem.

---

# 40. Product Risks

| Risk | Product Impact | Mitigation |
|---|---|---|
| AI hallucination | trust turun | grounded context |
| score terlihat terlalu ilmiah | misleading | explanation + disclaimer |
| profile terlalu panjang | onboarding drop | progressive steps |
| recommendation generik | product value rendah | personalization |
| external API gagal | demo gagal | fallback |
| scope terlalu besar | tidak selesai | Must Have first |
| compare terlalu berat | jadwal terganggu | Should Have |
| data terlalu sedikit | weak analysis | label confidence/data limitation |
| dua user flow terlalu kompleks | UX confusing | user type routing |

---

# 41. Future Product Extensions

Tidak termasuk MVP, tetapi kompatibel dengan product direction.

## Calon Pengusaha

- business model assistant;
- break-even simulation;
- financial projection;
- experiment tracker;
- supplier discovery.

## UMKM Existing

- POS/sales integration as data input only;
- menu performance analysis;
- demand forecasting;
- branch comparison;
- customer feedback intelligence.

## Institution

- incubator dashboard;
- business mentor workspace;
- portfolio monitoring.

---

# 42. Final MVP Definition

> **VENTUREX AI MVP adalah aplikasi web fullstack untuk Food & Beverage yang memiliki dua jalur pengguna—calon pengusaha dan UMKM existing—yang mampu mengumpulkan profil pengguna, menampilkan tren, merekomendasikan opportunity, menghitung Opportunity Score dan Fit Score, menunjukkan risk serta evidence, memberikan AI explanation, dan menghasilkan Startup Roadmap atau Growth Roadmap sesuai kondisi pengguna.**

---

# 43. Product Acceptance Summary

This summary describes the complete product target, not completion of the approved staged Trend List v1 slice. The slice does not fulfill or complete `PRD-TREND-003` or `PRD-TREND-004`.

Produk MVP dianggap siap apabila:

- dua tipe pengguna dapat onboarding;
- setiap tipe memiliki profile yang sesuai;
- dashboard menyesuaikan tipe pengguna;
- Trend Radar berfungsi;
- opportunity dapat ditemukan;
- opportunity memiliki detail;
- Opportunity Score tersedia;
- Fit Score tersedia;
- Risk tersedia;
- source/evidence tersedia;
- AI analysis dapat dijalankan;
- Startup Roadmap tersedia untuk calon pengusaha;
- Growth Roadmap tersedia untuk UMKM existing;
- data user terisolasi;
- aplikasi responsif;
- aplikasi online;
- fallback tersedia untuk critical external dependency;
- core flow stabil untuk live demo.

---

# 44. Final Product Message

## Calon Pengusaha

**Discover → Analyze → Start**

> Temukan peluang F&B yang relevan, pahami potensinya, lalu validasi sebelum memulai.

## UMKM Existing

**Discover → Analyze → Grow**

> Temukan peluang pengembangan, pahami kecocokannya, lalu ubah insight menjadi langkah pertumbuhan.

## Unified Message

> **Discover Trends. Analyze Opportunities. Start or Grow Smarter.**

---

# 45. Reference Document

PRD ini diturunkan dari:

**VENTUREX AI — Business Requirement Document (BRD) v2.0 — Calon Pengusaha dan UMKM F&B Existing.**

Apabila terdapat konflik antara PRD dan BRD terkait tujuan bisnis, target pengguna, atau scope bisnis, maka **BRD menjadi acuan bisnis utama**, sedangkan perubahan PRD harus direview dan diselaraskan kembali.

---

**END OF DOCUMENT**
