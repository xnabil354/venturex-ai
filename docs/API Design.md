# API DESIGN

> **Implementation snapshot — 24 October 2026:** daftar route handler yang benar-benar tersedia ada di [Current Implementation](Current%20Implementation.md#api-yang-benar-benar-memiliki-route-handler). Dokumen ini juga menyimpan target/proposal kontrak; keberadaan spesifikasi endpoint di bawah tidak otomatis berarti endpoint tersebut telah diimplementasikan. Khususnya, halaman curated Trends dan beberapa read flow memakai server-side services tanpa REST route publik.

21 October recovery refinement: optional analysis.planningContext.timeCommitment preserves historical capacity; roadmap generatorVersion also accepts personalized-v3 and personalized-v4 (22 October text correction). Compare recovers from unavailable owner-scoped choices with a neutral notice. See Entrepreneur MVP Completion.md.
21 October refinement: analysis responses may include optional referenceLabels; roadmap metadata may include generatorVersion personalized-v2. Compare supports from=finder|saved for return navigation; IDs remain owner validated. See Entrepreneur MVP Completion.md.

Entrepreneur MVP completion (21 October 2026): see `Entrepreneur MVP Completion.md`. Profile create/update now requires nonblank preferredProductType; legacy read remains nullable. Finder/Saved pages accept page (12 rows, one-row lookahead). Private Compare reads 2–3 UUIDs from /opportunities/compare?ids=... under authenticated owner/persona scope, no paid inference. POST /api/v1/opportunities/ideas/:id/roadmap accepts only {}, maximum 256 bytes, same-origin and completed ENTREPRENEUR required. It requires a permanently saved analyzed hypothesis, returns {data: roadmap}, is idempotent, and returns 400/401/403/404/409/503 for invalid input/auth/persona/absent or cross-owner/ineligible/storage failure. All private responses are no-store.

Entrepreneur Analyze v2 amendment (21 October 2026): `/opportunities/hypotheses/{id}` remains an authenticated owner-scoped read page. Add explicit `POST /api/v1/opportunities/ideas/{id}/analysis` with strict `{ consent: true, refresh?: boolean, capitalMin?: integer | null }` (2048-byte limit). Require same-origin, UUID, completed ENTREPRENEUR, and `{ id, userId, userType: ENTREPRENEUR }` ownership before profile/provider access. Return private/no-store `{ data: snapshot }`, including valid partial results; errors use `{ error: { code, message } }` with 400/401/403/404/429/503. Snapshot is an additive optional `hypothesis.analysis` field on existing private idea reads, not a change to the generation provider schema or public catalog score endpoints. Formula/version, cache/cooldown and source limitations are in `Entrepreneur Deep Analysis.md`.

Dashboard exploration amendment (21 October 2026): Dashboard is composed server-side from the authenticated user's existing private-hypothesis and roadmap repositories. It introduces no public endpoint or request-body change. Private preview navigation uses `/opportunities#hypothesis-<id>` and `/saved#hypothesis-<id>`. Account-scoped, schema-validated browser Trend Radar snapshots are presentation data only; they are never accepted as generation evidence or sent back as an authoritative profile/source reference. Opening Dashboard does not call SearchApi or the LLM.
## VENTUREX AI — Future Trend Intelligence & Business Growth Navigator

**Dokumen:** API Design
**Versi:** 1.0
**Status:** API Baseline untuk MVP Hackathon
**Trend API exception:** Historical Trend endpoints and examples remain proposal-only, except for the approved SearchApi Explore route group documented in sections 88–91. The persistent curated Trend catalog continues to use the internal `TrendService` and `TrendDto`; the Explore endpoints return transient provider observations and do not change the catalog contract.
**Referensi Produk:** `VENTUREX_AI_PRD.md`
**Referensi Fungsional:** `VENTUREX_AI_FSD.md`
**Referensi Database:** `Database Design.md`
**Referensi Teknologi:** `Tech Stack Requirement.md`
**Framework:** Next.js App Router — Route Handlers
**Language:** TypeScript
**Authentication:** NextAuth.js / Auth.js
**Database Access:** Sequelize v6 → PostgreSQL
**API Style:** REST-oriented JSON API
**Base Product API:** `/api/v1`

---

# 1. Tujuan Dokumen

API Design ini menerjemahkan kebutuhan pada PRD, FSD, dan Database Design VENTUREX AI menjadi kontrak antarmuka backend yang konsisten, aman, dapat diuji, dan siap digunakan oleh frontend maupun service internal.

Dokumen ini menetapkan:

- endpoint;
- HTTP method;
- authentication;
- authorization;
- request schema;
- response schema;
- validation;
- status code;
- error code;
- filtering;
- sorting;
- pagination;
- idempotency;
- rate-limit behavior;
- AI API behavior;
- database mapping;
- ownership rule;
- cache behavior;
- traceability requirement.

Tujuannya:

> **Frontend dan backend harus dapat dikembangkan secara paralel dengan kontrak API yang jelas dan tidak ambigu.**

---

# 2. Source of Truth

Hierarki requirement:

```text
BRD
↓
PRD
↓
FSD
↓
DATABASE DESIGN
↓
API DESIGN
↓
ROUTE HANDLERS / SERVICES / TESTS
```

Jika terdapat konflik:

1. tujuan bisnis mengikuti BRD;
2. scope produk mengikuti PRD;
3. perilaku fungsi mengikuti FSD;
4. persistence mengikuti Database Design;
5. API Design menentukan kontrak HTTP.

API tidak boleh menambah fitur bisnis yang tidak ada pada PRD/FSD.

---

# 3. API Architecture

High-level flow:

```text
Browser / Client
      ↓
Next.js Route Handler
      ↓
Authentication / Authorization
      ↓
Zod Request Validation
      ↓
Application Service
      ↓
Domain Logic
      ↓
Repository
      ↓
Sequelize
      ↓
PostgreSQL
```

Untuk AI:

```text
Client
  ↓
Route Handler
  ↓
OpportunityAnalysisService
  ├── Profile Repository
  ├── Opportunity Repository
  ├── Scoring Engine
  ├── Evidence Repository
  └── AI Adapter
          ↓
       LLM Provider
```

Route Handler tidak boleh berisi business logic besar.

---

# 4. API Design Principles

## 4.1 Resource-Oriented

Gunakan resource noun:

```text
/trends
/opportunities
/roadmaps
```

Hindari:

```text
/getAllTrendData
/createNewRoadmapForUser
```

## 4.2 HTTP Semantics

Gunakan:

```text
GET     read
POST    create / execute generation
PUT     full update/upsert
PATCH   partial state change
DELETE  delete relationship/resource
```

## 4.3 Stateless Product API

Product API tidak menyimpan server-memory session state sebagai sumber kebenaran.

Authentication context berasal dari NextAuth session/JWT.

## 4.4 Server-Side Authorization

Frontend hiding **bukan** authorization.

Setiap protected endpoint harus memeriksa user/session di server.

## 4.5 Consistent Contract

Semua application endpoint menggunakan envelope yang konsisten.

## 4.6 Explicit Failure

Jangan mengubah kegagalan menjadi response `200` dengan error tersembunyi.

Gunakan HTTP status yang benar.

---

# 5. API Namespace & Versioning

Product API:

```text
/api/v1
```

## Billing Sandbox amendment

Billing uses additive v1 endpoints: `GET /api/v1/billing`, `POST /api/v1/billing/checkout`, and provider-only `POST /api/v1/billing/duitku/callback`. Checkout accepts only a catalog product code; the server owns price, credits, owner, order ID, and entitlement. The return URL has no authority to settle a transaction. See `docs/Billing Sandbox MVP.md` for the full contract.

Checkout rejects an active Premium-to-Premium or Pro-to-Pro purchase with `409 PLAN_ALREADY_ACTIVE` before inserting a pending payment or contacting Duitku. Other plan transitions and top-ups retain their existing behavior.

`GET /api/v1/billing` also returns `usageCosts: [{ usage, credits }]` alongside the existing summary fields so the browser can check the current tariff before an AI action. `GET /api/v1/billing/events` is an authenticated, private, non-cacheable SSE stream with `ready`, `changed`, and `unavailable` events; event payloads contain no balance or user data. On `ready` or `changed` the browser fetches the authoritative billing summary, while `unavailable` marks the stream as disconnected. PostgreSQL notifications are emitted inside the credit mutation transaction and delivered after commit. AI routes remain the final authority for entitlement and credit sufficiency.

The summary also includes `requiresRenewal: boolean`, true only when a previously active paid plan has expired and no scheduled replacement is active, `trialEndsAt: string`, the fixed end of the 30-day Free trial, and `accessDaysRemaining: number`, the rounded-up remaining days of the current access period. Free trial permits AI use with sufficient trial or top-up credits until that date. Protected application pages redirect users requiring renewal to `/billing`; billing and billing-return pages remain accessible. This page-level redirect does not replace the existing authorization and entitlement checks on API routes.

Operator endpoints are restricted server-side to an `ADMIN` session: `GET /api/v1/admin/transactions`, `GET /api/v1/admin/billing/settings`, `PATCH /api/v1/admin/billing/products/{productCode}`, and `PATCH /api/v1/admin/billing/usage/{usageKind}`. Mutations require the same origin, strict JSON bodies, bounded numeric values, and a configuration version; they never alter payment status or historical payment snapshots.

Contoh:

```text
GET /api/v1/trends
GET /api/v1/opportunities
POST /api/v1/roadmaps
```

Authentication handler milik NextAuth tetap berada pada:

```text
/api/auth/*
```

karena mengikuti integration contract NextAuth.

## Versioning Rule

Breaking change:

```text
/api/v1 → /api/v2
```

Non-breaking addition tidak memerlukan version baru.

---

# 6. Authentication Design

PRD/FSD membutuhkan:

- Register;
- Login;
- Logout;
- protected resources.

Tech Stack menetapkan:

- NextAuth/Auth.js;
- Credentials Provider;
- JWT session;
- Argon2id password hash.

## 6.1 Registration

Registration adalah custom application endpoint:

```text
POST /api/v1/auth/register
```

## 6.2 Login

Login **tidak dibuat ulang sebagai custom password API**.

Logical requirement FSD:

```text
POST /auth/login
```

dipenuhi melalui NextAuth Credentials flow:

```text
signIn("credentials")
↓
/api/auth/*
↓
AuthService
↓
UserRepository
↓
Argon2 verify
```

## 6.3 Logout

Logical logout requirement dipenuhi dengan:

```text
signOut()
```

melalui NextAuth handler.

## 6.4 Session

Current session dapat dibaca menggunakan NextAuth API/helper.

Untuk application frontend, server component/service sebaiknya menggunakan:

```text
auth()
```

daripada memanggil HTTP session endpoint dari server ke server.

---

# 7. Authentication Header / Cookie

MVP web application menggunakan:

> **Secure HttpOnly session cookie managed by NextAuth**

Client tidak perlu menyimpan bearer JWT di `localStorage`.

API Route Handler mendapatkan user melalui server-side auth context.

Rule:

```text
No authenticated session
→ 401 UNAUTHORIZED
```

---

# 8. API Media Type

Request/response:

```http
Content-Type: application/json; charset=utf-8
Accept: application/json
```

Upload binary tidak termasuk MVP API.

---

# 9. Standard Success Response

## Single Resource

```json
{
  "success": true,
  "data": {
    "id": "..."
  },
  "requestId": "req_..."
}
```

## Collection

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 100,
    "totalPages": 5
  },
  "requestId": "req_..."
}
```

## Delete / No Content

Untuk operasi yang tidak perlu body:

```http
204 No Content
```

boleh digunakan.

---

# 10. Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data belum lengkap.",
    "fields": {
      "email": [
        "Format email tidak valid."
      ]
    }
  },
  "requestId": "req_..."
}
```

`fields` optional.

Raw stack trace tidak boleh dikirim.

---

# 11. Request ID

Setiap request direkomendasikan memiliki:

```text
requestId
```

Sumber:

- generated server-side; atau
- trusted reverse proxy request ID.

Header response recommended:

```http
X-Request-Id: req_xxx
```

Digunakan untuk:

- tracing;
- logging;
- debugging.

---

# 12. Date / Time Format

API menggunakan:

> ISO 8601 UTC

Example:

```text
2026-09-26T12:00:00.000Z
```

Date-only:

```text
2026-09-26
```

---

# 13. UUID Format

Semua resource ID:

```text
UUID
```

Invalid UUID:

```text
400 VALIDATION_ERROR
```

Bukan query database lalu mengembalikan 500.

---

# 14. Money Format

Nilai Rupiah dikirim sebagai integer:

```json
{
  "budgetMin": 5000000,
  "budgetMax": 10000000
}
```

Tidak:

```json
{
  "budgetMin": "Rp5.000.000"
}
```

Formatting Rupiah adalah responsibility UI.

---

# 15. Score Format

Score API:

```json
{
  "value": 84.5,
  "status": "AVAILABLE"
}
```

Jika tidak cukup data:

```json
{
  "value": null,
  "status": "INSUFFICIENT_DATA"
}
```

Jangan mengembalikan `0` sebagai placeholder.

---

# 16. Pagination Convention

Default:

```text
page=1
pageSize=20
```

Maximum MVP:

```text
pageSize=100
```

Example:

```http
GET /api/v1/trends?page=1&pageSize=20
```

Response:

```json
{
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 52,
    "totalPages": 3
  }
}
```

Invalid:

```text
page < 1
pageSize < 1
pageSize > 100
```

→ `400 VALIDATION_ERROR`.

---

# 17. Sorting Convention

Query:

```text
sort=<field>
order=asc|desc
```

Example:

```http
GET /api/v1/opportunities?sort=opportunityScore&order=desc
```

Hanya field dalam allowlist yang dapat digunakan.

User input tidak boleh langsung dimasukkan sebagai SQL `ORDER BY`.

---

# 18. Filtering Convention

Gunakan explicit query parameter.

Example:

```http
GET /api/v1/trends?direction=RISING&categoryId=<uuid>
```

Bukan generic dynamic SQL filter.

---

# 19. Search Convention

MVP optional:

```text
q=<text>
```

Example:

```http
GET /api/v1/opportunities?q=matcha
```

Backend menggunakan safe query via Sequelize.

---

# 20. HTTP Status Code Standard

| Code | Penggunaan |
|---:|---|
| 200 | GET/PUT/PATCH berhasil |
| 201 | Resource baru dibuat |
| 204 | Delete/logout-like resource operation berhasil tanpa body |
| 400 | Input/parameter tidak valid |
| 401 | Tidak terautentikasi |
| 403 | Authenticated tetapi tidak berhak |
| 404 | Resource tidak ditemukan |
| 409 | Conflict / duplicate resource |
| 422 | Business rule / data secara sintaks valid tetapi tidak dapat diproses |
| 429 | Rate limit |
| 500 | Internal server error |
| 502 | Upstream provider memberi invalid/bad response |
| 503 | External/AI service unavailable |

---

# 21. API Error Codes

Machine-readable codes:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
RESOURCE_NOT_FOUND
CONFLICT
EMAIL_ALREADY_EXISTS
PROFILE_INCOMPLETE
USER_TYPE_NOT_SELECTED
INVALID_USER_TYPE
INSUFFICIENT_DATA
SCORE_UNAVAILABLE
AI_SERVICE_UNAVAILABLE
AI_RESPONSE_INVALID
EXTERNAL_DATA_UNAVAILABLE
ROADMAP_NOT_ALLOWED
ROADMAP_GENERATION_FAILED
RATE_LIMITED
INTERNAL_ERROR
```

Error code harus stabil walaupun user-facing message berubah.

---

# 22. Security Baseline

Semua protected endpoint:

1. validate session;
2. validate input;
3. validate ownership;
4. execute use case.

CORS MVP:

> same-origin only.

Tidak membuka public wildcard CORS:

```text
Access-Control-Allow-Origin: *
```

untuk authenticated API.

---

# 23. CSRF

NextAuth authentication action mengikuti protection dari auth framework.

Product mutation API bersifat same-origin authenticated application API.

Jangan membuat custom cookie-authenticated cross-origin API pada MVP.

---

# 24. Rate Limiting

Minimal rate limiting diterapkan pada expensive/sensitive endpoint.

Recommended configurable policies:

| Endpoint Class | Baseline |
|---|---|
| Register | moderate IP throttling |
| Credentials login | brute-force protection |
| AI analysis | per-user throttling |
| Roadmap generation | per-user throttling |
| Normal read API | higher/general limit |

Exact numeric threshold ditetapkan deployment configuration.

Jika rate limit terlampaui:

```http
429 Too Many Requests
```

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Terlalu banyak permintaan. Silakan coba kembali."
  }
}
```

---

# 25. Idempotency

Operasi AI/roadmap dapat mahal.

Recommended request header:

```http
Idempotency-Key: <uuid>
```

untuk:

```text
POST /opportunities/{id}/analysis
POST /roadmaps
```

Jika request yang sama dikirim ulang dengan key yang sama:

- jangan membuat duplicate costly operation;
- return hasil yang sama selama idempotency window.

MVP dapat menerapkan persistence/cache sederhana.

---

# 26. Endpoint Inventory

## Authentication

```text
POST /api/v1/auth/register
/api/auth/*  → NextAuth login/logout/session
```

## Current User / Onboarding

```text
GET   /api/v1/me
PATCH /api/v1/me/user-type
POST  /api/v1/me/user-type/switch
```

## Profiles

```text
GET /api/v1/profile

PUT /api/v1/profile/entrepreneur
PUT /api/v1/profile/business
```

### Dashboard Foundation implementation note

For the Dashboard Foundation MVP, `GET /api/v1/profile` remains a documented future or public profile-read contract, but it is not implemented or required by Dashboard. Dashboard server components use `getCurrentUser()` and `DashboardQueryService` directly. No `GET /api/v1/dashboard` endpoint is added. See `docs/Dashboard Foundation Configuration.md` for the frozen implementation configuration.

## Reference Data

```text
GET /api/v1/reference/fnb-categories
GET /api/v1/reference/customer-segments
GET /api/v1/reference/sales-channels
```

## Trends

Planned proposals only. No Trend API route is implemented. Endpoint paths, filters, authorization details, and response examples below are not an approved external contract; exposure remains an open decision in `docs/Trend Intelligence Configuration.md`.

```text
GET /api/v1/trends
GET /api/v1/trends/{trendId}
```

## Opportunities

```text
GET  /api/v1/opportunities
GET  /api/v1/opportunities/{opportunityId}
GET  /api/v1/opportunities/{opportunityId}/fit-score
GET  /api/v1/opportunities/{opportunityId}/score
POST /api/v1/opportunities/{opportunityId}/analysis
GET  /api/v1/opportunities/{opportunityId}/analysis/latest
```

`/fit-score` is the approved read-only MVP calculation endpoint. `/score` remains the separate planned broader scoring/analysis detail contract.

## Save

```text
GET    /api/v1/saved-opportunities
POST   /api/v1/saved-opportunities/{opportunityId}
DELETE /api/v1/saved-opportunities/{opportunityId}
```

## Compare

```text
POST /api/v1/opportunities/compare
```

## Roadmap

```text
GET  /api/v1/roadmaps
POST /api/v1/roadmaps
GET  /api/v1/roadmaps/{roadmapId}
```

## Health

```text
GET /api/health
```

---

# 27. POST `/api/v1/auth/register`

## Purpose

Membuat akun user.

## Authentication

```text
Public
```

## PRD/FSD

- PRD-AUTH-001
- FSD-AUTH-001

## Request

```json
{
  "email": "user@example.com",
  "password": "StrongPassword",
  "passwordConfirmation": "StrongPassword"
}
```

## Validation

- valid email;
- lowercase normalization;
- password required;
- confirmation sama;
- email unique.

Password minimum policy ditentukan auth/security implementation dan harus konsisten antara frontend/backend.

## Process

```text
Validate
↓
Normalize Email
↓
Check Existing User
↓
Argon2id Hash
↓
Insert users
↓
Return Created
```

## Database

```text
users
```

## Success

`201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "userType": null,
    "onboardingStatus": "NOT_STARTED"
  },
  "requestId": "req_..."
}
```

## Errors

- `400 VALIDATION_ERROR`
- `409 EMAIL_ALREADY_EXISTS`
- `500 INTERNAL_ERROR`

Password/passwordHash tidak pernah dikembalikan.

---

# 28. Authentication Login Contract

Login menggunakan NextAuth Credentials Provider.

Conceptual input:

```text
email
password
```

Backend AuthService:

```text
find user
↓
verify Argon2 hash
↓
return safe user identity
↓
NextAuth creates JWT session
```

Invalid credential harus menggunakan generic message:

> `Email atau password tidak sesuai.`

Tidak boleh membedakan:

- email tidak ada;
- password salah.

---

# 29. GET `/api/v1/me`

## Purpose

Mengambil current application user state untuk client-side use bila dibutuhkan.

## Auth

Required.

## Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "userType": "ENTREPRENEUR",
    "onboardingStatus": "COMPLETED"
  },
  "requestId": "req_..."
}
```

Tidak menampilkan:

```text
passwordHash
```

---

# 30. PATCH `/api/v1/me/user-type`

## Purpose

Memenuhi User Type Selection.

## PRD/FSD

- PRD-ONB-001
- FSD-ONB-001

## Request

```json
{
  "userType": "ENTREPRENEUR"
}
```

atau:

```json
{
  "userType": "UMKM_EXISTING"
}
```

## Rules

Untuk first selection:

```text
current userType = null
```

→ allowed.

Jika user sudah selesai onboarding dan ingin mengganti type, gunakan endpoint `POST /api/v1/me/user-type/switch`.

`PATCH` tetap hanya untuk first selection ketika `current userType = null`. Endpoint switch tidak menghapus profile/histori lama dan mengubah `onboardingStatus` menjadi `USER_TYPE_SELECTED` dalam satu update database atomik.

## 30.1 POST `/api/v1/me/user-type/switch`

### Auth and Request Security

- authenticated user only;
- same-origin mutation;
- strict JSON body maksimum 256 bytes;
- body tepat `{ "userType": "ENTREPRENEUR" | "UMKM_EXISTING" }`;
- target harus berbeda dari persona aktif.

### Eligibility and Behavior

User harus memiliki `onboardingStatus = COMPLETED`. Server menggunakan identitas dan state dari session/database, bukan user ID atau persona yang dikirim client. Update bersyarat mengubah:

```text
users.user_type = target
users.onboarding_status = USER_TYPE_SELECTED
```

Profile entrepreneur/business yang sudah ada tetap dipertahankan. Client diarahkan ke onboarding persona baru; halaman onboarding membaca profile target bila tersedia untuk prefill dan konfirmasi.

### Success

`200 OK`, `Cache-Control: private, no-store`

```json
{
  "success": true,
  "data": {
    "userType": "UMKM_EXISTING",
    "onboardingStatus": "USER_TYPE_SELECTED"
  },
  "requestId": "req_..."
}
```

### Errors

- `400 VALIDATION_ERROR` — body invalid, unknown field, or oversized;
- `401 UNAUTHORIZED` — no authenticated session;
- `403 FORBIDDEN` — missing/invalid Origin;
- `404 RESOURCE_NOT_FOUND` — current account no longer exists;
- `409 CONFLICT` — onboarding belum selesai atau target persona sudah aktif;
- `500 INTERNAL_ERROR` — unexpected persistence error.

## Database

```text
users.user_type
users.onboarding_status
```

---

# 31. GET `/api/v1/profile`

## Purpose

Mengambil active profile berdasarkan current user type.

## Auth

Required.

## Behavior

```text
ENTREPRENEUR
→ entrepreneur profile

UMKM_EXISTING
→ business profile
```

Jika user type belum dipilih:

```text
422 USER_TYPE_NOT_SELECTED
```

Jika profile belum ada:

```json
{
  "success": true,
  "data": null,
  "meta": {
    "profileComplete": false
  }
}
```

---

# 32. PUT `/api/v1/profile/entrepreneur`

## Purpose

Create atau full-update Entrepreneur Profile.

## Auth

Required.

## Authorization

```text
session.userType must equal ENTREPRENEUR
```

## Request

```json
{
  "location": {
    "text": "Jl. Menteng Raya No. 12, Jakarta Pusat",
    "city": "Jakarta Pusat",
    "province": "DKI Jakarta",
    "district": "Menteng",
    "subdistrict": "Pegangsaan",
    "countryCode": "ID"
  },
  "budget": {
    "min": 5000000,
    "max": 10000000
  },
  "experienceLevel": "BEGINNER",
  "timeCommitment": "PART_TIME",
  "interestCategoryIds": [
    "uuid-category"
  ],
  "customerSegmentIds": [
    "uuid-segment"
  ],
  "salesChannelIds": [
    "uuid-channel"
  ],
  "preferredProductType": "Beverage",
  "businessObjective": "Membangun usaha minuman.",
  "notes": null
}
```

## Validation

- `min >= 0`;
- `max >= min`;
- reference UUID exists;
- minimum satu interest;
- jika `interestCategoryIds` memuat kategori `OTHER`, `preferredProductType` wajib diisi;
- minimum satu customer segment;
- minimum satu sales channel;
- enum valid.

## Transaction

```text
BEGIN
upsert entrepreneur_profiles
replace interests
replace customer segments
replace sales channels
increment profile_version when personalization data changed
update users.onboarding_status
COMMIT
```

## Response

`200 OK`

```json
{
  "success": true,
  "data": {
    "profileVersion": 2,
    "profileComplete": true
  },
  "requestId": "req_..."
}
```

## Database

- `entrepreneur_profiles`
- profile junction tables
- `users`

---

# 33. PUT `/api/v1/profile/business`

## Purpose

Create or update the UMKM Business Profile using the frozen configuration in [Business Profile Configuration.md](Business%20Profile%20Configuration.md).

## Auth

Required.

## Authorization

~~~text
user_type = UMKM_EXISTING → allowed
user_type = ENTREPRENEUR   → 403 FORBIDDEN
guest                      → 401 UNAUTHORIZED
~~~

An authenticated user whose `user_type` is still `null` follows the existing API error convention. Authorization uses current database/session context; client fields cannot override it.

## Request

~~~json
{
  "businessName": "Kopi Nusantara",
  "businessCategoryId": "uuid-category",
  "location": {
    "text": "Jl. Menteng Raya No. 12, Menteng",
    "city": "Jakarta Pusat",
    "province": "DKI Jakarta",
    "district": "Menteng",
    "subdistrict": "Pegangsaan"
  },
  "averagePrice": {
    "min": 20000,
    "max": 40000
  },
  "products": [
    {
      "name": "Kopi Susu",
      "categoryId": "uuid-category",
      "price": 25000
    },
    {
      "name": "Teh Lemon",
      "categoryId": null,
      "price": null
    }
  ],
  "customerSegmentIds": ["uuid-segment"],
  "salesChannelIds": ["uuid-channel"],
  "businessDescription": "Kedai minuman untuk pelanggan sekitar area perkantoran.",
  "notes": null
}
~~~

The request must contain 1–20 products, at least one active customer segment, and at least one active sales channel. Product category and product price are optional. Product names are trimmed, Unicode-normalized, internal whitespace-collapsed, limited to 1–180 characters, and compared case-insensitively; duplicate normalized names return `400 VALIDATION_ERROR`.

Customer-segment and sales-channel IDs must be UUIDs for active references. Duplicate IDs are normalized and deduplicated, then compared/stored deterministically; duplicates are not a validation error. Average price values are integer Rupiah with `min >= 0` and `max >= min`. Empty optional text becomes `null`.

The client must not send authoritative values for:

~~~text
userId
userType
onboardingStatus
profileVersion
countryCode
productId
isActive
operationModel
~~~

`country_code` is server-controlled as `ID`. `operationModel` is omitted from the MVP request and persisted as `null`.

## Transaction

All writes are atomic:

~~~text
BEGIN
validate current DB user and references
load current normalized state for version comparison
create/update business_profiles
delete existing business_products rows for the profile
insert normalized current products with is_active = true
replace customer segment junction
replace sales channel junction
update users.onboarding_status = COMPLETED
COMMIT
~~~

Failure rolls back all writes. Product rows are physically replaced for the MVP; inactive historical rows are not retained. Semantic changes increment `profile_version`; notes-only and normalized no-op changes do not.

## Errors

- `401 UNAUTHORIZED` for a guest;
- `403 FORBIDDEN` for `ENTREPRENEUR`;
- `400 VALIDATION_ERROR` for invalid scalar values, invalid UUIDs, inactive references, duplicate normalized product names, or invalid numeric ranges;
- `404 RESOURCE_NOT_FOUND` for a referenced resource that cannot be resolved under existing API conventions;
- `500 INTERNAL_ERROR` for an unexpected persistence failure.

## Database

- `business_profiles`;
- `business_products`;
- `business_profile_customer_segments`;
- `business_profile_sales_channels`;
- `users`.

# 34. Reference Data APIs

Reference endpoints digunakan oleh onboarding forms. Nilai, DTO, dan behavior MVP Entrepreneur Profile dibekukan pada [`Entrepreneur Profile Configuration.md`](Entrepreneur%20Profile%20Configuration.md).

## GET `/api/v1/reference/fnb-categories`

Query optional:

```text
active=true
parentId=<uuid>
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "BEVERAGE",
      "name": "Beverage",
      "parentId": null
    }
  ]
}
```

## GET `/api/v1/reference/customer-segments`

Response minimal:

```text
id
code
name
description
```

## GET `/api/v1/reference/sales-channels`

Response minimal:

```text
id
code
name
```

Reference API MVP mengembalikan active rows saja, memakai urutan deterministic, tidak menggunakan pagination, dan tidak mengekspos timestamps atau metadata internal database.

Reference data boleh di-cache lebih lama daripada personalized data.

---

# 35. GET `/api/v1/trends`

**Status:** Proposal only; no route is implemented. The current backend consumes Trend data through an internal server-side `TrendService` and typed `TrendDto`.

The query, sort, auth, and response definitions below are not approved API requirements. The `relevance: 87.5` value is an unapproved illustrative number, not a measured score or a field in the current DTO. `categoryId` is also ambiguous: the current schema separates Trend `category_code` from optional F&B subject area `fnb_category_id`. The current service filters published Trends by persisted user type and affected audience only; it does not load profiles or calculate personalized relevance, and its `businessRelevanceExplanation` is general and curated. `sourceMode`, signal index values, source freshness, and `lastUpdated` are not part of the current Trend schema/DTO; catalog record timestamps must not be interpreted as source freshness.

## Purpose

Trend Radar.

## PRD/FSD

- PRD-TREND-001
- PRD-TREND-002
- PRD-TREND-003
- FSD-TREND-001
- FSD-TREND-002

## Auth

Required.

## Query

```text
page
pageSize
categoryId
direction
q
sort
order
```

Allowed direction:

```text
RISING
STABLE
DECLINING
```

Recommended sort allowlist:

```text
relevance
updatedAt
name
```

## Personalization

Backend dapat menambahkan:

```text
relevance
```

berdasarkan active profile.

## Response Item

```json
{
  "id": "uuid",
  "name": "Matcha Beverage",
  "category": {
    "id": "uuid",
    "name": "Beverage"
  },
  "direction": "RISING",
  "period": {
    "start": "2026-01-01",
    "end": "2026-09-01"
  },
  "relevance": 87.5,
  "sourceMode": "PREPARED",
  "lastUpdated": "2026-09-20T00:00:00.000Z"
}
```

Jika prepared/cached:

API tidak boleh mengklaim real-time.

---

# 36. GET `/api/v1/trends/{trendId}`

**Status:** Proposal only; no route or response payload is implemented or approved. The example below must not be treated as real Trend data or as the current `TrendDto` contract.

## Purpose

Trend Detail.

## Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Matcha Beverage",
    "description": "...",
    "direction": "RISING",
    "category": {
      "id": "uuid",
      "name": "Beverage"
    },
    "period": {
      "start": "2026-01-01",
      "end": "2026-09-01"
    },
    "signal": {
      "value": 82.3,
      "unit": "INDEX"
    },
    "sourceMode": "PREPARED",
    "lastUpdated": "2026-09-20T00:00:00.000Z",
    "evidence": [],
    "relatedOpportunities": []
  }
}
```

Tidak perlu memuat full AI analysis semua opportunity.

---

# 37. GET `/api/v1/opportunities`

## Purpose

Opportunity Finder.

## PRD/FSD

- PRD-OPP-001
- PRD-OPP-002
- FSD-OPP-001
- FSD-OPP-002
- FSD-OPP-003

## Preconditions

- authenticated;
- user type exists;
- minimum active profile exists.

Profile incomplete:

```http
422
```

```json
{
  "success": false,
  "error": {
    "code": "PROFILE_INCOMPLETE",
    "message": "Lengkapi profil untuk mendapatkan rekomendasi."
  }
}
```

## Query

```text
page
pageSize
categoryId
trendId
risk
minScore
minFit
sort
order
q
```

Should-Have filters boleh diaktifkan bertahap.

## Process

```text
Load Active Profile
↓
Load Eligible Opportunities
↓
Calculate/Get Current Score Snapshot
↓
Calculate Fit
↓
Determine Risk
↓
Rank
↓
Return Cards
```

## Response Item

```json
{
  "id": "uuid",
  "name": "Matcha Takeaway Beverage",
  "category": {
    "id": "uuid",
    "name": "Beverage"
  },
  "summary": "...",
  "trend": {
    "id": "uuid",
    "name": "Matcha Beverage",
    "direction": "RISING"
  },
  "opportunityScore": {
    "value": 83.0,
    "status": "AVAILABLE"
  },
  "fitScore": {
    "value": 86.0,
    "status": "AVAILABLE"
  },
  "risk": {
    "level": "MEDIUM"
  }
}
```

---

# 38. GET `/api/v1/opportunities/{opportunityId}`

## Purpose

Opportunity Detail.

## Response Sections

- identity;
- category;
- description;
- trend;
- opportunity score;
- fit score;
- risk;
- target consumers;
- competition;
- evidence summary;
- analysis availability;
- correct roadmap action.

Example:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Matcha Takeaway Beverage",
    "description": "...",
    "opportunityType": "BUSINESS_CONCEPT",
    "trend": {
      "id": "uuid",
      "name": "Matcha Beverage",
      "direction": "RISING"
    },
    "opportunityScore": {
      "value": 83,
      "status": "AVAILABLE",
      "breakdown": {}
    },
    "fitScore": {
      "value": 86,
      "status": "AVAILABLE",
      "breakdown": {}
    },
    "risk": {
      "level": "MEDIUM",
      "reasons": [
        "Kompetisi relatif tinggi."
      ]
    },
    "targetConsumers": [],
    "competition": {
      "level": "MEDIUM",
      "summary": "..."
    },
    "evidenceSummary": {
      "count": 3,
      "limited": false
    },
    "analysisAvailable": true,
    "roadmapType": "STARTUP"
  }
}
```

`roadmapType` dihitung dari user type, bukan request user.

---

# 39. GET `/api/v1/opportunities/{id}/score`

## Purpose

Mengambil current personalized scoring detail.

## Response

```json
{
  "success": true,
  "data": {
    "analysisId": "uuid",
    "profileVersion": 2,
    "datasetVersion": "2026-09-demo-v1",
    "scoringModel": {
      "id": "uuid",
      "version": "v1"
    },
    "opportunityScore": {
      "value": 83.0,
      "status": "AVAILABLE",
      "breakdown": {}
    },
    "fitScore": {
      "value": 86.0,
      "status": "AVAILABLE",
      "breakdown": {}
    },
    "risk": {
      "level": "MEDIUM",
      "reasons": []
    },
    "confidence": {
      "level": "MEDIUM"
    },
    "generatedAt": "2026-09-26T12:00:00.000Z"
  }
}
```

## Insufficient Data

`200` boleh digunakan karena resource analysis berhasil dihitung namun statusnya insufficient:

```json
{
  "success": true,
  "data": {
    "opportunityScore": {
      "value": null,
      "status": "INSUFFICIENT_DATA"
    }
  }
}
```

Jika profile minimum tidak ada sama sekali, gunakan `422 PROFILE_INCOMPLETE`.

---

# 39.1 GET `/api/v1/opportunities/{id}/fit-score`

## Purpose

Menghitung Fit Score MVP saat diminta menggunakan profil tersimpan dan Opportunity yang eligible. Endpoint ini read-only dan tidak membuat analysis snapshot.

## Authentication and Eligibility

- Authentication wajib; identitas berasal dari session server-side.
- `userType` persisted menentukan `ENTREPRENEUR_FIT` atau `BUSINESS_FIT`.
- Onboarding harus `COMPLETED` dan persisted `userType` harus valid.
- Role-specific profile milik user aktif wajib ada. Jika Entrepreneur Profile atau Business Profile tidak ditemukan, endpoint mengembalikan `422 PROFILE_INCOMPLETE`, termasuk ketika onboarding berstatus `COMPLETED`.
- Existing Fit Input Context service memeriksa Opportunity eligibility serta Trend `PUBLISHED` dan audience yang sesuai.
- Client tidak mengirim user ID/type, policy, weights, normalized components, atau score.
- Personalized response memakai `Cache-Control: private, no-store`.

## Request

```http
GET /api/v1/opportunities/{id}/fit-score
```

`id` wajib berupa UUID Opportunity. Tidak ada request body.

## Success

`200 OK` dengan score yang tersedia:

```json
{
  "success": true,
  "data": {
    "fitScore": {
      "status": "AVAILABLE",
      "value": 80,
      "modelType": "ENTREPRENEUR_FIT",
      "policyVersion": "FIT_MVP_HEURISTIC_V1",
      "confidence": null,
      "label": "MVP Heuristic Fit Score",
      "breakdown": [
        {
          "component": "budgetFit",
          "value": 100,
          "weightedContribution": 40,
          "interpretation": "Budget affordability compares persisted budgetMax with Opportunity capitalMin."
        }
      ],
      "disclaimer": "Fit Score menunjukkan kesesuaian berdasarkan profil dan kriteria terbatas yang tersedia, bukan jaminan keberhasilan bisnis."
    }
  },
  "requestId": "req_example"
}
```

Angka pada contoh hanya menggambarkan bentuk response, bukan hasil scoring pengguna. Breakdown tidak memuat nilai mentah profil atau konfigurasi bobot.

Jika komponen aktif tidak lengkap, perhitungan berhasil tetapi tidak menghasilkan angka:

```json
{
  "success": true,
  "data": {
    "fitScore": {
      "status": "INSUFFICIENT_DATA",
      "value": null,
      "modelType": "ENTREPRENEUR_FIT",
      "policyVersion": "FIT_MVP_HEURISTIC_V1",
      "confidence": null,
      "missingComponents": ["budgetFit"],
      "reason": "ACTIVE_COMPONENTS_UNAVAILABLE",
      "label": "MVP Heuristic Fit Score",
      "disclaimer": "Fit Score menunjukkan kesesuaian berdasarkan profil dan kriteria terbatas yang tersedia, bukan jaminan keberhasilan bisnis."
    }
  },
  "requestId": "req_example"
}
```

Profil role-specific yang ada tetapi tidak memiliki satu atau lebih input scoring aktif tetap menghasilkan `200 OK` dengan `status: INSUFFICIENT_DATA` dan `value: null`. Kondisi tersebut berbeda dari onboarding yang belum selesai, user type invalid, atau record profil role-specific yang hilang.

## Errors

- `400 VALIDATION_ERROR` — Opportunity ID bukan UUID.
- `401 UNAUTHORIZED` — tidak ada authenticated session.
- `404 RESOURCE_NOT_FOUND` — Opportunity tidak ditemukan, unpublished, atau tidak eligible; respons sama digunakan untuk menghindari resource disclosure.
- `422 PROFILE_INCOMPLETE` — onboarding belum `COMPLETED`, persisted user type invalid/tidak tersedia, atau role-specific profile record milik user aktif tidak ditemukan (termasuk jika onboarding sudah `COMPLETED`).
- `500 INTERNAL_ERROR` — kegagalan internal yang tidak diekspos sebagai skor.

Semua respons endpoint menggunakan `Cache-Control: private, no-store`.

## Read-only and Separation

Endpoint ini hanya menghitung Fit Score dengan policy `FIT_MVP_HEURISTIC_V1`; tidak menulis `user_opportunity_analyses`, tidak membuat scoring model row, dan tidak menghitung Opportunity Score, Risk, atau AI Analysis.

Endpoint ini terpisah dari `GET /api/v1/opportunities/{id}/score` pada section 39. Endpoint `/score` tetap menjadi kontrak planned untuk scoring detail yang lebih luas, termasuk Opportunity Score, Risk, dan analysis metadata; kontrak tersebut tidak diubah oleh endpoint ini.

---

# 40. POST `/api/v1/opportunities/{id}/analysis`

## Purpose

Generate/refresh grounded AI Opportunity Analysis.

## Auth

Required.

## Rate Limited

Yes.

## Idempotency

Recommended.

## Preconditions

- active profile;
- opportunity exists;
- structured context available;
- scoring state available enough to generate meaningful explanation.

## Request

Request body wajib berisi persetujuan eksplisit untuk disclosure yang sedang berlaku. `forceRefresh` tetap opsional:

```json
{
  "consent": true,
  "disclosureVersion": "opportunity-analysis-ninerouter-v1",
  "forceRefresh": false
}
```

Request tanpa persetujuan atau dengan versi disclosure yang tidak dikenal ditolak sebelum panggilan provider. Persetujuan hanya berlaku untuk permintaan yang dimulai pengguna. Client **tidak mengirim profile, score, risk, atau evidence sebagai source of truth**; server membangun konteks minimal yang diizinkan.

## Process

```text
Authenticate
↓
Load User/Profile
↓
Load Opportunity
↓
Load/Create Current Score Analysis
↓
Load Evidence
↓
Build AI Context
↓
Call AI Adapter
↓
Validate with Zod
↓
Persist ai_analysis snapshot
↓
Return Structured Analysis
```

## Response

```json
{
  "success": true,
  "data": {
    "analysisId": "uuid",
    "summary": "...",
    "whyRelevant": "...",
    "targetConsumer": "...",
    "competition": "...",
    "potential": "...",
    "risks": [
      "..."
    ],
    "nextAction": "...",
    "generatedAt": "2026-09-26T12:10:00.000Z"
  }
}
```

## Errors

- `422 PROFILE_INCOMPLETE`
- `422 INSUFFICIENT_DATA`
- `429 RATE_LIMITED`
- `502 AI_RESPONSE_INVALID`
- `503 AI_SERVICE_UNAVAILABLE`

## Failure Principle

Kegagalan endpoint AI tidak membuat Opportunity Detail endpoint ikut gagal.

---

# 41. GET `/api/v1/opportunities/{id}/analysis/latest`

## Purpose

Mengambil AI analysis terbaru yang valid untuk user.

## Behavior

Cari snapshot berdasarkan user/opportunity dan prioritaskan context terbaru.

Jika tidak tersedia:

```text
404 RESOURCE_NOT_FOUND
```

atau application dapat return `data: null`.

Baseline API memilih:

```text
200 data: null
```

karena "belum pernah generate analysis" adalah valid application state.

Example:

```json
{
  "success": true,
  "data": null
}
```

---

# 42. GET `/api/v1/saved-opportunities`

## Purpose

Daftar opportunity yang disimpan current user.

## Query

```text
page
pageSize
sort
order
```

Default:

```text
sort=createdAt
order=desc
```

## Database

```text
saved_opportunities
join opportunities
```

---

# 43. POST `/api/v1/saved-opportunities/{opportunityId}`

## Purpose

Save opportunity.

## Auth

Required.

## Idempotent Behavior

Jika relation sudah ada:

- jangan membuat duplicate;
- return current saved state.

Response recommended:

`200` jika sudah ada, `201` jika baru dibuat.

Example:

```json
{
  "success": true,
  "data": {
    "opportunityId": "uuid",
    "saved": true
  }
}
```

Unique DB constraint tetap menjadi final protection.

---

# 44. DELETE `/api/v1/saved-opportunities/{opportunityId}`

## Purpose

Remove Saved relationship.

Jika relation tidak ada:

MVP recommended:

```http
204 No Content
```

agar DELETE bersifat idempotent.

Master Opportunity tidak dihapus.

---

# 45. POST `/api/v1/opportunities/compare`

## Purpose

Compare 2–3 opportunities.

## Priority

Should Have.

## Request

```json
{
  "opportunityIds": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ]
}
```

## Validation

```text
minimum 2
maximum 3
unique IDs
```

## Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "opportunityId": "uuid-1",
        "name": "...",
        "opportunityScore": 84,
        "fitScore": 88,
        "trendDirection": "RISING",
        "competitionLevel": "MEDIUM",
        "riskLevel": "LOW",
        "executionFeasibility": 82
      }
    ]
  }
}
```

Tidak ada table `comparisons`.

Endpoint hanya membaca data existing.

---

# 46. GET `/api/v1/roadmaps`

## Purpose

Mengambil roadmap milik current user.

## Auth

Required.

## Query

```text
page
pageSize
type=STARTUP|GROWTH
opportunityId
sort
order
```

Ownership selalu berdasarkan:

```text
session user id
```

Client tidak boleh meminta `userId` lain.

---

# 47. POST `/api/v1/roadmaps`

## Purpose

Generate Startup/Growth Roadmap.

## Auth

Required.

## Rate Limit

Yes.

## Idempotency

Recommended.

## Request

```json
{
  "opportunityId": "uuid",
  "analysisId": "uuid"
}
```

`analysisId` optional bila backend dapat resolve latest context.

Client tidak boleh menentukan:

```text
roadmapType
```

sebagai source of truth.

Backend menentukan:

```text
ENTREPRENEUR → STARTUP
UMKM_EXISTING → GROWTH
```

## Process

```text
Authenticate
↓
Resolve User Type
↓
Load Profile
↓
Load Opportunity
↓
Load/Resolve Analysis
↓
Validate Roadmap Eligibility
↓
Generate Structured Roadmap
↓
Validate Output
↓
BEGIN TRANSACTION
insert roadmaps
insert roadmap_steps
COMMIT
↓
Return Resource
```

## Response

`201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "roadmapType": "STARTUP",
    "opportunity": {
      "id": "uuid",
      "name": "Matcha Takeaway Beverage"
    },
    "steps": [
      {
        "sequence": 1,
        "stage": "Market Validation",
        "action": "Lakukan survei kepada target konsumen.",
        "objective": "Memvalidasi minat awal.",
        "timeline": "Week 1",
        "expectedOutput": "Ringkasan hasil validasi."
      }
    ],
    "createdAt": "2026-09-26T12:00:00.000Z"
  }
}
```

## Errors

- `403 ROADMAP_NOT_ALLOWED`
- `404 RESOURCE_NOT_FOUND`
- `422 PROFILE_INCOMPLETE`
- `422 INSUFFICIENT_DATA`
- `503 AI_SERVICE_UNAVAILABLE`
- `500 ROADMAP_GENERATION_FAILED`

Roadmap header dan steps harus transactional.

---

# 48. GET `/api/v1/roadmaps/{roadmapId}`

## Purpose

Roadmap detail.

## Ownership

Query harus selalu mengandung:

```text
roadmaps.id = requested id
AND roadmaps.user_id = current session user
```

Jika resource milik user lain:

recommended security behavior:

```text
404 RESOURCE_NOT_FOUND
```

daripada mengonfirmasi keberadaan resource.

## Response

Roadmap + ordered steps:

```text
ORDER BY sequence ASC
```

---

# 49. GET `/api/health`

## Purpose

Container/platform health check.

## Auth

Tidak diperlukan.

## Response

```json
{
  "status": "ok"
}
```

Optional internal metadata:

```text
version
database connectivity
```

Jangan expose:

- environment values;
- database credentials;
- AI key;
- stack trace.

---

# 50. Database Mapping

| API Area | Database |
|---|---|
| Register | `users` |
| User Type | `users` |
| Entrepreneur Profile | `entrepreneur_profiles` + junctions |
| Business Profile | `business_profiles`, `business_products`, junctions |
| Reference | reference master tables |
| Trend MVP internal service | `trends`, `trend_evidences` |
| Opportunities | `opportunities`, fit requirements, target junctions |
| Scores | `scoring_models`, `user_opportunity_analyses` |
| AI Analysis | `user_opportunity_analyses.ai_analysis` |
| Future/shared Opportunity evidence | `evidences` |
| Save | `saved_opportunities` |
| Compare | read-only queries |
| Roadmap | `roadmaps`, `roadmap_steps` |

---

# 51. API Route ↔ Next.js File Mapping

Recommended:

```text
src/app/api/
├── health/
│   └── route.ts
│
├── auth/
│   └── [...nextauth]/
│       └── route.ts
│
└── v1/
    ├── auth/
    │   └── register/
    │       └── route.ts
    │
    ├── me/
    │   ├── route.ts
    │   └── user-type/
    │       ├── route.ts
    │       └── switch/
    │           └── route.ts
    │
    ├── profile/
    │   ├── route.ts
    │   ├── entrepreneur/
    │   │   └── route.ts
    │   └── business/
    │       └── route.ts
    │
    ├── reference/
    │   ├── fnb-categories/
    │   ├── customer-segments/
    │   └── sales-channels/
    │
    ├── trends/
    │   ├── route.ts
    │   └── [trendId]/
    │       └── route.ts
    │
    ├── opportunities/
    │   ├── route.ts
    │   ├── compare/
    │   │   └── route.ts
    │   └── [opportunityId]/
    │       ├── route.ts
    │       ├── score/
    │       │   └── route.ts
    │       └── analysis/
    │           ├── route.ts
    │           └── latest/
    │               └── route.ts
    │
    ├── saved-opportunities/
    │   ├── route.ts
    │   └── [opportunityId]/
    │       └── route.ts
    │
    └── roadmaps/
        ├── route.ts
        └── [roadmapId]/
            └── route.ts
```

---

# 52. Service Layer Mapping

Route Handler tidak memanggil Sequelize langsung jika logic lebih dari query sederhana.

Recommended services:

```text
AuthService
UserService
ProfileService
TrendService
OpportunityService
ScoringService
OpportunityAnalysisService
SavedOpportunityService
RoadmapService
ReferenceDataService
```

Example:

```text
POST /api/v1/roadmaps
↓
RoadmapService.generate()
↓
AnalysisRepository
OpportunityRepository
AIService
RoadmapRepository
```

---

# 53. Request Validation

Gunakan Zod.

Entrepreneur Profile location validation (Business Profile keeps its separate location schema):

```typescript
const locationSchema = z.object({
  text: z.string().trim().min(1).max(255), // Alamat detail
  city: z.string().trim().min(1).max(120),
  province: z.string().trim().min(1).max(120),
  district: z.string().trim().min(1).max(120), // Kecamatan
  subdistrict: z.string().trim().min(1).max(120), // Kelurahan
  countryCode: z.string().length(2).default("ID"),
});
```

UUID:

```typescript
z.string().uuid()
```

Score filters:

```typescript
z.coerce.number().min(0).max(100)
```

Server validation wajib walaupun frontend sudah validasi.

---

# 54. Query Validation

Jangan menerima arbitrary:

```text
sortField
filterColumn
```

tanpa allowlist.

Example:

```typescript
const allowedSort = [
  "relevance",
  "updatedAt",
  "name"
] as const;
```

Hal ini mencegah:

- invalid query;
- ORM misuse;
- injection-like dynamic query risk.

---

# 55. Response DTOs

Jangan expose Sequelize Model instance langsung.

Gunakan DTO/mapper.

Example:

```text
Opportunity Model
↓
OpportunityResponseMapper
↓
JSON DTO
```

Keuntungan:

- password/internal field tidak bocor;
- stable API contract;
- database schema dapat berubah tanpa langsung merusak frontend.

---

# 56. Null vs Missing

Rule:

- field yang memang diketahui tidak ada → `null`;
- optional field yang tidak termasuk endpoint DTO → boleh tidak dikirim;
- collection kosong → `[]`.

Contoh:

```json
{
  "confidence": null,
  "evidence": []
}
```

---

# 57. Boolean Naming

Gunakan:

```text
isSaved
isActive
profileComplete
analysisAvailable
```

Hindari ambiguous:

```text
savedStatus
activeFlag
```

---

# 58. API Cache Policy

## Personalized API

Contoh:

```text
/profile
/opportunities
/score
/analysis
/roadmaps
/saved
```

Response recommended:

```http
Cache-Control: private, no-store
```

atau caching hanya di server/application dengan key yang benar.

## Reference / Shared Market Data

Boleh menggunakan controlled caching:

```text
fnb categories
customer segments
sales channels
trend master data
```

Exact TTL mengikuti data refresh strategy.

---

# 59. Personalized Cache Key

This is a future/general recommendation or analysis caching proposal for flows that separately adopt dataset versioning; it is not current Trend behavior or a Trend persistence dependency.

Jika server-side caching digunakan untuk recommendation/analysis, key harus mencakup minimal:

```text
userId
profileVersion
datasetVersion
scoringModelVersion
opportunityId
```

AI:

```text
+
aiModelVersion
```

Jangan cache personalized response hanya berdasarkan URL global.

---

# 60. External Data Failure

For a future provider-backed Trend integration only; this is not current Trend MVP behavior. The current schema/DTO persists no source mode, retrieval timestamp, or fallback-dataset link.

Untuk Trend Data:

```text
LIVE provider fails
↓
check CACHED/PREPARED
↓
return fallback with sourceMode
```

Jika tidak ada:

```http
503
```

```json
{
  "success": false,
  "error": {
    "code": "EXTERNAL_DATA_UNAVAILABLE",
    "message": "Data tren sementara tidak tersedia."
  }
}
```

---

# 61. Partial Success Principle

Opportunity Detail dapat sukses walaupun AI gagal.

Example application state:

```text
Opportunity data = success
Score = success
Evidence = success
AI = unavailable
```

Jangan menyatukan semua data dalam satu fragile upstream request jika menyebabkan seluruh page gagal.

---

# 62. AI Provider Contract

Internal interface concept:

```typescript
interface AIProvider {
  analyzeOpportunity(
    input: OpportunityAnalysisInput
  ): Promise<OpportunityAnalysisOutput>;

  generateRoadmap(
    input: RoadmapGenerationInput
  ): Promise<RoadmapGenerationOutput>;
}
```

Route Handler tidak mengetahui provider tertentu.

---

# 63. AI Input Security

Client tidak boleh mengirim:

```text
system prompt
model name
API key
raw scoring weights
authoritative user profile object
```

Server membangun trusted AI context.

---

# 64. AI Output Validation

Semua AI output:

```text
LLM
↓
Zod
↓
valid
   → persist
invalid
   → controlled retry/failure
```

Tidak boleh langsung:

```text
LLM output → DB
```

tanpa validation.

---

# 65. Authorization Rules

## Profile

Hanya own profile.

## Saved

Hanya own saved relation.

## Analysis

Hanya analysis milik current user.

## Roadmap

Hanya roadmap milik current user.

## Trend / Opportunity

Shared domain resource, tetapi personalized score/result tetap user-specific.

---

# 66. Resource Enumeration Protection

Untuk private UUID resource milik user lain:

```text
404 RESOURCE_NOT_FOUND
```

lebih disarankan daripada:

```text
403 "Milik user lain"
```

agar tidak mengonfirmasi keberadaan resource.

---

# 67. Database Transactions from API

API berikut wajib menggunakan transaction:

```text
PUT /profile/entrepreneur
PUT /profile/business
POST /roadmaps
```

Registration minimal single insert dapat atomic secara natural.

---

# 68. Idempotent Resource Behavior

## Save

```text
POST save existing
→ no duplicate
```

## Delete Save

```text
DELETE absent resource
→ 204
```

## AI/Roadmap

Gunakan Idempotency-Key apabila implementation mendukung.

---

# 69. Logging

Log server minimal:

```text
requestId
method
route
status
duration
userId when authenticated
errorCode
```

Jangan log:

```text
password
passwordHash
AUTH_SECRET
AI_API_KEY
session token
```

AI prompt logging harus disanitasi jika diaktifkan.

---

# 70. Audit-Relevant Context

Untuk hasil AI/score, database sudah menyimpan:

```text
profileVersion
datasetVersion
scoringModel
aiModel
generatedAt
```

API score/analysis response dapat menampilkan sebagian metadata tersebut untuk explainability.

---

# 71. OpenAPI Requirement

Recommended repository artifact:

```text
docs/openapi.yaml
```

OpenAPI:

```text
3.1.x
```

Harus mendokumentasikan:

- paths;
- security;
- request schemas;
- response schemas;
- error schemas;
- enum;
- examples.

API Design `.md` adalah design baseline; OpenAPI menjadi machine-readable contract.

---

# 72. OpenAPI Security Scheme

Karena browser authentication menggunakan cookie:

Conceptual:

```yaml
securitySchemes:
  sessionCookie:
    type: apiKey
    in: cookie
    name: <auth-cookie-name>
```

Exact cookie name tidak boleh hardcoded dalam business code karena dapat berubah sesuai environment/framework.

---

# 73. API Testing Strategy

## Unit

- request schema;
- response mapper;
- service logic.

## Integration

- Route Handler;
- authentication;
- database;
- ownership.

## E2E

- register;
- login;
- onboarding;
- profile;
- trends;
- opportunity;
- analysis;
- roadmap.

---

# 74. Contract Tests

Recommended critical API contract tests:

```text
POST register
PATCH user type
PUT entrepreneur profile
PUT business profile
GET trends
GET opportunities
GET opportunity detail
POST AI analysis
POST save
POST compare
POST roadmap
GET roadmap
```

---

# 75. API Security Tests

Minimum:

- unauthenticated protected route → 401;
- wrong user type profile route → 403;
- access another user roadmap → 404;
- duplicate email → 409;
- invalid UUID → 400;
- invalid score filter → 400;
- rate limit → 429;
- external AI failure → 503 without app crash.

---

# 76. Performance Guidelines

Avoid:

```text
GET /opportunities
↓
N opportunity
↓
N separate database requests
```

Use batch/repository strategy.

Collection endpoint harus mengembalikan summary data saja.

Detail endpoint mengembalikan heavier resource.

AI generation dipisahkan ke explicit POST agar GET detail tidak selalu menunggu LLM.

---

# 77. Payload Size

Jangan mengembalikan:

- full analysis history;
- all raw provider metadata;
- giant AI prompt;
- unused DB columns;

pada list endpoint.

List DTO harus ringan.

---

# 78. Endpoint Naming Decisions

Chosen:

```text
/api/v1/profile
/api/v1/trends
/api/v1/opportunities
/api/v1/roadmaps
```

Not chosen:

```text
/api/v1/getProfile
/api/v1/fetchTrendList
/api/v1/generateBusinessRoadmapNow
```

Action endpoint hanya digunakan ketika benar-benar merupakan operation:

```text
/analysis
/compare
```

---

# 79. PUT vs PATCH Decision

Profile menggunakan:

```text
PUT
```

karena PRD/FSD mendeskripsikan full profile update/upsert.

User Type menggunakan:

```text
PATCH
```

karena mengubah satu attribute user.

Future partial profile editing dapat menambah PATCH bila dibutuhkan.

---

# 80. Analysis Endpoint Design Decision

Score dan AI dipisahkan secara konsep:

```text
GET /score
POST /analysis
```

Alasan:

- score deterministic;
- AI dapat gagal tanpa merusak score;
- AI lebih mahal/lambat;
- memungkinkan retry;
- sesuai prinsip Data First, AI Second.

---

# 81. Roadmap Design Decision

Roadmap type **tidak dikirim oleh client sebagai authority**.

Server menentukan berdasarkan:

```text
users.user_type
```

Hal ini mencegah client UMKM meminta Startup Roadmap secara tidak valid.

---

# 82. Compare Design Decision

Compare tidak memiliki persistence table.

Endpoint:

```text
POST /opportunities/compare
```

digunakan karena client mengirim collection ID yang hendak dibandingkan.

POST di sini tidak berarti membuat comparison resource.

---

# 83. Versioning Policy

API v1 frozen setelah MVP release kecuali:

- bug fix;
- optional field addition;
- new endpoint;
- compatible enum extension yang sudah dikoordinasikan.

Breaking:

- remove field;
- rename field;
- change meaning;
- change data type;

harus menuju v2 atau change coordination sebelum freeze.

---

# 84. Deprecation Policy

Jika endpoint diganti:

1. dokumentasikan replacement;
2. beri migration window jika product sudah digunakan eksternal;
3. hindari langsung menghapus endpoint.

Untuk hackathon internal MVP, deprecation window dapat lebih sederhana.

---

# 85. Example Complete Flow — Calon Pengusaha

```text
POST /auth/register
↓
NextAuth signIn
↓
PATCH /me/user-type
    ENTREPRENEUR
↓
PUT /profile/entrepreneur
↓
GET /trends
↓
GET /opportunities
↓
GET /opportunities/{id}
↓
GET /opportunities/{id}/score
↓
POST /opportunities/{id}/analysis
↓
POST /roadmaps
↓
GET /roadmaps/{id}
```

---

# 86. Example Complete Flow — UMKM Existing

```text
POST /auth/register
↓
NextAuth signIn
↓
PATCH /me/user-type
    UMKM_EXISTING
↓
PUT /profile/business
↓
GET /trends
↓
GET /opportunities
↓
GET /opportunities/{id}
↓
GET /opportunities/{id}/score
↓
POST /opportunities/{id}/analysis
↓
POST /roadmaps
↓
GET /roadmaps/{id}
```

---

# 87. FSD → API Traceability

Traceability records future product requirements, not implemented endpoints. Historical Trend rows below remain proposals; the approved SearchApi Explore exception is defined in section 88.

| FSD | API |
|---|---|
| FSD-AUTH-001 | `POST /auth/register` |
| FSD-AUTH-002 | NextAuth Credentials |
| FSD-AUTH-003 | NextAuth signOut |
| FSD-ONB-001 | `PATCH /me/user-type` |
| FSD-EPRO-001 | `PUT /profile/entrepreneur` |
| FSD-EPRO-002 | `PUT /profile/entrepreneur` |
| FSD-BPRO-001 | `PUT /profile/business` |
| FSD-BPRO-002 | `PUT /profile/business` |
| FSD-DASH-* | aggregation from Profile/Trend/Opportunity/Roadmap APIs or server services |
| FSD-TREND-001 | `GET /trends` |
| FSD-TREND-003 | `GET /trends/{id}` |
| FSD-OPP-001 | `GET /opportunities` |
| FSD-OPP-003 | opportunity list DTO |
| FSD-OPP-004 | `GET /opportunities/{id}` |
| FSD-OPP-005 | opportunity query parameters |
| FSD-SCORE-* | `GET /opportunities/{id}/score` |
| FSD-RISK-001 | score/detail response |
| FSD-AI-001..006 | analysis endpoints |
| FSD-EVD-* | trend/opportunity detail response |
| FSD-SAVE-* | saved endpoints |
| FSD-COMP-* | compare endpoint |
| FSD-ROAD-* | roadmap endpoints |
| FSD-DATA-002 | trend/source fallback behavior |
| FSD-SEC-* | auth/ownership middleware/service checks |

---

# 88. API → Database Traceability

| Endpoint | Main Tables |
|---|---|
| Register | `users` |
| User Type / Persona Switch | `users` |
| Entrepreneur Profile | `entrepreneur_profiles` + junctions |
| Business Profile | `business_profiles`, products + junctions |
| References | reference tables |
| Trend MVP internal service | `trends`, `trend_evidences` |
| Opportunities | `opportunities`, fit/target tables |
| Score | `scoring_models`, `user_opportunity_analyses` |
| AI Analysis | `user_opportunity_analyses` |
| Save | `saved_opportunities` dengan scope `user_id + user_type` |
| Compare | opportunities + analyses |
| Roadmaps | `roadmaps`, `roadmap_steps` |

---

# 89. Open API Decisions

Masih perlu ditetapkan sebelum API freeze:

1. exact authentication cookie/session configuration;
2. password policy detail;
3. exact rate-limit numbers;
4. exact idempotency storage/window;
5. final opportunity filter set;
6. final sorting fields;
7. final F&B reference enum/master data;
8. AI provider;
9. AI model;
10. exact external trend provider;
11. cache TTL;
12. whether Compare remains final MVP;
14. exact pagination default if product changes it.

Kontrak utama tetap dapat dikembangkan tanpa menunggu seluruh keputusan tersebut.

---

# 90. Definition of Ready — API Endpoint

Endpoint siap dikembangkan apabila:

- PRD/FSD reference jelas;
- method jelas;
- path jelas;
- auth rule jelas;
- request schema tersedia;
- response schema tersedia;
- validation tersedia;
- DB mapping diketahui;
- error behavior diketahui;
- ownership rule diketahui;
- open decision kritis selesai.

---

# 91. Definition of Done — API Endpoint

Endpoint selesai jika:

1. Route Handler tersedia.
2. Zod validation berjalan.
3. Authentication berjalan.
4. Authorization berjalan.
5. Service layer digunakan.
6. DB operation berjalan.
7. Error contract konsisten.
8. Happy path test lulus.
9. Invalid input test lulus.
10. Unauthorized test lulus.
11. Ownership test lulus jika relevan.
12. No sensitive data leakage.
13. OpenAPI diperbarui.
14. Lint/typecheck/test/build lulus.

---

# 92. MVP API Acceptance

MVP API dianggap siap apabila flow berikut dapat berjalan penuh:

## Calon Pengusaha

```text
Register
→ Login
→ Select Type
→ Save Entrepreneur Profile
→ Get Trends
→ Get Opportunities
→ Get Score
→ Generate AI Analysis
→ Save/Compare Opportunity
→ Generate Startup Roadmap
```

## UMKM Existing

```text
Register
→ Login
→ Select Type
→ Save Business Profile
→ Get Trends
→ Get Opportunities
→ Get Score
→ Generate AI Analysis
→ Save/Compare Opportunity
→ Generate Growth Roadmap
```

dan:

- user A tidak dapat mengakses resource private user B;
- AI failure tidak merusak structured opportunity data;
- external trend failure dapat menggunakan fallback;
- duplicate save tidak membuat duplicate row;
- roadmap disimpan transactionally.

---

# 93. Final API Architecture

```text
Browser
  ↓
NextAuth + /api/v1
  ↓
Next.js Route Handlers
  ↓
Zod Validation
  ↓
Auth / Ownership
  ↓
Application Services
  ├── Profile
  ├── Trend
  ├── Opportunity
  ├── Scoring
  ├── AI Analysis
  ├── Save
  └── Roadmap
       ↓
Repositories / AI Adapter / Data Adapter
       ↓
Sequelize + PostgreSQL / External Services
```

---

# 94. Final API Design Decision

API resmi VENTUREX MVP menggunakan:

> **REST-oriented JSON API berbasis Next.js App Router Route Handlers dengan namespace `/api/v1`, NextAuth cookie authentication, server-side authorization, Zod validation, stable response/error contract, versioned resources, deterministic score endpoints, separated AI generation endpoints, transactional roadmap creation, dan strict ownership isolation.**

Prinsip utamanya:

```text
Trusted Server Context
→ Deterministic Data/Score
→ Grounded AI
→ Actionable Roadmap
```

API mendukung dua flow utama:

```text
Discover → Analyze → Start
```

dan:

```text
Discover → Analyze → Grow
```

tanpa menduplikasi backend architecture.

---

**END OF DOCUMENT**

## Product Owner decision amendment, 14 October 2026: live observations and private ideas

The existing authenticated refresh route remains explicit-action only and returns an owner-bound, short-lived live snapshot. It does not read or fall back to the historical catalog. A new authenticated `GET/POST/PATCH /api/v1/opportunities/ideas` resource lists the current user's generated hypotheses, explicitly generates from `{ snapshotId, signalId, consent: true, disclosureVersion }`, and changes only that user's `saved` state. The server resolves the snapshot and signal; client-supplied profile, source text, metrics, or model output are never authoritative. POST requires same-origin validation, a completed supported persona, current owner-bound `LIKELY_FNB` signal, explicit disclosure consent, rate limiting, secure configured 9Router, and strict JSON/schema/grounding validation. It returns a sanitized unavailable/configuration error when secure transport is absent. No global Opportunity or Trend lifecycle operation is exposed by these routes.

## 88. Approved SearchApi Trend Radar Explore endpoint

POST /api/v1/trend-radar/related-queries retrieves SearchApi.io Google Trends RELATED_QUERIES for the authenticated user's persisted profile query. It requires an authenticated user with completed onboarding and a supported user type, plus a same-origin request. The server resolves preferredProductType for ENTREPRENEUR or businessName for UMKM_EXISTING through the existing owner-scoped profile services. The strict request accepts the selected period, search property, geography code, and applicable year/date/hour values; omitted geography defaults to Worldwide (`geo=""`). Geography codes must exist in the pinned SearchApi Google Trends Geo Locations catalog. It rejects client-supplied query text, user identity, provider URLs, and API keys.

The provider request is GET https://www.searchapi.io/api/v1/search with engine=google_trends, data_type=RELATED_QUERIES, server-owned q, the selected geo code (empty means Worldwide), cat=0, approved tz=-420, selected time, and optional gprop. Web search omits gprop; images, news, Shopping, and YouTube map to images, news, froogle, and youtube. Presets follow the SearchApi Google Trends documentation. A year becomes a date range from January 1 through December 31, or through the current Asia/Jakarta date for the current year. Custom date ranges use yyyy-mm-dd yyyy-mm-dd; custom hour ranges use yyyy-mm-ddThh yyyy-mm-ddThh and are limited to the previous seven days. SearchApi documents that tz affects results and describes it as an offset; the approved -420 sign is retained while its equivalence for Asia/Jakarta remains unverified.

The response contains provider, retrievedAt, cacheStatus, appliedFilters, productQuery, top, rising, omittedInvalidRows, and requestId. Top rows map provider position, query, extracted interest index, and safe Google Trends source link. Rising rows map position, query, provider growth label, extracted growth value, Breakout status, and safe source link; a Breakout label has a null growth percentage. Invalid provider rows are omitted and counted. Empty arrays remain empty. The endpoint does not persist or promote provider rows into the curated Trend catalog.

Requests are explicit-action only. A bounded in-process cache coalesces concurrent identical requests, and a per-process daily request budget prevents unbounded provider calls. Geography is part of each cache key. This cache and budget do not provide cross-instance guarantees. The server does not automatically retry paid requests. Configuration uses TREND_RADAR_SEARCHAPI_ENABLED, SEARCHAPI_API_KEY, SEARCHAPI_BASE_URL, SEARCHAPI_TIMEOUT_MS, SEARCHAPI_RELATED_QUERIES_TIMEOUT_MS, SEARCHAPI_GEO_MAP_TIMEOUT_MS, TREND_RADAR_TZ_MINUTES, TREND_RADAR_CATEGORY, TREND_RADAR_CACHE_TTL_SHORT_SECONDS, TREND_RADAR_CACHE_TTL_LONG_SECONDS, and TREND_RADAR_MAX_PROVIDER_REQUESTS_PER_DAY. `SEARCHAPI_RELATED_QUERIES_TIMEOUT_MS` defaults to 30 seconds (maximum 30 seconds), `SEARCHAPI_GEO_MAP_TIMEOUT_MS` defaults to 30 seconds (maximum 30 seconds), and `SEARCHAPI_TIMEOUT_MS` governs `TIMESERIES` and other SearchApi requests. The related-query and interest routes allow up to 45 seconds for provider timeouts to resolve cleanly. When only regional interest fails, the user may explicitly retry that section through the existing interest endpoint. Successful sibling datasets are reused from the adapter cache when available. The server does not retry automatically. The bearer key is server-only; the user-selected geography is validated against the provider catalog.

## 89. SearchApi Trend Radar interest endpoint

POST `/api/v1/trend-radar/interest` adds the TIMESERIES and GEO_MAP datasets for the same authenticated profile query used by section 88. The strict request body is the same filter object accepted by `/related-queries` (`period`, `property`, `geo`, and only the range fields required by the selected period); omitted `geo` defaults to Worldwide. It rejects unsupported geography codes, query text, user identity, provider URLs, API keys, and unknown fields. Authentication, completed onboarding, same-origin validation, body-size limits, and the profile resolver are shared with the existing Trend Radar flow. No database contract, profile field, or migration is added.

The server resolves the query from `preferredProductType` for ENTREPRENEUR and `businessName` for UMKM_EXISTING. It sends two SearchApi requests with `engine=google_trends`, server-owned `q`, the selected geography code (empty means Worldwide), `cat=0`, approved `tz=-420`, selected `time`, and optional `gprop` (`images`, `news`, `froogle`, or `youtube`; omitted for web). TIMESERIES uses `data_type=TIMESERIES`; GEO_MAP uses `data_type=GEO_MAP` and `region=COUNTRY` for Worldwide, otherwise `region=REGION`. Both use the configured HTTPS SearchApi host and existing bearer key, timeout, cache TTLs, and per-process daily request budget. No paid request is retried. Cache keys include data type, query, time, property, geography, region granularity, timezone, and category.

The success response contains `provider`, `productQuery`, `appliedFilters`, `timeSeries`, `regionalInterest`, per-dataset `availability`, per-dataset retrieval/cache/error metadata, and `requestId`. Availability is `available`, `empty`, or `failed`; failure of one provider dataset does not discard the other dataset. Provider-level failures are sanitized into bounded messages and codes. Timeline points retain provider Unix-second timestamps and date labels, are sorted chronologically, and use exact-query values only. Values are constrained to the 0-100 interest-index range; missing values remain null, and no synthetic observations are inserted. GEO_MAP region rows retain source codes and names, sort by index descending with deterministic code tie-breaking, and keep valid but unmapped codes in the table.

The ranked regional table is available for every selected geography. The Indonesia choropleth appears only when `geo=ID` and uses the pinned geoBoundaries `gbOpen` Indonesia ADM1 2017 simplified GeoJSON (34 features), attributed to OpenStreetMap/Wambacher under the ODbL 1.0 metadata license. Explicit SearchApi-to-`shapeISO` mappings live in `src/trend/indonesia-region-boundaries.ts`. An unknown region is not assigned to an approximate feature. The map and ranked table represent normalized interest indices, not absolute volume or market size. The established `tz=-420` setting is retained; SearchApi timezone-sign equivalence remains unresolved as documented in section 88.

## 90. SearchApi evidence for private Opportunity hypotheses

The local AI SDK deadline expiry remains HTTP 503 with AI_UPSTREAM_UNAVAILABLE; the Indonesian message identifies the timeout and confirms that this application did not save a new hypothesis. A 9Router HTTP 408/504, a client abort, an upstream HTTP failure, and a local deadline expiry have separate sanitized diagnostic categories. The route passes its Web Request.signal through to the SDK. Development-only diagnostic details add timing, safe byte counts, concurrency state, and validation outcomes without exposing prompts, provider bodies, credentials, or profile values. The request deadline is AI_ANALYSIS_TIMEOUT_MS (default 20,000 ms; valid range 1,000–60,000 ms); an invalid configured value rejects provider configuration instead of falling back. Local development may use 60,000 ms only after confirming no shorter runtime deadline. Production must use a value below its verified deployment-platform limit.

`POST /api/v1/opportunities/signals` accepts the same strict period/property/geography filters as Trend Radar and is available only to an authenticated user with completed Entrepreneur or UMKM onboarding. It resolves the same server-owned profile query (`preferredProductType` for Entrepreneur, `businessName` for UMKM) and reuses the existing SearchApi Google Trends adapter and cache. It requests data only after the user presses **Muat sinyal**; opening or refreshing `/opportunities` does not contact SearchApi. A valid adapter cache entry is reused, and the existing provider timeout, per-process budget, and no-retry behavior remain in effect.

The response contains eligible normalized `top` and `rising` observations, applied filters, retrieval time, and short-lived encrypted `sourceToken` references. Tokens use AES-256-GCM with a domain-separated key derived from the configured Auth.js `AUTH_SECRET`, bind the owner ID, and expire with the SearchApi adapter cache entry. The generation route decrypts and validates the reference, checks ownership and freshness, and does not trust client-authored source text or metrics. A non-template `AUTH_SECRET` of at least 32 characters is required before the SearchApi request is made, so the app does not spend provider quota when it cannot safely issue source references. Tokens are stateless and work across application instances sharing the same secret; expired tokens require a new explicit load.

`POST /api/v1/opportunities/ideas` accepts `{ sourceToken, consent, disclosureVersion }` for the SearchApi-backed path. The current disclosure is `opportunities-searchapi-ninerouter-profile-v2`; v1 consent is rejected. Top `interestIndex` remains distinct from Rising `growthLabel`/`growthPercent`; Breakout remains a label with no converted percentage. Search terms and profile text are untrusted data. On each generation, the server rebuilds an allowlisted projection from the authenticated owner's persisted Entrepreneur or UMKM profile; the browser cannot author profile context. Entrepreneur context includes relevant product interests, segments, channels, budget, location, experience, time commitment, business objective, and notes. UMKM context includes business name/category/description, existing products and prices, average price range, location, segments, channels, and notes. Identifiers, email, credentials, session data, and unrelated profile data are excluded. The UI discloses applicable profile categories before consent. The dedicated `NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED` gate is independent from the Bright Data gate and defaults to `false`. Public plaintext HTTP is rejected; direct loopback HTTP is accepted only for the validated development gateway and explicit `NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY=true` setting. The tunnel-confirmation flag is reserved for a verified encrypted tunnel.

The prompt separates sourced profile facts, SearchApi observations, inferences, and assumptions. Each generated hypothesis cites its selected evidence identifier and present profile field references, explains evidence limits, and includes validation steps. Before prompt construction, free-text profile values redact email addresses, phone numbers, UUID-like identifiers, and labeled credential values. Source-aware validation rejects unavailable references, unsupported numbers or business metric claims, financial-performance claims, guarantees, and persona-incompatible opportunity types. `INSUFFICIENT_EVIDENCE` is a successful, non-persisting outcome returned as `{ data: [], outcome, reason, limitations }`; it is distinct from provider failure. The UI accepts historical hypothesis rows with the original fields and renders enrichment fields when present.

The generated prompt states the strict Zod output contract, including required/non-null fields, supported opportunity types, text limits, array limits, and the exact shapes for HYPOTHESES and INSUFFICIENT_EVIDENCE. Prompt constraints and schema bounds share the same local constants. Numeric validation checks value, unit, semantic meaning, and profile/evidence provenance; it does not treat equal digits as interchangeable across an interest index, percentage, price, customer count, or revenue. Indonesian decimal/thousands separators and number words are normalized conservatively. Verified facts require exact source/profile matching. Explicitly proposed experiment sample counts and testing durations may be used as future parameters when the text describes a concrete action; they cannot be presented as completed results or statistically representative evidence. A verified filter period or retrieval date may be used only with its original time/date meaning. Schema or grounding failures are rejected before persistence, without retries, field dropping, silent repair, or fallback hypotheses. Development diagnostics may include trusted schema paths, issue categories, safe type/length/limit metadata, numeric unit classification, prospective-action and source-match flags, safe rejection reasons, correlation ID, model, source category, upstream status, and duration. Raw provider text, response values, prompts, credentials, profile financial values, and source tokens are not logged.

The server builds a typed financial-availability inventory from the fresh profile projection. Entries distinguish metric, subject scope and identity, `KNOWN`/`PARTIAL`/`UNKNOWN` status, trusted source reference, and related profile field where applicable. Existing product prices, average business price, proposed-product price, competitor price, willingness to pay, production cost, operating cost, revenue history, margin, sales volume, and budget are separate scopes. SearchApi Top/Rising observations do not populate financial metrics. A business-level average or another product's price therefore cannot establish the availability of a proposed-product or competitor price.

For model output, `evidenceGapIds` is a required array of server-issued references selected from the request's eligible gap catalogue. The server validates each ID against that catalogue and materializes an approved description into the existing `evidenceGaps: string[]` hypothesis field before persistence and response mapping. Free-form model-authored gap descriptions and unknown or duplicate IDs are rejected before persistence. Known product prices do not receive an `EXISTING_PRODUCT_PRICE_UNKNOWN` gap; unpriced existing products receive only their own subject-specific gap. Proposed-product and competitor-price gaps remain eligible when profile prices are known. This internal generation contract preserves the saved hypothesis and API response shapes, including legacy rows. Numeric amounts and financial-performance claims in other generated fields remain subject- and source-validated. Safe diagnostics use metric/scope/status codes and opaque references, never claim text or private values.

SearchApi provider result sets and tokens are not persisted. After successful 9Router output validation and evidence-gap materialization, the existing owner-scoped `user_generated_opportunities` table stores the private hypothesis and a bounded SearchApi source-reference variant in JSONB, including source ID, context/prompt versions (`opportunity-analysis-v2` and `opportunity-profile-searchapi-v4`), and a keyed HMAC context fingerprint. Raw profile context, prompts, and profile values are not stored in that fingerprint. The SearchApi source metadata fields are optional so historical records remain readable; enriched hypothesis response fields are also optional for legacy reads. Existing Bright Data source-reference records remain readable; no migration or published catalog change is required. The onboarding `profileVersion` calculation is unchanged; notes participate only in the separate Opportunity Finder fingerprint. Save/unsave continues to update only the authenticated owner's generated hypothesis.

## 91. SearchApi Google Trends geography options

`GET /api/v1/trend-radar/geographies?q=` returns up to 40 geography options from the server-side SearchApi Google Trends Geo Locations catalog. `q` is optional and limited to 80 characters. An empty query returns Worldwide and common country options; a non-empty query searches localized labels, provider names, and codes. The route does not authenticate because the response contains public provider geography metadata only; it does not resolve a user profile or call SearchApi. Responses use public cache headers.

The catalog snapshot is stored at `src/trend/searchapi-google-trends-geos.json`. Labels are localized for Indonesian readers; subdivisions include their country name. Request handlers validate selected codes against the same catalog before any provider call. The selector is shared by Trend Radar and Opportunity Finder. Worldwide is represented by the empty geo code documented by SearchApi.

## 92. Deleting a private generated hypothesis

`DELETE /api/v1/opportunities/ideas` accepts a strict JSON body `{ "id": "<hypothesis UUID>" }`. It requires a same-origin request and a signed-in user with a supported completed persona. The repository deletes only the row matching both the supplied hypothesis ID and authenticated `user_id`; `204 No Content` is returned when that row is removed or was already absent. This is idempotent and does not disclose whether an ID belongs to another user. Deletion removes the hypothesis from both Opportunity Finder and Saved Opportunities. It does not affect global Opportunities, Trends, or database schema.


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

## Existing concept alignment guard (22 October 2026)

The existing optional businessAnalysis JSONB snapshot may include conceptAlignmentVersion: business-concept-alignment-v1 after a successful independent semantic review. Existing request shapes and database columns are unchanged. Legacy snapshots remain stored but require reanalysis before new Compare/Growth use. See [Existing Business Completion.md](Existing%20Business%20Completion.md) for fail-closed, retry and compatibility rules.


## Weekly Food & Drink notification contract — current implementation

Migration 026 supersedes the earlier configurable daily digest. The active API exposes a server-owned Food & Drink / Worldwide digest every Monday at 12.00 WIB, a strict enabled toggle, owner-scoped inbox, and optional per-device Web Push. Current endpoint and delivery semantics are specified in [Trend Notifications.md](Trend%20Notifications.md). Notifications do not generate opportunities, scores, analyses, or roadmaps automatically.


## Amendment: journey reports and roadmap completion (22 October 2026)

See [Journey Reports](Journey%20Reports.md) for the authorized two-persona PDF/XLSX export, explicit stage completion gate, owner-scoped progress persistence/API, and device support acceptance contract.
