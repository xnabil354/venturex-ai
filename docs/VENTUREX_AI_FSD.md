# FUNCTIONAL SPECIFICATION DOCUMENT (FSD)

> **Implementation status — 24 October 2026:** lihat [Current Implementation](Current%20Implementation.md) untuk pemetaan fungsi ke route, service, migration, dan integration yang benar-benar aktif. FSD tetap menjadi kontrak perilaku; perbedaan implementasi harus diperlakukan sebagai gap atau change request, bukan sebagai perubahan requirement implisit.

Entrepreneur MVP completion amendment (21 October 2026): see `Entrepreneur MVP Completion.md` for the private flow implementations of product validation, risk-v1, archive paging, Compare 2–3 owner-scoped analyzed hypotheses and idempotent six-stage Startup Roadmap. These extend the active private hypothesis path; catalog endpoints remain separate.

Amendment 21 October 2026 — Entrepreneur Analyze v2: the owner-scoped `/opportunities/hypotheses/{id}` detail adds an explicit second-stage analysis action using full persisted profile, hypothesis, one-year search history and a bounded local listing sample. AI proposes qualitative concept requirements only; the server computes transparent preliminary Opportunity/Fit scores, with coverage and missing-data rules. Persist a versioned snapshot in the existing hypothesis JSONB; no migration or public catalog mutation. Provider failures remain partial, not fabricated facts. See `Entrepreneur Deep Analysis.md` for formulas, API, persistence, access and failure behavior. V1 transient simulator notes are historical; Compare/roadmap remain deferred.
## VENTUREX AI — Future Trend Intelligence & Business Growth Navigator

**Dokumen:** Functional Specification Document (FSD)
**Versi:** 1.0
**Status:** Draft Functional Baseline untuk MVP Hackathon
**Dokumen Acuan Utama:** `VENTUREX_AI_PRD.md` — Product Requirement Document v1.0
**Acuan Bisnis Turunan:** Business Requirement Document (BRD) VENTUREX AI v2.0
**Produk:** VENTUREX AI
**Industri Fokus:** Food & Beverage (F&B)
**Platform:** Web Fullstack
**Target Pengguna:** Calon Pengusaha F&B dan UMKM F&B Existing
**Product Model:** AI-Powered Business Opportunity Intelligence & Decision Support Platform

---

# 1. Document Purpose

## 1.1 Tujuan FSD

Functional Specification Document (FSD) ini menerjemahkan Product Requirement Document (PRD) VENTUREX AI menjadi spesifikasi fungsi sistem yang lebih rinci dan dapat langsung digunakan sebagai acuan implementasi oleh:

- System Analyst;
- Software Architect;
- UI/UX Designer;
- Frontend Developer;
- Backend Developer;
- AI/ML Engineer;
- Database Engineer;
- QA / Software Tester;
- DevOps Engineer;
- Product Owner.

FSD menjawab pertanyaan:

> **Bagaimana setiap fungsi VENTUREX harus bekerja dari sisi sistem, pengguna, data, validasi, alur normal, alur alternatif, error handling, otorisasi, dan output?**

FSD tidak menetapkan seluruh detail teknologi implementasi. Framework, library, database engine, authentication mechanism, dan provider AI ditentukan pada Technical Design / SRS / Architecture Document jika belum diputuskan.

---

# 2. Document Hierarchy

Hierarki acuan requirement VENTUREX adalah:

```text
BRD
↓
PRD
↓
FSD
↓
SRS / Technical Design / API Specification
↓
UI/UX Design
↓
Development
↓
Testing
↓
Deployment
```

Jika terdapat konflik:

1. **BRD** menjadi acuan untuk tujuan dan kebutuhan bisnis.
2. **PRD** menjadi acuan untuk scope dan perilaku produk.
3. **FSD** menjadi acuan untuk detail fungsi sistem.
4. Detail teknis tidak boleh mengubah requirement produk tanpa change request.

---

# 3. Scope of FSD

FSD mencakup fungsi MVP berikut:

1. Authentication.
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
14. Save Opportunity.
15. Compare Opportunities.
16. Startup Roadmap.
17. Growth Roadmap.
18. Roadmap Persistence.
19. Data Fallback.
20. Security dan authorization behavior.
21. Error dan state handling.
22. Product analytics events.

FSD tidak mencakup fungsi di luar MVP seperti POS, ERP, accounting, inventory, payroll, procurement, native mobile app, dan autonomous business execution. Payment gateway sandbox dan monitoring pembayaran yang terbatas diatur oleh amendemen Billing Sandbox MVP.

---

# 4. Requirement Identification Convention

Setiap functional specification menggunakan ID:

- `FSD-AUTH-*` — Authentication
- `FSD-ONB-*` — Onboarding
- `FSD-EPRO-*` — Entrepreneur Profile
- `FSD-BPRO-*` — Business Profile
- `FSD-DASH-*` — Dashboard
- `FSD-TREND-*` — Trend Radar
- `FSD-OPP-*` — Opportunity
- `FSD-SCORE-*` — Opportunity/Fit Score
- `FSD-RISK-*` — Risk
- `FSD-AI-*` — AI Analysis
- `FSD-EVD-*` — Evidence
- `FSD-SAVE-*` — Saved Opportunity
- `FSD-COMP-*` — Compare
- `FSD-ROAD-*` — Roadmap
- `FSD-DATA-*` — Data/Fallback
- `FSD-SEC-*` — Security
- `FSD-ANL-*` — Analytics

Setiap FSD requirement harus memiliki referensi terhadap PRD requirement terkait.

---

# 5. System Context

VENTUREX memiliki dua jalur pengguna utama.

## 5.1 Calon Pengusaha F&B

```text
Register/Login
→ Pilih "Calon Pengusaha"
→ Entrepreneur Profile
→ Dashboard
→ Trend Radar
→ Opportunity Finder
→ Opportunity Detail
→ Opportunity Score + Fit Score + Risk
→ AI Analysis + Evidence
→ Compare / Save
→ Startup Roadmap
```

Framework:

**Discover → Analyze → Start**

## 5.2 UMKM F&B Existing

```text
Register/Login
→ Pilih "UMKM Existing"
→ Business Profile
→ Dashboard
→ Trend Radar
→ Opportunity Finder
→ Opportunity Detail
→ Opportunity Score + Business Fit + Risk
→ AI Analysis + Evidence
→ Compare / Save
→ Growth Roadmap
```

Framework:

**Discover → Analyze → Grow**

---

# 6. Actors

| Actor | Deskripsi | Hak Utama |
|---|---|---|
| Guest | Pengguna belum login | Landing, Register, Login |
| Calon Pengusaha | Pengguna terautentikasi yang ingin memulai usaha F&B | Entrepreneur Profile, Trend, Opportunity, Startup Roadmap |
| UMKM Existing | Pengguna terautentikasi yang sudah memiliki usaha F&B | Business Profile, Trend, Opportunity, Growth Roadmap |
| System | Backend/application logic | Validation, scoring, routing, persistence |
| AI Service | External/internal AI engine | Explanation dan reasoning berbasis structured context |
| Data Source | Sumber trend/evidence | Menyediakan market/trend input |
| Admin | Monitoring pembayaran read-only | Allowlist email server-side; tanpa refund, rekonsiliasi, atau mutasi finansial |

**Catatan:** Admin MVP dibatasi hanya pada monitoring pembayaran read-only sesuai `docs/Billing Sandbox MVP.md`.

---

# 7. Role and Access Matrix

| Function | Guest | Calon Pengusaha | UMKM Existing |
|---|---:|---:|---:|
| Landing | ✓ | ✓ | ✓ |
| Register | ✓ | - | - |
| Login | ✓ | - | - |
| Logout | - | ✓ | ✓ |
| User Type Selection | - | ✓* | ✓* |
| Entrepreneur Profile | - | ✓ | - |
| Business Profile | - | - | ✓ |
| Dashboard | - | ✓ | ✓ |
| Trend Radar | - | ✓ | ✓ |
| Opportunity Explorer | - | ✓ | ✓ |
| Opportunity Detail | - | ✓ | ✓ |
| AI Analysis | - | ✓ | ✓ |
| Save Opportunity | - | ✓ | ✓ |
| Compare | - | ✓ | ✓ |
| Startup Roadmap | - | ✓ | - |
| Growth Roadmap | - | - | ✓ |
| Own Profile Edit | - | ✓ | ✓ |
| Other User Data | - | ✗ | ✗ |

`*` Pilihan awal tersedia untuk user baru; user `COMPLETED` juga dapat memakai Change User Type sesuai FSD-ONB-002.

---

# 8. Global Functional Rules

## GFR-001 — Authentication Required

Semua halaman aplikasi selain Landing, Register, dan Login harus memerlukan autentikasi.

## GFR-002 — Profile-Based Routing

Setelah login:

```text
IF user_type belum dipilih
    → arahkan ke User Type Selection
ELSE IF required profile belum lengkap
    → arahkan ke Profile Setup
ELSE
    → arahkan ke Dashboard
```

## GFR-003 — User Isolation

Pengguna hanya boleh membaca dan mengubah resource miliknya sendiri untuk:

- profile;
- saved opportunity;
- user-specific analysis;
- roadmap.

## GFR-004 — F&B Only

Opportunity yang ditampilkan pada MVP harus berada dalam scope Food & Beverage.

## GFR-005 — No Success Guarantee

VENTUREX tidak boleh menampilkan kata atau klaim yang menyatakan:

- pasti sukses;
- pasti laku;
- pasti untung;
- success probability,

untuk Opportunity Score.

## GFR-006 — Score is Decision Support

Opportunity Score dan Fit Score adalah indikator untuk decision support, bukan prediksi absolut.

## GFR-007 — Evidence-Aware

Jika evidence terbatas, sistem harus:

- menandai keterbatasan;
- menurunkan confidence jika confidence digunakan;
- menghindari klaim AI yang terlalu kuat.

## GFR-008 — Graceful Failure

Kegagalan AI atau external source tidak boleh menyebabkan seluruh Opportunity Detail tidak dapat dibuka jika structured data masih tersedia.

## GFR-009 — Timestamp

Trend/evidence yang berasal dari dataset eksternal harus memiliki timestamp atau source date jika tersedia.

## GFR-010 — Loading / Empty / Error

Setiap fungsi yang melakukan network/data request wajib memiliki:

- loading state;
- success state;
- empty state jika relevan;
- error state.

---

# 9. Functional Module Overview

```text
AUTHENTICATION
      ↓
ONBOARDING
      ↓
PROFILE
      ↓
PERSONALIZED DASHBOARD
      ↓
TREND RADAR
      ↓
OPPORTUNITY ENGINE
      ↓
SCORING + RISK
      ↓
AI ANALYSIS + EVIDENCE
      ↓
SAVE / COMPARE
      ↓
STARTUP ROADMAP / GROWTH ROADMAP
```

---

# 10. Authentication Functional Specification

# 10.1 Register

## FSD-AUTH-001 — User Registration

**PRD Reference:** PRD-AUTH-001
**Actor:** Guest
**Trigger:** User menekan tombol `Register` / `Create Account`.

### Preconditions

- User belum memiliki authenticated session.
- Register page tersedia.

### Input

| Field | Mandatory | Format |
|---|---:|---|
| Email | Yes | Valid email |
| Password | Yes | String |
| Password Confirmation | Yes | String |

### Main Flow

1. User membuka halaman Register.
2. Sistem menampilkan form.
3. User mengisi email, password, confirmation.
4. Frontend melakukan validation dasar.
5. User submit.
6. Backend melakukan validation ulang.
7. Backend memeriksa uniqueness email.
8. Password di-hash.
9. User record dibuat.
10. Default `onboarding_status = NOT_STARTED`.
11. Sistem memberikan registration success response.
12. User diarahkan ke Login atau langsung authenticated onboarding sesuai implementasi final.

### Validation

- Email wajib.
- Format email valid.
- Email harus unique.
- Password wajib.
- Confirmation wajib.
- Password harus sama dengan confirmation.
- Password tidak boleh disimpan dalam plain text.

### Alternative Flow

**AF-01 — Email sudah terdaftar**

- Record tidak dibuat.
- Tampilkan pesan: `Email sudah digunakan. Silakan login atau gunakan email lain.`

### Exception Flow

**EF-01 — Database error**

- Account tidak boleh terbentuk setengah.
- Sistem menampilkan generic error.
- Technical detail dicatat di server log.

### Output

- Success status.
- User identifier.
- Next navigation.

### Data Write

`User`

### Acceptance Criteria

- Valid registration berhasil.
- Duplicate email ditolak.
- Password confirmation mismatch ditolak.
- Plain password tidak tersimpan.

---

# 10.2 Login

## FSD-AUTH-002 — User Login

**PRD Reference:** PRD-AUTH-002
**Actor:** Guest

### Input

- email;
- password.

### Main Flow

1. User submit login form.
2. Backend mencari account berdasarkan email.
3. Backend memvalidasi password.
4. Jika valid, authenticated session/token dibuat.
5. Sistem membaca:
   - `user_type`;
   - `onboarding_status`;
   - profile completion.
6. Sistem menentukan destination.

### Routing Logic

```text
IF user_type IS NULL
    → /onboarding/user-type
ELSE IF user_type = ENTREPRENEUR AND entrepreneur_profile incomplete
    → /onboarding/entrepreneur
ELSE IF user_type = UMKM AND business_profile incomplete
    → /onboarding/business
ELSE
    → /dashboard
```

### Invalid Login

Gunakan pesan generik:

> `Email atau password tidak sesuai.`

Sistem tidak boleh menginformasikan apakah email tertentu terdaftar.

### Acceptance Criteria

- Valid credentials → login.
- Invalid credentials → no session.
- Correct routing berdasarkan onboarding.

---

# 10.3 Logout

## FSD-AUTH-003 — Logout

**PRD Reference:** PRD-AUTH-003

### Main Flow

1. User menekan `Logout`.
2. Session/token dihapus/direvoke sesuai auth design.
3. User diarahkan ke Landing/Login.
4. Protected page tidak dapat diakses tanpa re-authentication.

---

# 11. Onboarding Functional Specification

# 11.1 User Type Selection

## FSD-ONB-001 — Select User Type

**PRD Reference:** PRD-ONB-001
**Actor:** Authenticated user dengan `user_type = null`

### UI Options

```text
Apa tujuan Anda menggunakan VENTUREX?

[ Saya ingin memulai bisnis F&B ]
[ Saya sudah memiliki bisnis F&B ]
```

### Mapping

| UI Choice | Internal Value |
|---|---|
| Saya ingin memulai bisnis F&B | ENTREPRENEUR |
| Saya sudah memiliki bisnis F&B | UMKM_EXISTING |

### Main Flow

1. Sistem menampilkan dua pilihan.
2. User memilih satu.
3. Sistem meminta confirmation.
4. Pilihan disimpan pada `User.user_type`.
5. Sistem mengarahkan user ke profile setup yang sesuai.

### Routing

```text
ENTREPRENEUR
→ Entrepreneur Profile Setup

UMKM_EXISTING
→ Business Profile Setup
```

### Business Rules

- Satu user memiliki satu active user type dalam MVP.
- User tidak boleh menyelesaikan dua onboarding profile secara bersamaan.
- Perubahan tipe setelah onboarding mengikuti FSD-ONB-002 dan tidak menghapus histori persona.

### Acceptance Criteria

- Hanya satu pilihan dapat dipilih.
- Data tersimpan.
- Correct profile form ditampilkan.

---

# 11.2 Change User Type

## FSD-ONB-002 — Change User Type

**PRD Reference:** PRD-ONB-002
**Priority:** Should Have / Approved implementation

Fungsi ini diaktifkan untuk akun yang sudah menyelesaikan onboarding. Histori setiap persona tetap terpisah dan tidak dihapus.

Flow yang disetujui:

1. User membuka Profile/Settings.
2. User memilih `Change User Type`.
3. Sistem menampilkan warning.
4. User confirm.
5. Existing profile tidak dihapus otomatis.
6. `users.user_type` diganti secara atomik dan `onboarding_status` kembali ke `USER_TYPE_SELECTED`.
7. Existing profile tipe baru, jika ada, dimuat sebagai prefill yang harus ditinjau dan disimpan ulang; jika belum ada, form dimulai kosong.
8. User diarahkan membuat atau mengonfirmasi profile untuk tipe baru.
9. Recommendation menggunakan tipe baru setelah profile selesai.

Workspace aktif hanya membaca histori dengan pasangan `(user_id, user_type)` saat ini. Histori persona lama tetap tersimpan dan muncul kembali jika user berpindah kembali ke persona tersebut.

Server menolak switch untuk user yang belum `COMPLETED`, target persona yang sama, body selain `{ userType }`, dan request lintas origin. Profile lama, private hypothesis, analysis, saved opportunity, dan roadmap tidak dihapus otomatis.

---

# 12. Entrepreneur Profile Functional Specification

# 12.1 Create Entrepreneur Profile

## FSD-EPRO-001 — Entrepreneur Profile Setup

**PRD Reference:** PRD-PROFILE-001, PRD-PROFILE-002
**Configuration source:** [`Entrepreneur Profile Configuration.md`](Entrepreneur%20Profile%20Configuration.md)
**Actor:** `ENTREPRENEUR`

### Required Input

| Field | Required | Proposed Control | Validation |
|---|---:|---|---|
| Location | Yes | Dependent selects + text | Province → city/regency → district (Kecamatan) → subdistrict (Kelurahan) and address detail are all required; region names have a 120-character maximum and address detail has a 255-character maximum. |
| Interest / Category | Yes | Multi-select | ≥1 value |
| Budget Range | Yes | Select/Range | Valid configured value |
| Experience Level | Yes | Select | Valid enum |
| Target Customer Preference | Yes | Select/Multi-select | ≥1 |
| Preferred Sales Channel | Yes | Multi-select | ≥1 |
| Time Commitment | Yes | Select | Valid enum |

Location selectors depend on the preceding choice and are required along with the address detail. Region IDs are UI-only; the API receives the selected region names.

### Optional Input

- preferred product type;
- business objective;
- notes.

Jika kategori minat `Lainnya` dipilih, `preferredProductType` menjadi wajib dan menyimpan nama kategori kustom. Input teks ditampilkan di bawah pilihan `Lainnya`.

### Main Flow

1. User membuka profile setup.
2. Sistem menampilkan progressive onboarding.
3. User melengkapi required data.
4. Frontend validasi per step.
5. User submit final step.
6. Backend validasi seluruh payload.
7. Profile dibuat.
8. `onboarding_status = COMPLETED`.
9. User diarahkan ke Dashboard.
10. Recommendation engine dapat menggunakan profile.

### Functional Rules

- Budget tidak boleh diinterpretasikan sebagai kemampuan finansial pasti di luar input user.
- Optional field kosong tidak menghalangi completion.
- Nilai enum harus berasal dari configuration master.

### Error Flow

- Invalid enum → 400 validation.
- Missing required → no completion.
- Save error → user tetap pada form dan data lokal dipertahankan bila memungkinkan.

---

# 12.2 Update Entrepreneur Profile

## FSD-EPRO-002 — Update Profile

**PRD Reference:** PRD-PROFILE-003

### Main Flow

1. User membuka `Profile`.
2. Existing value dimuat.
3. User edit.
4. User save.
5. Backend validation.
6. Data di-update.
7. System menandai personalization context sebagai changed.
8. Recommendation berikutnya menggunakan profile terbaru.

### Rule

Saved Opportunity dan Roadmap lama tidak otomatis dihapus.

### Recommendation Freshness

Jika recommendation sebelumnya berasal dari profile lama, UI dapat menandai:

> `Profil Anda telah berubah. Beberapa rekomendasi mungkin perlu diperbarui.`

**Status:** Recommended functional behavior.

---

# 13. Business Profile Functional Specification

The complete Business Profile MVP configuration is frozen in [Business Profile Configuration.md](Business%20Profile%20Configuration.md). The following requirements summarize the functional behavior without duplicating the configuration source.

## 13.1 Create Business Profile

## FSD-BPRO-001 — Business Profile Setup

**PRD Reference:** PRD-PROFILE-004
**Actor:** `UMKM_EXISTING`
**Configuration Reference:** [Business Profile Configuration.md](Business%20Profile%20Configuration.md)

### Required Input

| Field | Required | Proposed Control | Validation |
|---|---:|---|---|
| Business Name | Yes | Text | Valid scalar business name. |
| Business Category | Yes | Single-select | Exactly one active `fnb_categories` reference. |
| Location | Yes | Dependent selects + text | `location.text` required; province, city/regency, district, and subdistrict are optional; country is server-controlled. |
| Current Products | Yes | Repeating product rows | 1–20 products; normalized names unique. |
| Average Price Range | Yes | Min/max numeric inputs | Integer Rupiah; `min >= 0`; `max >= min`. |
| Customer Segments | Yes | Multi-select | At least one active reference; duplicate IDs normalized. |
| Sales Channels | Yes | Multi-select | At least one active reference; duplicate IDs normalized. |

### Optional Input

- product category;
- product price;
- province, city/regency, district (Kecamatan), and subdistrict (Kelurahan);
- business description;
- notes.

`operationModel` is not shown or accepted by the MVP onboarding flow.

### Main Flow

1. User completes the three configuration steps.
2. System validates scalar values and active shared references.
3. System loads the current normalized state for semantic comparison.
4. System writes the profile, replaces current products and junctions, and updates `onboarding_status` in one transaction.
5. On success, `onboarding_status = COMPLETED` and the user is directed to the UMKM Dashboard.
6. Profile data becomes input for business-fit and recommendation behavior in later features.

### Rules

- Business category reuses the shared F&B master; no Business-specific taxonomy is created.
- Product category and product price are optional.
- Product ordering is irrelevant for semantic equality.
- Product PUT behavior is full physical replacement; all inserted current rows use `is_active = true`.
- Business Profile belongs to one user and must not be accessible by another user.
- Any transaction failure rolls back all Business Profile writes.

## 13.2 Update Business Profile

## FSD-BPRO-002 — Update Business Profile

**PRD Reference:** PRD-PROFILE-005
**Configuration Reference:** [Business Profile Configuration.md](Business%20Profile%20Configuration.md)

`PUT /api/v1/profile/business` validates the full current payload. Semantic changes to business identity, location, price context, products, reference sets, or business description increment `profile_version`. Notes-only changes and normalized no-op payloads do not.

The product collection is physically replaced inside the same transaction. MVP does not preserve inactive historical product rows, does not accept client product IDs or lifecycle flags, and does not use fuzzy name matching. Existing saved opportunities are not deleted automatically.

# 14. Personalized Dashboard Functional Specification

### Product Owner amendment, 21 October 2026: exploration previews

The exploration section reads the signed-in account's latest three private generated hypotheses, latest three saved private hypotheses, and saved-roadmap availability from the same repositories as Opportunity Finder, Saved Opportunities, and Roadmaps. These are previews of existing hypotheses, not scored catalog recommendations. Each hypothesis title links to its actual card anchor on the corresponding list page. Each module can fail independently without hiding the profile or other previews.

Trend Radar previews show the last successfully loaded, schema-validated related-query response retained in this browser, scoped by authenticated account and matching the current profile search term. One snapshot per account is replaced on a subsequent successful load. If no matching browser snapshot exists, the latest matching SearchApi source reference already persisted with the account's hypotheses supplies a fallback signal. Different regions, periods, properties, or retrieval timestamps are not mixed. The newer observation wins; Top indices and Rising growth/Breakout retain their distinct meanings. Retrieval time and filter context remain visible, and the preview is labelled historical. No SearchApi or LLM request is triggered by opening Dashboard. Empty and error states remain truthful when no observation or hypothesis exists.

On desktop, Trend Radar and saved hypotheses occupy the left column while the latest hypotheses occupy the right. On mobile the reading order is Trend Radar, Opportunity Finder, then saved hypotheses. Text previews are bounded and use the existing warm editorial palette, focus indicators, and touch-safe navigation.

# 14.1 Dashboard Router

## FSD-DASH-001 — Role-Aware Dashboard

**PRD Reference:** PRD-DASH-001

### Logic

```text
IF user_type = ENTREPRENEUR
    render Entrepreneur Dashboard
ELSE IF user_type = UMKM_EXISTING
    render UMKM Dashboard
ELSE
    redirect Onboarding
```

---

# 14.2 Entrepreneur Dashboard

## FSD-DASH-002 — Entrepreneur Dashboard

**PRD Reference:** PRD-DASH-002

### Minimum Sections

1. User context/greeting.
2. Profile completion/status.
3. Top Opportunities.
4. Relevant Trends.
5. Saved Opportunities.
6. Latest Startup Roadmap.

### Top Opportunity Behavior

- Menampilkan limited number of highest-relevance opportunities.
- Card minimal memiliki:
  - opportunity name;
  - score;
  - fit;
  - risk;
  - CTA.

### Empty State

Jika recommendation belum tersedia:

> `Belum ada rekomendasi yang dapat ditampilkan. Lengkapi atau perbarui profil Anda.`

### Actions

- View Opportunity.
- Explore Trends.
- View All Opportunities.
- Open Startup Roadmap.

---

# 14.3 UMKM Dashboard

## FSD-DASH-003 — UMKM Dashboard

**PRD Reference:** PRD-DASH-003

### Minimum Sections

1. Business summary.
2. Relevant Trends.
3. Growth Opportunities.
4. Saved Opportunities.
5. Latest Growth Roadmap.

### Empty State

Jika business profile incomplete:

- jangan generate recommendation;
- tampilkan CTA `Lengkapi Profil Bisnis`.

### Dashboard Foundation implementation configuration

The final MVP implementation configuration is frozen in `docs/Dashboard Foundation Configuration.md`. The configuration details the server-side role guard, DashboardQueryService boundary, safe Dashboard DTO, profile summary fields, truthful unavailable states, navigation policy, and accessibility behavior without adding runtime implementation here.

---

# 15. Trend Radar Functional Specification

# 15.1 Trend List

## FSD-TREND-001 — View Trend Radar

**PRD Reference:** PRD-TREND-001

This is the retained target requirement. The approved first user-facing implementation slice is defined in Section 15.4; the profile-relevance behavior below is not part of that slice.

### Display Fields

- Trend Name
- Category
- Direction
- Period
- Relevance Indicator
- Source Indicator
- Last Updated

### Supported Direction for MVP

- `RISING`
- `STABLE`
- `DECLINING`

Optional future states dari PRD tidak diwajibkan.

### Main Flow

1. User membuka Trend Radar.
2. System mengambil trend dataset.
3. System menghitung/menentukan relevance terhadap profile jika tersedia.
4. Trend diurutkan sesuai default ranking.
5. UI menampilkan cards/list.

### Default Sorting

**Proposed:** relevance descending, lalu trend strength.

Karena exact sorting tidak final pada PRD, ranking detail harus dapat dikonfigurasi.

This remains a target proposal, not an approved v1 default. List v1 uses deterministic catalog order `createdAt DESC`, then `id ASC`; it does not imply relevance, trend strength, freshness, or recommendation ranking.

---

# 15.2 Personalized Trend Relevance

## FSD-TREND-002 — Trend Relevance

**PRD Reference:** PRD-TREND-003

This target requirement is retained but deferred from the approved Trend List v1 slice under `CHANGE_CONTROL_REQUIRED / APPROVED STAGED DELIVERY`. Audience eligibility and the general curated explanation do not fulfill profile-aware relevance. The output options below are not a v1 contract; a future method and semantics require separate approval.

### Entrepreneur Input

- interest;
- budget;
- location;
- channel;
- target customer.

### UMKM Input

- category;
- current product;
- target consumer;
- price range;
- sales channel.

### Output

Relevance dapat berupa:

- numeric internal score; atau
- categorical label.

**Product rule:** UI tidak wajib menampilkan formula relevance jika belum ditetapkan.

---

# 15.3 Trend Detail

## FSD-TREND-003 — View Trend Detail

**PRD Reference:** PRD-TREND-004

This target requirement is retained but deferred from the approved Trend List v1 slice under `CHANGE_CONTROL_REQUIRED / APPROVED STAGED DELIVERY`.

### Output

- title;
- summary;
- category;
- direction;
- period;
- source;
- updated date;
- related opportunities.

### Related Opportunities

Hanya opportunity dalam domain F&B dan memiliki relation dengan trend yang ditampilkan.

### Empty Related Opportunity

Jika tidak ada:

> `Belum ada opportunity yang terhubung dengan tren ini.`

Use this copy only when a future implemented relationship query succeeds and returns zero records. An unavailable relationship capability is not an empty result.

## 15.4 Approved Trend List v1 Implementation Slice

**Status:** Approved contract; runtime implementation pending.
**Scope:** List only at dedicated authenticated, server-rendered `/trends`; no Trend Detail.

The access/read flow is:

```text
authenticated user with completed onboarding
-> server-resolved persisted current user and userType
-> /trends Server Component
-> TrendService
-> TrendRepository
-> PostgreSQL
```

Use direct server service access (`DIRECT_SERVER_SERVICE`). No Trend HTTP API is approved. The client must not authoritatively provide `userId`, `userType`, or `affectedUserType`. The surface is read-only; no user-facing Trend mutation is authorized.

Eligibility is persisted current-user `userType` + `PUBLISHED` + `affectedUserTypes`, which is audience eligibility only. The internal `TrendDto` is not a public API contract; map it to a safe server-side display projection. Do not expose ORM objects, evidence IDs, `lifecycleState`, internal category codes where a display label is sufficient, `affectedUserTypes`, archive reason, reviewer state, or fabricated scores.

The list projection may display:

- title, Trend category rendered from the existing taxonomy, optional F&B subject-area name, and signal summary;
- supported non-null direction and observation period when known;
- evidence source name, `sourceDate` when known, and material limitations where appropriate; structured Source Type is deferred as specified in `FSD-EVD-001`;
- `businessRelevanceExplanation` only as general curated context labeled **Konteks relevansi bisnis**;
- `updatedAt` only when explicitly labeled **Katalog diperbarui**.

If source date is unknown, do not invent one; **Tanggal sumber tidak dicantumkan** is truthful copy. `sourceDate` is not a retrieval timestamp. `createdAt` and `updatedAt` are catalog record timestamps, not source or market freshness. No derived freshness state, badge, score, or threshold is part of v1. Default ordering is `createdAt DESC`, then `id ASC`; do not label this order latest, most relevant, top, or strongest.

### Trend List v1 States

- `AVAILABLE`: capability released, query succeeded, and at least one eligible published Trend satisfies the display contract.
- `EMPTY`: capability released, query succeeded, and zero eligible published Trends exist for persisted `userType`. Recommended copy: `Belum ada tren F&B terkurasi yang dipublikasikan untuk jenis pengguna ini.` This does not mean no profile match.
- `ERROR`: query failed or an eligible record violates a required display contract, including missing/unsupported direction. Return controlled error behavior; do not expose raw database errors or present failure as empty.
- `UNAVAILABLE`: user-facing Trend capability is not released. Do not represent it as empty or as a fake loading request.

Show only real curated persisted records. Do not add seeded fake Trends, evidence, market statistics, relevance, or AI claims. External ingestion and AI are not dependencies of this slice.

Trend List implementation is followed by a separately scoped Dashboard Trend availability integration. Dashboard remains `UNAVAILABLE` until implementation and integration; reconcile Dashboard state/copy and any CTA or navigation before declaring Trend v1 release-complete. Do not expose a Trend navigation destination before `/trends` is usable. These are sequencing requirements, not claims that the runtime is already available.

---

# 16. Opportunity Finder Functional Specification

# 16.1 Opportunity Retrieval

## FSD-OPP-001 — Get Personalized Opportunities

**PRD Reference:** PRD-OPP-001

### Preconditions

- User authenticated.
- User type tersedia.
- Required profile minimum tersedia.

### Main Processing

```text
1. Load user profile
2. Load eligible F&B opportunities
3. Load related trend data
4. Exclude opportunities without minimum data
5. Calculate Opportunity Score
6. Calculate Fit Score
7. Calculate/assign Risk
8. Rank eligible opportunities
9. Return personalized list
```

### Entrepreneur Opportunity Types

- product opportunity;
- business concept;
- product category.

### UMKM Opportunity Types

- new menu;
- new variant;
- product extension;
- adjacent market opportunity.

---

# 16.2 Opportunity Eligibility

## FSD-OPP-002 — Eligibility Rules

**PRD Reference:** BL-01

Opportunity eligible apabila:

- category = F&B;
- minimum scoring data tersedia;
- memiliki trend/opportunity context;
- dapat dibandingkan dengan profile.

Jika data minimum tidak tersedia:

- opportunity boleh tetap ada di master data;
- tetapi tidak direkomendasikan secara personalized sampai requirement minimum terpenuhi.

---

# 16.3 Opportunity Card

## FSD-OPP-003 — Opportunity Card

**PRD Reference:** PRD-OPP-002

### Fields

- name;
- category;
- short summary;
- Opportunity Score;
- Fit Score;
- Risk;
- Trend Direction.

### Actions

- View Analysis
- Save (Should Have)

### Display Rule

Jika score tidak dapat dihitung:

- jangan menampilkan `0`;
- tampilkan `Insufficient Data`.

---

# 16.4 Opportunity Detail

## FSD-OPP-004 — Opportunity Detail

**PRD Reference:** PRD-OPP-003

### Sections

1. Header
2. Opportunity Score
3. Fit Score
4. Risk
5. Related Trend
6. Target Consumer
7. Competition Insight
8. Why This Opportunity
9. Evidence
10. AI Analysis
11. Recommended Next Action
12. Generate Roadmap

### Roadmap CTA

```text
IF user_type = ENTREPRENEUR
    show "Generate Startup Roadmap"
ELSE IF user_type = UMKM_EXISTING
    show "Generate Growth Roadmap"
```

---

# 16.5 Opportunity Sorting and Filtering

## FSD-OPP-005 — Sort / Filter

**PRD Reference:** PRD-OPP-004
**Priority:** Should Have

Potential filters:

- category;
- risk;
- score;
- fit;
- trend direction.

MVP minimum jika filter tidak selesai:

- sort by Opportunity Score atau relevance.

---

# 17. Opportunity Score Functional Specification

# 17.1 Score Engine

## FSD-SCORE-001 — Calculate Opportunity Score

**PRD Reference:** PRD-SCORE-001, PRD-SCORE-002

### Output Range

`0–100`

### Input Components

- Trend Momentum
- Demand Signal
- Competition
- Consumer Relevance
- Execution Feasibility
- Market Sustainability

### Functional Formula

FSD tidak menetapkan bobot final karena PRD menyatakan bobot masih open decision.

Engine harus mendukung konfigurasi:

```text
OpportunityScore =
Σ(normalized_component_i × configured_weight_i)
```

dengan:

```text
Σ configured_weight = 1.00
```

### Requirements

- deterministic untuk input sama;
- calculation server-side atau trusted application layer;
- component breakdown tersimpan atau dapat direkonstruksi;
- weight configurable;
- score dibulatkan secara konsisten.

### Open Decision

- final weights;
- normalization method;
- rounding precision.

Semua harus diputuskan sebelum production/demo freeze.

---

# 17.2 Score Explanation

## FSD-SCORE-002 — Opportunity Score Breakdown

**PRD Reference:** PRD-SCORE-003

UI harus menampilkan:

- final score;
- faktor penyusun;
- explanatory disclaimer.

Required copy:

> `Opportunity Score adalah indikator pendukung keputusan berdasarkan data yang tersedia dan bukan jaminan keberhasilan bisnis.`

---

# 17.3 Missing Score Data

## FSD-SCORE-003 — Insufficient Score Data

**PRD Reference:** PRD-SCORE-007, EC-05

Jika minimum component tidak tersedia:

```text
score_status = INSUFFICIENT_DATA
```

UI:

> `Data belum cukup untuk menghitung skor secara layak.`

Sistem tidak boleh:

- otomatis memberi 0;
- otomatis memberi 50;
- mengisi komponen dengan asumsi tersembunyi.

---

# 18. Fit Score Functional Specification

# 18.1 Fit Score — Entrepreneur

## FSD-SCORE-004 — Entrepreneur Fit

**PRD Reference:** PRD-SCORE-005

### Components

- Budget Fit
- Interest Fit
- Location Fit
- Experience Fit
- Channel Fit
- Time Fit

### Behavior

1. System membaca Entrepreneur Profile.
2. System membaca requirement/attribute opportunity.
3. Matching engine menghasilkan component fit.
4. Component dinormalisasi.
5. Weighting diterapkan sesuai configuration.
6. Final Fit Score dihasilkan.

---

# 18.2 Fit Score — UMKM

## FSD-SCORE-005 — Business Fit

**PRD Reference:** PRD-SCORE-006

### Components

- Product Fit
- Customer Fit
- Price Fit
- Channel Fit
- Operational Fit
- Brand Fit

### Rule

Jika data untuk Operational Fit atau Brand Fit belum tersedia pada MVP, komponen tersebut tidak boleh diam-diam diisi dengan nilai default. Formula harus:

- menggunakan component aktif yang tersedia; atau
- menandai confidence lebih rendah.

Final approach harus dikonfigurasi dan didokumentasikan.

---

# 18.3 Fit Score Display

## FSD-SCORE-006 — Fit Score UI

Output:

- score 0–100; atau
- `Insufficient Data`.

Disclaimer:

> `Fit Score menunjukkan tingkat kesesuaian berdasarkan profil yang Anda berikan.`

---

# 19. Risk Indicator Functional Specification

# 19.1 Risk Assessment

## FSD-RISK-001 — Determine Risk

**PRD Reference:** PRD-SCORE-008, PRD-SCORE-009

### Supported Levels

- LOW
- MEDIUM
- HIGH

### Potential Factors

- competition;
- capital requirement;
- trend volatility;
- execution complexity;
- market uncertainty.

### Output Requirement

Setiap risk harus memiliki:

- level;
- minimum satu reason.

Contoh:

```text
Risk: Medium
Reason: Kompetisi relatif tinggi dan tren masih berubah cepat.
```

### Open Decision

Threshold LOW/MEDIUM/HIGH belum didefinisikan PRD dan harus dikonfigurasi sebelum final release.

---

# 20. AI Opportunity Analysis Functional Specification

# 20.1 AI Analysis Trigger

## FSD-AI-001 — Generate AI Analysis

**PRD Reference:** PRD-AI-001

### Trigger

- automatic ketika Opportunity Detail dibuka; atau
- explicit `Generate Analysis`.

**Open Product Decision:** mode trigger final.

Untuk efisiensi MVP, recommended behavior adalah:

- gunakan cached analysis jika context version sama;
- generate ulang ketika belum ada atau user meminta refresh.

---

# 20.2 AI Input Contract

## FSD-AI-002 — AI Request Context

**PRD Reference:** PRD-AI-001, PRD-AI-004

AI minimal menerima:

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

### Rule

Prompt/context tidak boleh meminta AI menciptakan angka market baru yang tidak tersedia pada structured data.

---

# 20.3 AI Output Contract

## FSD-AI-003 — Structured AI Response

**PRD Reference:** PRD-AI-002

Required keys secara logical:

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

### Validation

Backend harus memvalidasi output.

Jika output tidak sesuai struktur:

1. retry terkontrol jika diizinkan;
2. atau gunakan partial/fallback response;
3. jangan render raw invalid payload.

---

# 20.4 AI Grounding Rules

## FSD-AI-004 — Grounded Response

**PRD Reference:** PRD-AI-003, PRD-AI-004

AI harus:

- mengutamakan structured context;
- tidak mengklaim data yang tidak disediakan;
- menyebut keterbatasan jika evidence terbatas;
- tidak menggunakan bahasa kepastian bisnis;
- memberikan next action yang realistis.

Jika data kurang:

> `Data yang tersedia belum cukup untuk menilai aspek ini secara kuat.`

---

# 20.5 AI Failure

## FSD-AI-005 — AI Service Failure

**PRD Reference:** PRD-AI-005, EC-02

### System Behavior

- Opportunity page tetap terbuka.
- Structured score tetap tampil.
- Evidence tetap tampil.
- AI panel menunjukkan unavailable state.
- User dapat retry.

### UI Copy

> `Analisis AI sementara tidak tersedia. Data peluang dan skor tetap dapat dilihat.`

### Logging

Server log mencatat:

- request ID;
- failure type;
- timestamp;

tanpa menulis secret/API key.

---

# 20.6 AI Analysis Persistence

## FSD-AI-006 — Cache/Persist Analysis

Recommended MVP behavior:

AI analysis dapat disimpan berdasarkan kombinasi:

- user;
- opportunity;
- profile version;
- data version.

Jika context berubah, analysis lama tidak dianggap current.

**Status:** Recommended design decision untuk mengurangi latency dan API cost.

---

# 21. Evidence Functional Specification

# 21.1 Evidence Display

## FSD-EVD-001 — Display Evidence

**PRD Reference:** PRD-DATA-001

Minimum:

- Source Name
- Source Type
- Source Date / Updated Date

Optional:

- Source URL

### Source Type Example

- Trend Data
- Government/Open Data
- News
- Prepared Dataset

These remain target examples, not values implemented or derivable in current Trend List v1. Source Type remains a target Evidence field but is deferred from Trend List v1 because current `trend_evidences` persistence and the internal `TrendDto` provide no approved structured source-type field or mapping. Do not infer it from `sourceName`, `sourceReference`, URL/domain, `supportingDetail`, Trend category, F&B subject area, or other evidence metadata. A future scope must separately approve semantics/taxonomy, authoritative mapping/input, persistence contract if required, and DTO/display mapping before Source Type is shown as structured metadata. This staged deferral does not weaken `FSD-EVD-001`.

---

# 21.2 Data Freshness

## FSD-EVD-002 — Last Updated

**PRD Reference:** PRD-DATA-002

This remains a broader Trend/Opportunity target, not a Trend List v1 requirement. For Trend List v1, show evidence `sourceDate` when known and keep it distinct from catalog `createdAt`/`updatedAt`; `sourceDate` is not a retrieval timestamp. Catalog `updatedAt` is optional in v1 and, if shown, must use **Katalog diperbarui**, not `Last updated` or source-freshness wording. Derived freshness classification and thresholds remain deferred.

---

# 21.3 Limited Evidence

## FSD-EVD-003 — Evidence Limitation State

**PRD Reference:** EC-04

Jika evidence sedikit/tidak lengkap:

- display badge `Limited Evidence` atau equivalent;
- AI instruction diperketat;
- jangan menghilangkan limitation dari UI.

---

# 22. Saved Opportunity Functional Specification

# 22.1 Save Opportunity

## FSD-SAVE-001 — Save

**PRD Reference:** PRD-SAVE-001
**Priority:** Should Have

### Preconditions

- Authenticated.
- Opportunity exists.

### Main Flow

1. User menekan Save.
2. Backend cek existing relation.
3. Jika belum ada, record dibuat.
4. UI state berubah menjadi Saved.

### Rule

Unique logical key:

```text
(user_id, opportunity_id)
```

Duplicate save tidak membuat duplicate record.

---

# 22.2 Remove Saved Opportunity

## FSD-SAVE-002 — Unsave

**PRD Reference:** PRD-SAVE-002

Menghapus relation `SavedOpportunity`, bukan master Opportunity.

---

# 22.3 Saved List

## FSD-SAVE-003 — View Saved Opportunity

User dapat melihat opportunity yang tersimpan.

Empty state:

> `Belum ada opportunity yang disimpan.`

---

# 23. Compare Functional Specification

# 23.1 Select for Comparison

## FSD-COMP-001 — Compare Selection

**PRD Reference:** PRD-COMP-001
**Priority:** Should Have

Minimum:

- 2 opportunity.

Recommended maximum:

- 3 opportunity.

Jika user mencoba >3:

> `Maksimal 3 opportunity dapat dibandingkan dalam satu waktu.`

**Catatan:** maksimum 3 adalah proposed product decision dari PRD, bukan BRD core.

---

# 23.2 Compare View

## FSD-COMP-002 — Compare Matrix

**PRD Reference:** PRD-COMP-002

Rows:

- Opportunity Score
- Fit Score
- Trend
- Competition
- Risk
- Execution Feasibility

Column:

- selected opportunities.

---

# 23.3 Compare Validation

## FSD-COMP-003

Jika kurang dari 2 opportunity:

- compare CTA disabled; atau
- tampilkan instruction.

---

# 24. Startup Roadmap Functional Specification

# 24.1 Eligibility

## FSD-ROAD-001 — Startup Roadmap Access

**PRD Reference:** PRD-ROAD-001

Hanya untuk:

`user_type = ENTREPRENEUR`

Jika UMKM mengakses URL langsung:

- request ditolak/redirect.
- Growth Roadmap ditawarkan.

---

# 24.2 Generate Startup Roadmap

## FSD-ROAD-002 — Startup Roadmap Generation

**PRD Reference:** PRD-ROAD-002, PRD-ROAD-003

### Input

- Entrepreneur Profile
- Selected Opportunity
- Opportunity Score
- Fit Score
- Risk
- Evidence/context

### Required Step Fields

- sequence;
- stage;
- action;
- objective;
- timeline;
- expected_output.

### Recommended MVP Stage Sequence

1. Market Validation
2. Competitor Check
3. Prototype
4. Test Selling
5. Evaluation
6. Go / Revise / Stop

### Functional Rules

- Setiap step harus actionable.
- Stage harus memiliki urutan.
- Roadmap tidak boleh menjamin outcome.
- Estimated cost hanya ditampilkan jika tersedia basis data/input yang cukup.

---

# 24.3 Startup Roadmap Output

## FSD-ROAD-003

Example logical model:

```json
{
  "roadmap_type": "startup",
  "opportunity_id": "...",
  "steps": [
    {
      "sequence": 1,
      "stage": "Market Validation",
      "action": "...",
      "objective": "...",
      "timeline": "...",
      "expected_output": "..."
    }
  ]
}
```

---

# 25. Growth Roadmap Functional Specification

# 25.1 Eligibility

## FSD-ROAD-004 — Growth Roadmap Access

**PRD Reference:** PRD-ROAD-004

Hanya:

`user_type = UMKM_EXISTING`

---

# 25.2 Generate Growth Roadmap

## FSD-ROAD-005 — Growth Roadmap Generation

**PRD Reference:** PRD-ROAD-005

### Input

- Business Profile
- Selected Opportunity
- Score
- Fit
- Risk
- Existing product context
- Evidence

### Recommended Stage Sequence

1. Customer Validation
2. Product Prototype
3. Limited Test Selling
4. Margin / Feedback Review
5. Rollout / Revise / Stop

### Rule

Action harus relevan untuk bisnis yang sudah berjalan.

---

# 26. Roadmap Persistence Functional Specification

# 26.1 Save Roadmap

## FSD-ROAD-006 — Roadmap Persistence

**PRD Reference:** PRD-ROAD-006

### Data

- roadmap id;
- user id;
- opportunity id;
- roadmap type;
- created at;
- steps.

### Ownership

Roadmap hanya dapat dibaca user pemilik.

---

# 26.2 View Roadmap

## FSD-ROAD-007

User dapat membuka roadmap yang sudah dibuat.

### Behavior

- load header;
- load opportunity reference;
- load ordered steps.

---

# 26.3 Roadmap Regeneration

## FSD-ROAD-008 — Regenerate

**Status:** Proposed/Should Have

Jika profile/data berubah, user dapat memilih regenerate.

System harus:

- tidak menimpa roadmap lama tanpa keputusan;
- membuat version baru atau explicit replacement.

Final versioning behavior perlu technical decision.

---

# 27. Data Functional Specification

# 27.1 Core Logical Entities

FSD mengikuti logical entities dari PRD:

1. User
2. EntrepreneurProfile
3. BusinessProfile
4. Trend
5. Opportunity
6. UserOpportunityAnalysis
7. Evidence
8. SavedOpportunity
9. Roadmap
10. RoadmapStep

---

# 27.2 Core Relationship Rules

```text
User 1 — 0..1 EntrepreneurProfile
User 1 — 0..1 BusinessProfile

Trend 1 — * Opportunity

User * — * Opportunity
through UserOpportunityAnalysis

Opportunity 1 — * Evidence
Trend 1 — * Evidence

User * — * Opportunity
through SavedOpportunity

User 1 — * Roadmap
Opportunity 1 — * Roadmap
Roadmap 1 — * RoadmapStep
```

Actual ERD cardinality dapat disempurnakan pada SRS/ERD.

---

# 27.3 Profile Ownership

## FSD-DATA-001

`user_id` harus digunakan untuk ownership profile.

No cross-user update.

---

# 27.4 Prepared Dataset Fallback

## FSD-DATA-002 — Fallback Dataset

**PRD Reference:** PRD-DATA-006, EC-01

### Purpose

Menjaga demo tetap berjalan jika live external API gagal.

### Dataset Mode

Setiap dataset dapat memiliki:

```text
source_mode:
- LIVE
- CACHED
- PREPARED
```

### UI Rule

Jika bukan live:

- jangan mengklaim real-time.
- tampilkan source/update date.

---

# 27.5 Source Refresh

## FSD-DATA-003

Exact refresh interval belum didefinisikan PRD.

System design harus memungkinkan:

- manual refresh;
- scheduled refresh;
- dataset versioning.

Final interval adalah open decision.

---

# 28. Dashboard/Data Loading Sequence

Recommended sequence:

```text
1. Authenticate
2. Load User
3. Load Active Profile
4. Load Dashboard Summary
5. Load Top Trends
6. Load Top Opportunities
7. Load Saved Summary
8. Load Latest Roadmap
```

Non-critical widget boleh lazy-load agar halaman utama tetap responsif.

---

# 29. API Functional Capabilities

Nama endpoint pada FSD bersifat logical dan dapat berubah pada API Specification.

## 29.1 Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/logout
```

## 29.2 Profile

```text
GET  /profile
POST /profile/entrepreneur
PUT  /profile/entrepreneur

POST /profile/business
PUT  /profile/business
```

## 29.3 Trends

```text
GET /trends
GET /trends/{trendId}
```

## 29.4 Opportunities

```text
GET /opportunities
GET /opportunities/{opportunityId}
GET /opportunities/{opportunityId}/score
POST /opportunities/{opportunityId}/analysis
```

## 29.5 Saved

```text
GET    /saved-opportunities
POST   /saved-opportunities/{opportunityId}
DELETE /saved-opportunities/{opportunityId}
```

## 29.6 Compare

```text
POST /opportunities/compare
```

## 29.7 Roadmap

```text
POST /roadmaps
GET  /roadmaps
GET  /roadmaps/{roadmapId}
```

### Mandatory API Behavior

- authenticated endpoints verify identity;
- resource ownership diverifikasi;
- validation error terstruktur;
- technical stack trace tidak dikirim ke client.

---

# 30. Standard Response Behavior

Exact response envelope ditetapkan pada API Specification, tetapi FSD merekomendasikan pattern:

## Success

```json
{
  "success": true,
  "data": {}
}
```

## Validation Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data belum lengkap.",
    "fields": {}
  }
}
```

## Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Silakan login untuk melanjutkan."
  }
}
```

Actual schema dapat diubah asalkan konsisten.

---

# 31. Validation Matrix

| Area | Validation |
|---|---|
| Register | Email format, unique, password confirmation |
| Login | Credentials valid |
| User Type | Allowed enum only |
| Entrepreneur Profile | Required minimum profile |
| Business Profile | Required minimum business data |
| Opportunity ID | Exists |
| Saved Opportunity | No duplicate relation |
| Compare | Minimum 2, recommended max 3 |
| Roadmap | Opportunity selected, correct user type |
| Score | Required components available |
| AI | Structured context available |

---

# 32. UI State Specification

Setiap data-driven page wajib mendukung:

## 32.1 Loading

Contoh:

- skeleton card;
- spinner;
- loading message untuk AI.

## 32.2 Success

Data ditampilkan secara normal.

## 32.3 Empty

Memberikan user action.

## 32.4 Error

Memberikan:

- user-friendly message;
- Retry jika possible.

## 32.5 Partial Success

Penting untuk VENTUREX.

Contoh:

```text
Opportunity structured data: SUCCESS
Score: SUCCESS
Evidence: SUCCESS
AI Analysis: FAILED
```

UI tetap harus menampilkan bagian yang berhasil.

---

# 33. Error Code Catalogue

Recommended logical codes:

| Code | Meaning |
|---|---|
| VALIDATION_ERROR | Input tidak valid |
| UNAUTHORIZED | Belum login |
| FORBIDDEN | Tidak punya akses |
| RESOURCE_NOT_FOUND | Data tidak ditemukan |
| PROFILE_INCOMPLETE | Profile belum lengkap |
| INSUFFICIENT_DATA | Data tidak cukup |
| EXTERNAL_DATA_UNAVAILABLE | Source eksternal gagal |
| AI_SERVICE_UNAVAILABLE | AI gagal |
| SCORE_UNAVAILABLE | Score gagal dihitung |
| ROADMAP_NOT_ALLOWED | Roadmap tidak sesuai user type |
| INTERNAL_ERROR | Error server |

Exact HTTP mapping ditentukan API specification.

---

# 34. Security Functional Specification

# 34.1 Protected Route

## FSD-SEC-001

Semua `/app/*` harus memerlukan session authenticated.

---

# 34.2 Resource Ownership

## FSD-SEC-002

Server harus memvalidasi ownership untuk:

- profile;
- saved opportunity;
- user analysis;
- roadmap.

Frontend hiding saja **tidak cukup**.

---

# 34.3 Password

## FSD-SEC-003

Password:

- hash;
- tidak log;
- tidak dikembalikan API.

---

# 34.4 API Secrets

## FSD-SEC-004

AI key/external API secret:

- server-side only;
- environment/secret management;
- tidak hardcoded di frontend.

---

# 34.5 Input Validation

## FSD-SEC-005

Backend tetap melakukan validation walaupun frontend sudah melakukan validation.

---

# 35. Privacy Functional Specification

## FSD-SEC-006 — Minimal Data Collection

Hanya kumpulkan data yang dibutuhkan personalization.

## FSD-SEC-007 — AI Data Minimization

AI request hanya mengandung field yang relevan.

Tidak perlu mengirim:

- password;
- auth token;
- secret;
- data internal lain yang tidak diperlukan.

---

# 36. Analytics Functional Specification

Analytics bersifat recommended untuk future metrics.

## FSD-ANL-001 — Event Tracking

Recommended events:

| Event | Trigger |
|---|---|
| user_registered | registration success |
| onboarding_completed | profile completed |
| trend_viewed | trend detail opened |
| opportunity_viewed | opportunity detail opened |
| opportunity_saved | save success |
| opportunity_compared | compare rendered |
| ai_analysis_generated | AI success |
| startup_roadmap_generated | startup roadmap success |
| growth_roadmap_generated | growth roadmap success |
| profile_updated | profile update success |

Analytics tidak boleh menyimpan password/secret.

---

# 37. Functional Sequence — Calon Pengusaha

```text
User
 ↓
Register/Login
 ↓
Select ENTREPRENEUR
 ↓
Complete Entrepreneur Profile
 ↓
System loads Trend Data
 ↓
System ranks Opportunities
 ↓
System calculates Opportunity Score
 ↓
System calculates Entrepreneur Fit Score
 ↓
System determines Risk
 ↓
User opens Opportunity
 ↓
System displays Evidence
 ↓
AI receives grounded context
 ↓
AI returns explanation
 ↓
User generates Startup Roadmap
 ↓
System persists Roadmap
```

---

# 38. Functional Sequence — UMKM Existing

```text
User
 ↓
Register/Login
 ↓
Select UMKM_EXISTING
 ↓
Complete Business Profile
 ↓
System loads Trend Data
 ↓
System ranks Growth Opportunities
 ↓
System calculates Opportunity Score
 ↓
System calculates Business Fit
 ↓
System determines Risk
 ↓
User opens Opportunity
 ↓
System displays Evidence
 ↓
AI receives business context
 ↓
AI returns explanation
 ↓
User generates Growth Roadmap
 ↓
System persists Roadmap
```

---

# 39. Functional Sequence — AI Failure

```text
User opens Opportunity
 ↓
Structured data loaded
 ↓
Score loaded
 ↓
Evidence loaded
 ↓
AI request
 ↓
AI ERROR
 ↓
Do NOT fail whole page
 ↓
Display structured data
 ↓
Show "AI analysis unavailable"
 ↓
Offer Retry
```

---

# 40. Functional Sequence — External Data Failure

```text
Request live trend data
 ↓
Live source unavailable
 ↓
Check cached/prepared dataset
 ├─ Available
 │    ↓
 │  Use fallback
 │    ↓
 │  Show timestamp/source mode
 │
 └─ Not Available
      ↓
   Display data unavailable state
      ↓
   Disable unsupported recommendation if minimum data missing
```

---

# 41. State Models

# 41.1 User Onboarding State

```text
NOT_STARTED
    ↓
USER_TYPE_SELECTED
    ↓
PROFILE_IN_PROGRESS
    ↓
COMPLETED
```

Optional:

`NEEDS_UPDATE`

untuk future profile requirement change.

---

# 41.2 Score State

```text
PENDING
→ AVAILABLE

PENDING
→ INSUFFICIENT_DATA

PENDING
→ ERROR
```

---

# 41.3 AI Analysis State

```text
NOT_GENERATED
→ GENERATING
→ AVAILABLE

GENERATING
→ FAILED
→ RETRY
```

---

# 41.4 Roadmap State

MVP minimum:

```text
GENERATING
→ AVAILABLE
→ SAVED
```

Progress tracking status seperti in-progress/completed adalah future feature.

---

# 42. Functional Test Scenarios

# 42.1 FT-AUTH-01 — Register Success

**Given** email belum terdaftar.
**When** valid registration submitted.
**Then** account dibuat.

# 42.2 FT-AUTH-02 — Duplicate Email

**Given** email sudah terdaftar.
**When** user register.
**Then** request ditolak.

# 42.3 FT-ONB-01 — Entrepreneur Route

**Given** authenticated new user.
**When** memilih calon pengusaha.
**Then** Entrepreneur Profile ditampilkan.

# 42.4 FT-ONB-02 — UMKM Route

**Given** authenticated new user.
**When** memilih UMKM existing.
**Then** Business Profile ditampilkan.

# 42.5 FT-TREND-01 — Trend List

**Given** trend dataset tersedia.
**When** membuka Trend Radar.
**Then** trend + source + timestamp tampil.

This approved v1 case is list-only: show only eligible published curated records, supported direction, source date when known, and truthful catalog-date semantics, without profile ranking or derived freshness. Verify successful zero-result state is `EMPTY`, query/contract failure is `ERROR`, and unreleased capability is `UNAVAILABLE`; no state may substitute fabricated Trend data.

# 42.6 FT-OPP-01 — Personalized Opportunity

**Given** complete profile.
**When** Opportunity Finder dibuka.
**Then** eligible opportunity ditampilkan.

# 42.7 FT-SCORE-01 — Score Available

**Given** scoring input lengkap.
**When** score dihitung.
**Then** result 0–100 tampil.

# 42.8 FT-SCORE-02 — Insufficient Data

**Given** minimum scoring input tidak cukup.
**When** score diminta.
**Then** `Insufficient Data`, bukan default angka.

# 42.9 FT-AI-01 — AI Analysis Success

**Given** structured context lengkap.
**When** analysis diproses.
**Then** structured analysis tampil.

# 42.10 FT-AI-02 — AI Failure

**Given** AI service unavailable.
**When** opportunity dibuka.
**Then** page tetap tersedia dan retry muncul.

# 42.11 FT-ROAD-01 — Startup Roadmap

**Given** user ENTREPRENEUR dan opportunity dipilih.
**When** generate roadmap.
**Then** `roadmap_type = startup`.

# 42.12 FT-ROAD-02 — Growth Roadmap

**Given** user UMKM_EXISTING.
**When** generate roadmap.
**Then** `roadmap_type = growth`.

# 42.13 FT-SEC-01 — Cross-User Access

**Given** roadmap dimiliki user A.
**When** user B mencoba akses.
**Then** access ditolak.

# 42.14 FT-ONB-03 — Switch Persona dengan Histori Terpisah

**Given** user sudah `COMPLETED` sebagai salah satu persona dan memiliki profile/histori.
**When** user mengonfirmasi perpindahan persona.
**Then** server mengubah persona aktif ke target, mengembalikan onboarding ke `USER_TYPE_SELECTED`, mempertahankan data persona lama, dan menampilkan profile target sebagai prefill bila tersedia.

**And** private history, saved relation, analysis, dan roadmap hanya tampil jika `user_id` serta `user_type` cocok dengan persona aktif.

---

# 43. End-to-End Acceptance Scenario A

## Calon Pengusaha

### Preconditions

- System online.
- F&B dataset tersedia.
- AI atau fallback behavior tersedia.

### Steps

1. Register.
2. Login.
3. Pilih Calon Pengusaha.
4. Isi profile.
5. Buka Dashboard.
6. Buka Trend Radar.
7. Pilih Opportunity.
8. Lihat Opportunity Score.
9. Lihat Fit Score.
10. Lihat Risk.
11. Lihat Evidence.
12. Generate AI Analysis.
13. Generate Startup Roadmap.

### Expected

- Semua data sesuai user.
- Roadmap startup.
- Tidak muncul primary Growth Roadmap.
- Score memiliki disclaimer.

---

# 44. End-to-End Acceptance Scenario B

## UMKM Existing

### Steps

1. Register.
2. Login.
3. Pilih UMKM Existing.
4. Isi Business Profile.
5. Dashboard menampilkan business summary.
6. Buka Trend.
7. Buka Growth Opportunity.
8. Lihat Score/Fit/Risk.
9. Lihat Evidence.
10. Generate AI Analysis.
11. Generate Growth Roadmap.

### Expected

- Recommendation menggunakan business context.
- Roadmap type growth.
- Startup CTA tidak menjadi primary action.

---

# 45. PRD → FSD Traceability Matrix

| PRD ID | FSD ID |
|---|---|
| PRD-AUTH-001 | FSD-AUTH-001 |
| PRD-AUTH-002 | FSD-AUTH-002 |
| PRD-AUTH-003 | FSD-AUTH-003 |
| PRD-ONB-001 | FSD-ONB-001 |
| PRD-ONB-002 | FSD-ONB-002 |
| PRD-PROFILE-001 | FSD-EPRO-001 |
| PRD-PROFILE-002 | FSD-EPRO-001 |
| PRD-PROFILE-003 | FSD-EPRO-002 |
| PRD-PROFILE-004 | FSD-BPRO-001 |
| PRD-PROFILE-005 | FSD-BPRO-002 |
| PRD-DASH-001 | FSD-DASH-001 |
| PRD-DASH-002 | FSD-DASH-002 |
| PRD-DASH-003 | FSD-DASH-003 |
| PRD-TREND-001 | FSD-TREND-001 |
| PRD-TREND-002 | FSD-TREND-001 |
| PRD-TREND-003 | FSD-TREND-002 |
| PRD-TREND-004 | FSD-TREND-003 |
| PRD-OPP-001 | FSD-OPP-001, FSD-OPP-002 |
| PRD-OPP-002 | FSD-OPP-003 |
| PRD-OPP-003 | FSD-OPP-004 |
| PRD-OPP-004 | FSD-OPP-005 |
| PRD-SCORE-001 | FSD-SCORE-001 |
| PRD-SCORE-002 | FSD-SCORE-001 |
| PRD-SCORE-003 | FSD-SCORE-002 |
| PRD-SCORE-004 | FSD-SCORE-006 |
| PRD-SCORE-005 | FSD-SCORE-004 |
| PRD-SCORE-006 | FSD-SCORE-005 |
| PRD-SCORE-007 | FSD-SCORE-003 |
| PRD-SCORE-008 | FSD-RISK-001 |
| PRD-SCORE-009 | FSD-RISK-001 |
| PRD-AI-001 | FSD-AI-001, FSD-AI-002 |
| PRD-AI-002 | FSD-AI-003 |
| PRD-AI-003 | FSD-AI-004 |
| PRD-AI-004 | FSD-AI-004 |
| PRD-AI-005 | FSD-AI-005 |
| PRD-DATA-001 | FSD-EVD-001 |
| PRD-DATA-002 | FSD-EVD-002 |
| PRD-COMP-001 | FSD-COMP-001 |
| PRD-COMP-002 | FSD-COMP-002 |
| PRD-COMP-003 | FSD-COMP-001 |
| PRD-SAVE-001 | FSD-SAVE-001 |
| PRD-SAVE-002 | FSD-SAVE-002 |
| PRD-ROAD-001 | FSD-ROAD-001 |
| PRD-ROAD-002 | FSD-ROAD-002, FSD-ROAD-003 |
| PRD-ROAD-003 | FSD-ROAD-002 |
| PRD-ROAD-004 | FSD-ROAD-004 |
| PRD-ROAD-005 | FSD-ROAD-005 |
| PRD-ROAD-006 | FSD-ROAD-006 |
| PRD-SEC-001 | FSD-SEC-001 |
| PRD-SEC-002 | FSD-SEC-002 |
| PRD-SEC-003 | FSD-SEC-003 |
| PRD-SEC-004 | FSD-SEC-005 |
| PRD-SEC-005 | FSD-SEC-005 |
| PRD-SEC-006 | FSD-SEC-004 |
| PRD-NFR-003 | FSD-DATA-002 |
| EC-01 | FSD-DATA-002 |
| EC-02 | FSD-AI-005 |
| EC-03 | FSD-OPP-001 |
| EC-04 | FSD-EVD-003 |
| EC-05 | FSD-SCORE-003 |
| EC-06 | FSD-ROAD-001, FSD-ROAD-004 |

---

# 46. Open Decisions Carried from PRD

FSD tidak boleh menganggap item berikut sudah final karena PRD masih menandainya sebagai open decision:

1. Opportunity Score weights;
2. Fit Score weights;
3. Confidence Score formula;
4. exact external data source;
5. Compare final inclusion jika jadwal sempit;
6. exact roadmap duration;
7. data refresh interval;
8. hard performance SLA;
9. exact chart type;
10. exact authentication mechanism.

Tambahan functional decision yang juga perlu persetujuan:

12. AI analysis auto-generate vs manual trigger;
13. analysis cache policy;
14. roadmap regeneration/versioning;
15. risk thresholds;
16. score normalization method.

---

# 47. Change Control

Perubahan requirement setelah FSD baseline harus dicatat minimal dengan:

- Change ID;
- requested by;
- reason;
- affected BRD/PRD/FSD IDs;
- impact to UI;
- impact to backend;
- impact to database;
- impact to AI;
- impact to test;
- decision.

Perubahan scope Must Have harus direview sebelum development diteruskan.

---

# 48. Definition of Ready for Development

Sebuah FSD item siap dikembangkan jika:

- PRD reference tersedia;
- actor jelas;
- trigger jelas;
- precondition jelas;
- input jelas;
- validation jelas;
- main flow jelas;
- alternative/error flow jelas;
- output jelas;
- data entity diketahui;
- acceptance criteria tersedia;
- open decision kritis sudah resolved.

---

# 49. Functional Definition of Done

Fungsi dianggap selesai bila:

1. Main flow bekerja.
2. Input validation bekerja.
3. Error state tersedia.
4. Authorization diverifikasi.
5. Data tersimpan/terbaca sesuai spec.
6. Loading state tersedia.
7. Empty state tersedia jika relevan.
8. API error tidak menyebabkan crash.
9. Acceptance criteria lulus.
10. QA test case utama lulus.
11. Tidak ada Critical/Blocker defect.
12. Berjalan pada deployed environment untuk core MVP.
13. Traceability PRD → FSD → Test Case dapat ditunjukkan.

---

# 50. MVP Functional Acceptance Summary

VENTUREX MVP dianggap memenuhi FSD jika:

- Register/Login berfungsi.
- User Type Selection berfungsi.
- Entrepreneur Profile berfungsi.
- Business Profile berfungsi.
- Dashboard berbeda berdasarkan user type.
- Trend List v1 menampilkan source dan source date bila diketahui; catalog update time, bila ditampilkan, diberi label **Katalog diperbarui**. Derived freshness classification and thresholds remain future target behavior.
- Opportunity Finder menggunakan profile.
- Opportunity Detail lengkap.
- Opportunity Score bekerja atau menunjukkan Insufficient Data.
- Fit Score bekerja atau menunjukkan Insufficient Data.
- Risk memiliki level dan reason.
- Evidence dapat ditampilkan.
- AI Analysis grounded dan memiliki failure fallback.
- Startup Roadmap hanya untuk calon pengusaha.
- Growth Roadmap hanya untuk UMKM.
- Roadmap tersimpan.
- Data antar-user terisolasi.
- External source memiliki fallback untuk demo.

- Trend v1 is not release-complete until the separately scoped Dashboard Trend availability integration removes any false `UNAVAILABLE` state and keeps copy, CTA, and navigation truthful.
- UI mendukung loading, empty, error, dan partial success.
- Aplikasi dapat dijalankan secara online dan stabil pada core demo flow.

---

# 51. Final Functional Definition

> **VENTUREX AI secara fungsional merupakan web-based decision support system untuk sektor Food & Beverage yang menggabungkan profil pengguna, trend intelligence, opportunity matching, scoring, risk assessment, evidence, AI explanation, serta actionable roadmap dalam dua jalur: Discover → Analyze → Start untuk calon pengusaha dan Discover → Analyze → Grow untuk UMKM existing.**

---

# 52. Reference Document

FSD ini secara langsung diturunkan dari:

**VENTUREX AI — Product Requirement Document (PRD) v1.0**

dengan prinsip:

> **PRD menentukan apa yang harus dilakukan produk; FSD menjelaskan bagaimana fungsi tersebut harus berperilaku secara rinci.**

Jika terdapat perbedaan scope atau product behavior, PRD harus direview terlebih dahulu sebelum FSD diubah menjadi implementasi final.

---

**END OF DOCUMENT**

## Product Owner decision amendment, 14 October 2026

- Trend Radar no longer queries the published catalog for its main list. At that time it requested the existing Bright Data adapter only after an authenticated user action; page load and errors did not trigger a provider call or catalog fallback.
- Dashboard and Opportunity Finder do not render the 2025 catalog. Catalog rows remain unchanged as archived records.
- A generated idea is stored under its authenticated owner only after consent, source-snapshot ownership/freshness checks, provider output schema validation, and secure 9Router configuration. It remains a hypothesis and is not linked to the global Opportunity or scoring lifecycle.
- User-generated hypotheses use a separate persistence contract and are listed/saved only for the owning user. Existing normal AI Opportunity guard and published catalog lifecycle remain separate.

## Product Owner decision amendment, 18 October 2026: SearchApi Google Trends Explore

- Replace the Bright Data Trending Now panel on /trends with SearchApi.io Google Trends Explore.
- Display exactly Top Queries and Rising Queries. Use a read-only profile query: preferredProductType for ENTREPRENEUR and businessName for UMKM_EXISTING; do not use products[0].name.
- Retrieve data only after the user's explicit action. The server resolves the persisted profile for the authenticated owner, validates the request filters, and keeps the SearchApi bearer key server-side.
- Support the approved preset periods, dynamically generated year choices, custom date and hourly ranges, and the five approved search properties. Use geo=ID, cat=0, and tz=-420; retain the timezone-sign ambiguity note until verified.
- Do not treat provider observations as curated or validated Trend records, fall back to Bright Data, add a product selector or query input, or persist results in the database.
- The existing Bright Data services and routes remain isolated for their current consumers.

## Product Owner decision amendment, 18 October 2026: Trend Radar timeseries and regional interest

- The existing SearchApi Explore refresh action also requests `TIMESERIES` and `GEO_MAP` through the authenticated `/api/v1/trend-radar/interest` endpoint. One click loads all four Trend Radar sections with the same selected filters.
- Timeseries observations are normalized to chronological Unix-second timestamps, source labels, and nullable 0-100 relative interest. Duplicate or invalid timestamps are omitted; blank/missing values stay null; exact profile-query matching is required. Chart gaps are not interpolated, and no Quick Comparisons percentages are derived.
- Regional interest retains provider names/codes, sorts descending by available index with stable code tie-breaking, and shows a ranked accessible table. The choropleth uses the explicitly mapped geoBoundaries Indonesia ADM1 2017 simplified dataset (34 features, ODbL 1.0 attribution). Unknown region codes remain in the table and never map approximately. Missing geography is neutral and is not set to zero.
- Each dataset reports `available`, `empty`, or `failed` separately. Provider cache and daily budget are shared with the existing SearchApi adapter; fresh data for all sections may use up to three provider requests. A user may retry failed regional interest from its section; cached successful sibling datasets are reused when available. This retry is explicit, never automatic. `RELATED_QUERIES` uses a dedicated 30-second default timeout, independently configurable up to 30 seconds; regional `GEO_MAP` calls use a 30-second default timeout, independently configurable up to 30 seconds; `TIMESERIES` and other calls retain `SEARCHAPI_TIMEOUT_MS`. The interest and related-query routes allow up to 45 seconds for provider timeouts to resolve cleanly. For Worldwide GEO_MAP requests, use `region=COUNTRY`; selected country/subregion requests use `region=REGION`. No database persistence is added. Existing `geo=ID`, `cat=0`, `tz=-420`, filter validation, and server-side credentials remain in force; timezone-sign ambiguity remains documented.

## Product Owner decision amendment, 18 October 2026: SearchApi-backed Opportunity Finder

- The Opportunity Finder obtains source options from `related_queries.top` and `related_queries.rising` through the existing SearchApi adapter. It resolves `preferredProductType` for Entrepreneur and `businessName` for UMKM through the same server-side profile resolver used by Trend Radar.
- The user presses **Muat Sinyal Google Trends** to request source rows. Page rendering does not call SearchApi. The selected filter is passed to the existing adapter, so a valid matching cache entry is reused; existing timeout, budget, and no-retry rules remain in force.
- The source endpoint issues a short-lived AES-GCM encrypted token tied to the authenticated owner and adapter cache expiry. It requires a non-template Auth.js `AUTH_SECRET` with at least 32 characters before calling SearchApi. The generation endpoint accepts the token, explicit consent, and `opportunities-searchapi-ninerouter-profile-v2`; it decrypts and validates ownership, schema, and freshness server-side. Browser-supplied profile, source text, or metrics are never authoritative. Existing v1 consent is rejected and must be renewed.
- Top uses `interestIndex`; Rising uses `growthLabel`, `growthPercent`, and `isBreakout`. A Breakout value remains the provider label and is not converted to a percentage. No `LIKELY_FNB` classification is assigned to SearchApi rows.
- Before consent, the UI names the profile data categories that may be processed. At generation time, the server rebuilds a type-safe projection from the authenticated owner’s persisted profile and active reference records. Entrepreneur context may include product preference/categories, segments, channels, budget, location, experience, time commitment, business objective, and notes. UMKM context may include business name/category/description, current products and prices, average price range, segments, channels, location, and notes. Account identifiers, email, session data, credentials, and browser-authored profile values are excluded. This private Finder disclosure does not alter the published Opportunity Analysis projection.
- AI generation continues through the existing 9Router adapter and structured hypothesis validation. `NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED` is a separate server-side gate, default `false`; it does not inherit the Bright Data gate. Real-profile inference rejects public HTTP even when the local development public-HTTP opt-in is enabled. 9Router may relay requests to an upstream model provider; retention and downstream processing are unverified, and the consent does not authorize training or fine-tuning.
- The prompt treats profile text and SearchApi terms as untrusted task data. Generated hypotheses distinguish profile fit, observed search evidence, assumptions, evidence gaps, limitations, and validation steps. Each hypothesis cites present profile fields and the selected server-issued evidence ID. Numeric values must be supported by the current profile or selected evidence; unsupported financial-performance claims, guarantees, and persona-incompatible opportunity types are rejected. When at least one valid profile fact and one valid selected SearchApi fact exist, missing sales, customer-validation, or financial data is represented as an assumption, evidence gap, limitation, and proposed experiment; it does not by itself block an exploratory hypothesis. If the model nevertheless returns `INSUFFICIENT_EVIDENCE` despite those valid facts, the server makes one targeted generation retry. For an existing-business response rejected because it presents a current product as a new menu, the server makes one targeted correction retry that redirects the model to a positioning/channel experiment or a substantively distinct variant, then repeats the full materialization and grounding validation. A remaining rejection is not persisted. A remaining `INSUFFICIENT_EVIDENCE` is shown without creating a saved hypothesis; that outcome is reserved for context without usable profile or search facts.
- The generation prompt and strict Zod schema share explicit output field, enum, type, nullability, string-length, and array-length constraints. Numeric grounding checks semantic unit and provenance, so a documented search period or retrieval date is not confused with a sales metric, and an interest index cannot substantiate revenue or customer counts. Invalid schema, malformed JSON, unsupported numeric/financial claims, and insufficient evidence remain separate outcomes; provider rejection never persists a hypothesis or retries automatically. Development diagnostics use trusted schema paths and safe metadata only.
- The server builds financial availability per metric and subject, with `KNOWN`, `PARTIAL`, or `UNKNOWN` status and trusted source references. Average business prices, each existing product price, proposed-product prices, competitor prices, willingness to pay, costs, revenue, margin, sales volume, and budget are not interchangeable. The model returns only server-issued `evidenceGapIds`; the server rejects unknown/duplicate IDs and materializes approved text into the existing `evidenceGaps` string array before saving. This preserves saved-row and response compatibility without a migration. Numeric financial claims outside this catalogue continue through source-, unit-, and subject-aware grounding checks. Safe diagnostics omit raw claim text and private profile values.
- Direct loopback HTTP for this flow is limited to development and the validated `localhost`, `127.0.0.1`, or `::1` endpoint on port `20128` with path `/v1`, no embedded credentials, and `NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY=true`. The tunnel-confirmation flag remains reserved for a verified encrypted tunnel; the UI and server use the same transport decision.
- SearchApi result sets and source tokens are not persisted. A successful private hypothesis stores only its bounded SearchApi provenance and keyed context fingerprint in the existing JSONB source reference; raw profile context and prompts are not persisted. The source-schema union keeps historical Bright Data hypotheses readable, and optional response fields preserve compatibility with older hypotheses. No database migration or global Opportunity/Trend lifecycle operation is added.

## Product Owner decision amendment, 20 October 2026: geography filter and responsive Finder layout

- Add a searchable, keyboard-accessible geography selector backed by `GET /api/v1/trend-radar/geographies`. Options use the provider's supported Google Trends location codes; Worldwide is `geo=""`. The catalog is served by the application and no paid SearchApi request is made to populate the selector.
- Apply the selected code to `/api/v1/trend-radar/related-queries`, `/api/v1/trend-radar/interest`, and `/api/v1/opportunities/signals`. Default/omitted `geo` resolves to Worldwide. The server rejects codes absent from the provider catalog before provider access. Geo is part of SearchApi cache identity and encrypted Opportunity evidence provenance.
- Preserve country and subdivision region rows returned for any selected geography. Render the ranked table for all geographies. Render the existing choropleth only for `geo="ID"`; never display the Indonesia boundary map for a different selection.
- Keep provider requests behind an explicit user action. A filter change clears loaded results so a previous geography cannot be mistaken for the current one. Keep existing no-retry, timeout, budget, authentication, consent, and non-persistence rules.
- Use a compact, responsive filter panel with standard 44px minimum control height. Align its outer width with the hypothesis result cards. Filter controls stack on narrow screens and share a row at wide breakpoints. Shorten helper copy without removing material consent or privacy information.
- Acceptance: select Worldwide, Indonesia, a non-Indonesia country, and an international subdivision; verify the chosen geo reaches each API and provider request, cache/evidence provenance is partitioned by geo, non-ID regional rows render in the table, and no non-ID request renders the Indonesia map. Verify keyboard selection and mobile reflow.

## Product Owner decision amendment, 20 October 2026: remove a private hypothesis

- Render a clearly labeled **Hapus hipotesis** action on each private hypothesis card in Opportunity Finder and Saved Opportunities. Ask for confirmation before deletion and explain that a saved hypothesis will also be removed from Saved Opportunities.
- Send `DELETE /api/v1/opportunities/ideas` with the strict body `{ id }`. Require same-origin validation, a valid UUID, and an authenticated eligible user. Return `204 No Content` for an absent row as well as a successful deletion.
- Delete only by the compound owner scope `{ id, userId }`; do not accept client-supplied owner identity or affect global Opportunity/Trend records. No schema change or migration is needed.
- Remove the card from the current view only after the server confirms success. On cancellation or request failure, keep the hypothesis visible; disable its actions while deletion is pending and announce success/error status accessibly.
- Acceptance: verify confirmation cancel makes no request; success removes an unsaved and a saved hypothesis from the current list and subsequent list reads; failed requests retain the card; malformed IDs and cross-origin requests are rejected; one account cannot delete another account's hypothesis.


### Trend Radar history and exploration journey (2026-10-21)

Trend Radar retains up to 20 successful, schema-validated observations per authenticated account in this browser, subject to a bounded storage budget. Entries include product, geography, period, search property, observation time, original request options and available interest datasets. Failed requests do not replace history. Opening an entry restores its results and filters without calling SearchApi; the active observation is restored on returning to the page and supplies the Dashboard preview, including earlier products. Retrieval timestamps identify historical data. Previous single-result snapshots remain readable. Browser storage denial leaves current results usable; history is not synchronized across devices and can be lost when browser data is cleared.

Dashboard exploration follows an ordered, responsive journey: Trend Radar, Opportunity Finder, saved opportunities, then the existing persona-specific roadmap. Numbers show navigation order only; they do not claim completed tasks or lock later steps. Existing private hypothesis previews remain owner-scoped. This amendment introduces no API endpoint, database table or migration, and adds no saved-detail or roadmap capability.


## Entrepreneur review and permanent save amendment (21 October 2026)

For private ENTREPRENEUR hypotheses, saving moves from Finder cards to the bottom of the score-detail page after Opportunity Score, Fit Score, target consumers, competition, risks, initial needs and evidence. Profile fields are loaded from the authenticated account; opening a detail page makes no paid inference request. Explicit consent and an analysis action remain required. The only optional financial input here is the concept's estimated minimum capital, displayed as Rp with Indonesian thousands separators and submitted as a whole numeric rupiah amount. It is separate from the account's available budget.

PATCH /api/v1/opportunities/ideas keeps the existing {id, saved} fields and adds optional reviewed:true and analysisFingerprint (64 lowercase hexadecimal characters). Entrepreneur saves require reviewed:true, both numeric scores, structured concept requirements, and a current profile-bound analysis. The server compares the supplied fingerprint to the stored snapshot under a transaction row lock. Unknown/missing data is never replaced with invented scores to unlock saving. Conflicting or incomplete saves return 409 ANALYSIS_CHANGED or ANALYSIS_REQUIRED. Repeat saves are idempotent.

Once an entrepreneur hypothesis is saved, isSaved cannot return to false, DELETE is rejected with 409 SAVED_PERMANENT, and its analysis snapshot is immutable. Existing saved entrepreneur records are preserved and protected. Unsubmitted hypotheses remain deletable. UMKM behavior is outside this change. Data stays in existing user_generated_opportunities JSONB and saved fields, with no migration or TTL added; no provider call is needed to reopen stored scores. This amendment supersedes earlier unsave/delete instructions for private entrepreneur hypotheses only.


## Local competitor matching v2 (21 October 2026)

Normalize administrative locality prefixes (including Kota/Kabupaten Administrasi), Jkt. aliases and directional Jakarta names before matching. Match complete locality names rather than arbitrary substrings, preserve Jakarta Utara/Selatan/Timur/Barat/Pusat distinctions, and reject street-only occurrences. Google Maps queries combine product, canonical city, profile province when present, and Indonesia. No guessed coordinates or automatic paid retries are added.

Retain optional competitors.diagnostics in existing analysis JSONB: receivedCount, inspectedCount (maximum 20), invalidCount, outsideCityCount and duplicateCount. sampleCount is the unique locally matching count; at most five example places remain stored. Counters contain no extra raw addresses. The Competition disclosure shows these counters, distinguishes empty provider results from filtered results and keeps zero samples unknown. Old snapshots without diagnostics remain readable. Provider error envelopes are not treated as empty search evidence.

The local Maps cache key moves to LOCAL_COMPETITOR_SAMPLE_V2, and input fingerprints include competitor matching version 2, preventing reuse of old empty samples for new analyses. Saved permanent snapshots stay immutable. Reanalysis applies only to unsaved hypotheses using existing consent and owner checks; the scoring formula and weights do not change.

## Existing Pengusaha completion amendment (22 October 2026)

The authorized UMKM_EXISTING improvement is specified in [Existing Business Completion.md](Existing%20Business%20Completion.md). This adds business-specific private hypothesis analysis, deterministic preliminary Opportunity Score and Business Fit, reasoned execution risk, owner-scoped Compare, five-stage private Growth Roadmap and 12-item paginated archives. It does not alter Entrepreneur behavior or provider configuration. Optional businessAnalysis and growthRoadmap snapshots use existing hypothesis JSONB; no catalog foreign key or migration is introduced. POST /api/v1/opportunities/ideas/{id}/analysis dispatches by authenticated persona; Existing accepts strict {consent:true,refresh?:boolean,proposedPrice?:{min:integer,max:integer}|null}. POST /api/v1/opportunities/ideas/{id}/roadmap creates or reopens the owner's Growth snapshot; a new snapshot requires saved state, complete and fresh business analysis. Existing saves remain reversible, and stored roadmaps remain readable after unsave.

For Existing only, Trend Radar and Finder accept an optional queryKey: business (default), category, or product:0 through product:19. The server resolves it against the authenticated current profile and active category; client query text is never accepted. Selection is explicit and does not trigger provider requests. This supersedes the 18 October no-selector rule for Existing; Entrepreneur query behavior remains unchanged. Score weights, coverage, missing-data rules, risk thresholds, snapshot freshness and persistence behavior are defined in the linked configuration.


## Weekly Food & Drink notification contract — current implementation

The active flow accepts only a strict enabled toggle. A server worker creates at most one Food & Drink / Worldwide digest per user/week on Monday after 12.00 WIB, persists up to three usable Top and Rising rows, and queues optional Web Push. Missed days are not replayed. See [Trend Notifications.md](Trend%20Notifications.md).


## Amendment: journey reports and roadmap completion (22 October 2026)

See [Journey Reports](Journey%20Reports.md) for the authorized two-persona PDF/XLSX export, explicit stage completion gate, owner-scoped progress persistence/API, and device support acceptance contract.
