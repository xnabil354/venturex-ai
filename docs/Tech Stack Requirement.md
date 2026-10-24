# TECH STACK REQUIREMENT
## VENTUREX AI — Future Trend Intelligence & Business Growth Navigator

> **Implementation snapshot — 24 October 2026:** versi package, runtime architecture, worker, dan integrasi aktual dirangkum di [Current Implementation](Current%20Implementation.md). `package.json`, `pnpm-lock.yaml`, `next.config.ts`, dan `compose.yaml` tetap menjadi sumber versi/runtime yang dieksekusi.

**Dokumen:** Tech Stack Requirement
**Versi:** 1.0
**Status:** Technical Baseline untuk MVP Hackathon
**Tanggal Baseline:** 26 September 2026
**Referensi Fungsional:** `VENTUREX_AI_FSD.md`
**Referensi Produk:** `VENTUREX_AI_PRD.md`
**Platform:** Fullstack Web Application
**Architecture Style:** Modular Monolith
**Primary Runtime:** Node.js
**Primary Framework:** Next.js App Router
**Primary Language:** TypeScript
**Primary Database:** PostgreSQL
**ORM:** Sequelize
**Authentication:** NextAuth.js / Auth.js
**Containerization:** Docker

---

# 1. Tujuan Dokumen

Dokumen ini mendefinisikan **standar teknologi, tools, library, runtime, arsitektur, development convention, deployment strategy, dan engineering constraints** untuk pengembangan VENTUREX AI.

Dokumen ini menjadi acuan bagi:

- Software Engineer;
- Frontend Engineer;
- Backend Engineer;
- System Analyst;
- Database Engineer;
- AI Engineer;
- QA Engineer;
- DevOps Engineer;
- Technical Lead.

Tujuan utama Tech Stack Requirement adalah memastikan:

1. seluruh anggota tim menggunakan stack yang konsisten;
2. arsitektur aplikasi sesuai BRD, PRD, dan FSD;
3. aplikasi dapat dikembangkan dengan cepat untuk hackathon;
4. codebase tetap maintainable;
5. deployment dapat direproduksi dengan Docker;
6. keamanan dasar terpenuhi;
7. application layer, database layer, AI layer, dan integration layer tidak tercampur secara tidak terstruktur;
8. dependency yang digunakan memiliki alasan teknis yang jelas.

---

# 2. Architectural Decision Summary

VENTUREX akan dibangun menggunakan pendekatan:

> **Next.js Fullstack Modular Monolith**

Artinya frontend dan backend berada dalam satu repository Next.js, tetapi kode tetap dipisahkan berdasarkan responsibility.

High-level architecture:

```text
CLIENT / BROWSER
      ↓
NEXT.JS APP ROUTER
      ↓
SERVER COMPONENTS / ROUTE HANDLERS / SERVER ACTIONS
      ↓
APPLICATION / SERVICE LAYER
      ↓
─────────────────────────────────────────────
↓                   ↓                  ↓
DATABASE          AI LAYER        EXTERNAL DATA
SEQUELIZE         PROVIDER        SOURCES
↓
POSTGRESQL
```

Architecture ini dipilih karena:

- sesuai kebutuhan aplikasi fullstack hackathon;
- deployment lebih sederhana;
- tidak membutuhkan microservices pada MVP;
- mengurangi operational complexity;
- tetap dapat dipisahkan menjadi service terpisah di masa depan jika diperlukan.

---

# 3. Baseline Technology Versions

Versi berikut merupakan **baseline tanggal 26 September 2026**.

| Layer | Technology | Baseline |
|---|---|---|
| Runtime | Node.js | 24 LTS |
| Framework | Next.js | 16.3.x Active LTS |
| Baseline Next.js | Next.js | 16.3.6 |
| UI Runtime | React | React 19.x |
| Language | TypeScript | Latest compatible stable |
| Package Manager | pnpm | Latest stable via Corepack |
| Database | PostgreSQL | 18.x |
| PostgreSQL Baseline | PostgreSQL | 18.6 |
| ORM | Sequelize | v6 stable |
| DB Driver | pg | Latest compatible stable |
| Authentication | NextAuth.js/Auth.js | v5 beta line, pinned patched version |
| Auth Baseline | next-auth | 5.0.0-beta.32 |
| Container | Docker | Latest stable |
| Local Orchestration | Docker Compose | Compose v2 |

## 3.1 Version Upgrade Rule

Versi patch **tidak boleh dibekukan secara buta sampai hari final lomba**.

Sebelum:

- production build;
- final submission;
- live demo;

Technical Lead wajib memeriksa security release terbaru.

Contoh:

Next.js baseline dokumen ini adalah `16.3.6`, tetapi jika security patch baru tersedia sebelum deployment final, gunakan patch terbaru dalam line Active LTS setelah regression test.

---

# 4. Runtime Requirement

# 4.1 Node.js

Gunakan:

```text
Node.js 24 LTS
```

Recommended Docker baseline:

```text
node:24-slim
```

Untuk build reproducibility, production dapat menggunakan pinned patch image setelah final validation.

Example:

```text
node:24.21.0-slim
```

## Requirement

- Node.js harus versi LTS.
- Jangan menggunakan Node Current untuk production hackathon.
- Runtime local, CI, dan Docker harus menggunakan major Node yang sama.

## `.nvmrc`

Recommended:

```text
24
```

## `package.json`

Recommended:

```json
{
  "engines": {
    "node": ">=24 <25"
  }
}
```

---

# 5. Package Manager

Gunakan:

> **pnpm**

Alasan:

- dependency installation cepat;
- storage efficient;
- lockfile reproducible;
- cocok untuk Next.js modern.

Gunakan Corepack:

```bash
corepack enable
```

Install dependency:

```bash
pnpm install
```

## Requirement

Repository wajib memiliki:

```text
pnpm-lock.yaml
```

Lockfile wajib di-commit.

Dilarang mencampur:

```text
package-lock.json
yarn.lock
pnpm-lock.yaml
```

dalam repository yang sama.

---

# 6. Frontend & Fullstack Framework

# 6.1 Next.js

Gunakan:

> **Next.js 16 App Router**

Baseline:

```text
next@16.3.6
```

Sebelum final deployment:

```text
upgrade ke security-patched 16.3.x terbaru
```

## Mandatory

Gunakan:

```text
App Router
```

Directory utama:

```text
src/app/
```

Jangan menggunakan `pages/` router untuk fitur baru.

---

# 6.2 Routing Convention

Gunakan file-system routing App Router.

Example:

```text
src/app/
├── page.tsx
├── layout.tsx
├── loading.tsx
├── error.tsx
├── not-found.tsx
│
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
│
├── (app)/
│   ├── dashboard/
│   │   └── page.tsx
│   ├── trends/
│   │   ├── page.tsx
│   │   └── [trendId]/
│   │       └── page.tsx
│   ├── opportunities/
│   │   ├── page.tsx
│   │   ├── compare/
│   │   │   └── page.tsx
│   │   └── [opportunityId]/
│   │       └── page.tsx
│   ├── roadmaps/
│   │   └── [roadmapId]/
│   │       └── page.tsx
│   ├── saved/
│   │   └── page.tsx
│   └── profile/
│       └── page.tsx
│
└── api/
    ├── auth/
    ├── trends/
    ├── opportunities/
    ├── roadmaps/
    └── profile/
```

Route Groups:

```text
(auth)
(app)
```

digunakan untuk grouping tanpa menambah URL segment.

---

# 6.3 Server Components

Default:

> **React Server Components**

Jangan menambahkan:

```tsx
"use client";
```

secara otomatis pada semua component.

Gunakan Client Component hanya bila membutuhkan:

- state browser;
- event handler;
- browser API;
- interactive UI;
- client-only library.

Rule:

> **Server-first, Client only when necessary.**

---

# 6.4 Route Handlers

REST/API internal menggunakan:

```text
src/app/api/**/route.ts
```

Example:

```text
src/app/api/opportunities/route.ts

GET /api/opportunities
```

Dynamic:

```text
src/app/api/opportunities/[opportunityId]/route.ts
```

Methods:

```text
GET
POST
PUT
PATCH
DELETE
```

sesuai kebutuhan.

---

# 6.5 Server Actions

Server Actions boleh digunakan untuk:

- simple internal form mutation;
- profile update;
- server-side form operation;

jika tidak dibutuhkan sebagai external/public API.

Namun:

> business logic tidak boleh ditulis langsung di Server Action.

Server Action hanya memanggil Service Layer.

Example:

```text
Server Action
↓
ProfileService
↓
ProfileRepository
↓
Sequelize
```

---

# 6.6 Proxy

Untuk Next.js 16 gunakan:

```text
proxy.ts
```

untuk request-level authentication routing apabila sesuai.

Jangan membangun implementasi baru dengan pola lama `middleware.ts` jika framework version telah menggunakan Proxy convention.

Example logical responsibility:

```text
proxy.ts
↓
check authentication
↓
protect /dashboard
↓
protect /opportunities
↓
protect /roadmaps
```

Authorization resource-level tetap dilakukan server-side pada Service/Repository layer.

Proxy **bukan satu-satunya security layer**.

---

# 7. TypeScript Requirement

Semua application code wajib menggunakan:

> **TypeScript**

Extension:

```text
.ts
.tsx
```

JavaScript hanya diperbolehkan jika dependency/config tertentu memang membutuhkan.

## `tsconfig`

Wajib:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

Jika library tertentu menyebabkan incompatibility, perubahan strict rule harus memiliki alasan yang terdokumentasi.

---

# 7.1 Type Rules

Dilarang menggunakan:

```typescript
any
```

secara sembarangan.

Jika benar-benar diperlukan:

```typescript
unknown
```

lebih diprioritaskan dan harus di-narrow.

Gunakan:

- interfaces/types untuk domain;
- Zod inference untuk request schema;
- Sequelize typed models untuk database.

---

# 8. UI Styling

Gunakan:

> **Tailwind CSS**

Recommended:

```text
Tailwind CSS 4.x
```

Tujuan:

- development cepat;
- consistency;
- responsive utilities;
- mudah untuk hackathon;
- tidak perlu custom CSS besar.

---

# 8.1 Component System

Recommended:

> **shadcn/ui**

Supporting primitive:

> Radix UI

Keuntungan:

- accessible primitive;
- customizable;
- source code berada di project;
- tidak terkunci pada black-box component library.

---

# 8.2 Icons

Gunakan:

```text
lucide-react
```

Jangan mencampur banyak icon library tanpa alasan.

---

# 8.3 Notifications

Recommended:

```text
sonner
```

Untuk:

- success notification;
- validation message;
- async operation result.

---

# 8.4 Charts

VENTUREX membutuhkan Trend Radar dan trend visualization.

Recommended:

> **Recharts**

Digunakan untuk:

- trend line;
- opportunity comparison;
- score visualization bila diperlukan.

Rule:

Chart bukan sumber fakta.

Data chart harus berasal dari service/data layer.

---

# 9. Form Management

Gunakan:

```text
react-hook-form
```

untuk complex client forms.

Gunakan:

```text
zod
```

untuk runtime schema validation.

Resolver:

```text
@hookform/resolvers
```

Flow:

```text
Form
↓
React Hook Form
↓
Zod Validation
↓
Route Handler / Server Action
↓
Backend Zod Validation Again
↓
Service Layer
```

Frontend validation tidak menggantikan backend validation.

---

# 10. Runtime Validation

Gunakan:

> **Zod**

untuk:

- API request;
- environment variables;
- form payload;
- AI structured response;
- external source payload;
- configuration.

Example:

```typescript
const opportunityIdSchema = z.string().uuid();
```

---

# 11. State Management

VENTUREX tidak membutuhkan Redux pada MVP.

Default priority:

```text
1. Server Component data
2. URL/searchParams
3. Local React State
4. Context
5. Global state library only if justified
```

Untuk compare selection atau small client state:

- local state;
- URL params;
- Context;

lebih diprioritaskan.

Jika kemudian membutuhkan lightweight global state:

```text
Zustand
```

boleh ditambahkan.

Namun Zustand **bukan mandatory dependency** pada baseline MVP.

---

# 12. Data Fetching Strategy

# 12.1 Server-Side Data

Untuk Server Components:

```text
Server Component
↓
Service Layer
↓
Repository
↓
Sequelize
```

Jangan melakukan:

```text
Server Component
→ fetch /api/internal-route
```

jika code berada pada application server yang sama.

Hal tersebut menciptakan network hop internal yang tidak diperlukan.

---

# 12.2 Client-Side Data

Untuk interactive client feature:

```text
Client Component
→ Route Handler API
```

Gunakan native:

```typescript
fetch()
```

Axios tidak wajib.

---

# 12.3 TanStack Query

TanStack Query tidak mandatory.

Tambahkan hanya jika aplikasi membutuhkan:

- client-side caching intensif;
- background refresh;
- optimistic update;
- complex server-state synchronization.

MVP awal sebaiknya memanfaatkan Next.js data architecture terlebih dahulu.

---

# 13. Application Architecture

Gunakan:

> **Modular Layered Architecture**

Recommended layers:

```text
UI / App Layer
↓
Controller / Route Handler / Action
↓
Application Service
↓
Domain Logic
↓
Repository
↓
ORM
↓
Database
```

Integration:

```text
Application Service
↓
AI Adapter / External Data Adapter
```

---

# 13.1 Responsibility Rules

## UI Layer

Bertanggung jawab:

- rendering;
- user interaction;
- presentation.

Tidak boleh:

- direct SQL;
- direct ORM logic;
- complex scoring formula.

---

## Route Handler / Action

Bertanggung jawab:

- request parsing;
- authentication context;
- validation;
- response mapping.

Tidak boleh:

- memiliki large business logic.

---

## Service Layer

Bertanggung jawab:

- use case;
- business process;
- orchestration;
- authorization rule;
- transaction boundary.

---

## Repository Layer

Bertanggung jawab:

- database query;
- Sequelize model interaction.

---

## Integration Layer

Bertanggung jawab:

- AI provider;
- trend API;
- external source.

---

# 14. Recommended Source Directory

```text
src/
├── app/
│   ├── (auth)/
│   ├── (app)/
│   └── api/
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── trend/
│   ├── opportunity/
│   └── roadmap/
│
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── profile/
│   ├── trends/
│   ├── opportunities/
│   ├── scoring/
│   ├── analysis/
│   └── roadmaps/
│
├── server/
│   ├── services/
│   ├── repositories/
│   ├── auth/
│   └── integrations/
│
├── db/
│   ├── models/
│   ├── migrations/
│   ├── seeders/
│   └── sequelize.ts
│
├── lib/
│   ├── ai/
│   ├── validation/
│   ├── logger/
│   ├── errors/
│   └── utils/
│
├── schemas/
├── types/
├── config/
└── constants/
```

---

# 15. Database

Gunakan:

> **PostgreSQL**

Baseline:

```text
PostgreSQL 18.6
```

Docker production/local:

```text
postgres:18-alpine
```

atau pinned patch image setelah testing.

---

# 15.1 Database Principles

Gunakan database relational karena VENTUREX memiliki entity dengan relationship jelas:

- User;
- EntrepreneurProfile;
- BusinessProfile;
- Trend;
- Opportunity;
- Evidence;
- UserOpportunityAnalysis;
- SavedOpportunity;
- Roadmap;
- RoadmapStep.

---

# 15.2 Primary Key

Recommended:

```text
UUID
```

Contoh:

```text
user_id UUID
opportunity_id UUID
roadmap_id UUID
```

Keuntungan:

- tidak expose sequential count;
- mudah distributed integration;
- predictable schema.

---

# 15.3 Time

Semua database timestamp disimpan dalam:

> UTC

Fields:

```text
created_at
updated_at
generated_at
source_date
```

UI melakukan conversion sesuai timezone user jika diperlukan.

---

# 15.4 Money

Untuk nilai Rupiah:

Jangan gunakan floating point.

Gunakan:

```text
BIGINT
```

untuk nominal Rupiah bulat.

Example:

```text
10000000
```

= Rp10.000.000.

Jika memerlukan decimal monetary value:

```text
DECIMAL
```

Gunakan hanya ketika memang diperlukan.

---

# 15.5 JSONB

PostgreSQL `JSONB` boleh digunakan untuk:

- AI response snapshot;
- score component breakdown;
- external raw metadata;
- flexible evidence metadata.

Namun core relational data tetap dinormalisasi.

Jangan menyimpan seluruh database sebagai JSONB.

---

# 16. ORM

Gunakan:

> **Sequelize**

Production baseline:

> **Sequelize v6 stable**

Alasan:

Sequelize v7 masih alpha pada baseline dokumen ini.

Karena itu:

```text
DO NOT use Sequelize v7 alpha
```

untuk production MVP kecuali ada keputusan technical lead.

---

# 16.1 PostgreSQL Driver

Install:

```text
sequelize
pg
pg-hstore
```

Jika application tidak menggunakan HSTORE secara langsung, dependency dapat direview setelah compatibility testing.

---

# 16.2 Sequelize Model Typing

Gunakan TypeScript typed model.

Pattern:

```typescript
InferAttributes<Model>
InferCreationAttributes<Model>
CreationOptional<T>
```

atau typing equivalent yang kompatibel Sequelize v6.

Hindari model tanpa TypeScript type.

---

# 16.3 Connection

Database connection harus berada di server-only module.

Example:

```text
src/db/sequelize.ts
```

Tambahkan guard agar module tidak masuk client bundle.

Recommended:

```typescript
import "server-only";
```

---

# 16.4 Connection Pool

Config melalui environment.

Baseline MVP:

```text
DB_POOL_MAX=10
DB_POOL_MIN=0
DB_POOL_IDLE=10000
DB_POOL_ACQUIRE=30000
```

Nilai final menyesuaikan kapasitas deployment.

Jangan membuka connection baru untuk setiap query.

---

# 16.5 Transactions

Gunakan transaction untuk operasi multi-table yang harus atomic.

Contoh:

```text
Generate Roadmap
↓
Insert Roadmap
↓
Insert Roadmap Steps
```

Semua harus:

```text
COMMIT
```

atau:

```text
ROLLBACK
```

bersama.

---

# 17. Database Migration

Production dilarang menggunakan:

```typescript
sequelize.sync({ alter: true })
```

sebagai mekanisme schema migration.

Gunakan migration versioning.

Recommended:

> **Umzug + SequelizeStorage**

Alternative yang diperbolehkan:

> Sequelize CLI

jika team memilih official CLI workflow.

Requirement:

```text
db/migrations/
```

harus berada di Git.

Migration harus:

- deterministic;
- versioned;
- reviewable;
- reversible jika practical.

---

# 17.1 Seed Data

Gunakan seeder untuk:

- prepared trend dataset;
- sample opportunity;
- demo data.

Seeder tidak boleh membuat credential production default yang lemah.

---

# 18. Authentication

User meminta:

> **NextAuth.js**

Gunakan package:

```text
next-auth
```

Untuk modern App Router integration gunakan Auth.js/NextAuth v5 API line.

Baseline:

```text
next-auth@5.0.0-beta.32
```

## Important Engineering Note

Pada baseline 26 September 2026, NextAuth v5 masih berada pada beta line.

Karena user requirement menetapkan NextAuth dan v5 mendukung Next.js 16:

- pin exact patched version;
- jangan menggunakan floating beta tag di production;
- lakukan regression test sebelum upgrade;
- monitor security advisory.

Jika sebelum final release tersedia stable v5 yang compatible:

> migrasikan ke stable patched v5 setelah testing.

---

# 18.1 Authentication Method

MVP requirement PRD menggunakan:

```text
email + password
```

Gunakan:

> Credentials Provider

Authentication flow:

```text
Email + Password
↓
NextAuth Credentials Provider
↓
AuthService
↓
Sequelize UserRepository
↓
Verify Password Hash
↓
Create Auth Session
```

---

# 18.2 Password Hashing

Gunakan:

> **Argon2id**

Recommended Node library:

```text
argon2
```

Password tidak boleh:

- disimpan plain text;
- dicatat dalam log;
- dikirim kembali lewat API.

Jika native dependency menimbulkan masalah build Docker, team boleh mengevaluasi library Argon2 lain yang maintained dan menyediakan binary compatible.

Jangan turun ke SHA256/MD5 untuk password.

---

# 18.3 Session Strategy

Untuk MVP Credentials authentication:

Recommended:

> **JWT session**

JWT hanya menyimpan minimum claim:

```text
user.id
user.userType
```

Optional:

```text
role
```

Jangan menyimpan:

- password;
- API key;
- business profile lengkap;
- sensitive payload.

---

# 18.4 Authentication Files

Recommended:

```text
src/auth.ts
src/auth.config.ts
src/app/api/auth/[...nextauth]/route.ts
proxy.ts
```

---

# 18.5 NextAuth Secret

Environment:

```text
AUTH_SECRET
```

Generate menggunakan secure random generator / Auth.js CLI.

Secret tidak boleh:

- commit ke Git;
- ditulis di Dockerfile;
- di-share pada frontend.

---

# 18.6 Optional OAuth

Google OAuth dapat ditambahkan sebagai:

> Should Have

Environment:

```text
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
```

Namun MVP email/password tetap harus berfungsi sesuai PRD.

---

# 18.7 Auth Adapter

Untuk MVP Credentials + JWT:

> database adapter tidak wajib.

User account dapat dikelola melalui Sequelize domain model.

Jika OAuth/database session ditambahkan:

```text
@auth/sequelize-adapter
```

dapat dievaluasi.

Jangan mencampur Auth adapter schema dan custom User schema tanpa model mapping yang jelas.

---

# 19. Authorization

Authentication tidak sama dengan Authorization.

Authorization server-side harus memastikan:

```text
user A cannot read user B profile
user A cannot read user B roadmap
user A cannot edit user B saved opportunity
```

Pattern:

```text
Session
↓
Service
↓
Ownership Check
↓
Repository
```

Frontend hiding tidak dianggap authorization.

---

# 20. AI Layer

VENTUREX membutuhkan AI untuk:

- opportunity explanation;
- structured analysis;
- roadmap generation;
- reasoning based on profile + trend + score + evidence.

---

# 20.1 AI Integration Architecture

Gunakan provider abstraction.

```text
Application
↓
AIService
↓
AIProvider Interface
↓
Provider Adapter
↓
LLM API
```

Jangan memanggil provider SDK langsung dari UI component.

---

# 20.2 Recommended AI SDK

Recommended:

> **Vercel AI SDK**

Package:

```text
ai
```

dan provider package sesuai model yang digunakan.

Keuntungan:

- provider abstraction;
- streaming;
- structured output;
- Next.js integration.

Jika team memilih official provider SDK langsung, `AIService` abstraction tetap wajib.

---

# 20.3 Structured Output

Gunakan:

> Zod schema

untuk validate AI response.

Example logical schema:

```text
summary
whyRelevant
targetConsumer
competition
potential
risks[]
nextAction
```

Invalid AI output:

```text
AIService
↓
Validation Failure
↓
Retry/Controlled Fallback
```

Jangan render raw invalid JSON.

---

# 20.4 Grounded AI

AI input wajib menggunakan:

```text
User Type
Profile
Opportunity
Trend Context
Score
Risk
Evidence
```

AI tidak boleh menjadi source of truth untuk:

- numeric trend value;
- source date;
- opportunity score;
- user profile.

---

# 20.5 AI Secrets

Environment:

```text
AI_PROVIDER
AI_API_KEY
AI_MODEL
```

API key hanya server-side.

---

# 20.6 AI Rate Limit

MVP minimal memiliki basic per-user throttling pada:

```text
AI Analysis
Roadmap Generation
```

Untuk single-instance hackathon deployment, simple application-level throttling boleh digunakan.

Untuk multi-instance production:

Recommended future:

```text
Redis / Upstash
```

Redis **tidak mandatory** untuk MVP baseline.

---

# 21. Trend / External Data Integration

Gunakan integration adapter:

```text
TrendDataProvider
```

agar sumber data dapat diganti.

Example:

```text
TrendDataProvider
├── PreparedDatasetProvider
├── ExternalTrendProvider
└── GovernmentDataProvider
```

---

# 21.1 Fetch Client

Gunakan native:

```typescript
fetch()
```

yang tersedia pada Node/Next.js.

Axios tidak mandatory.

---

# 21.2 Fallback Data

Sesuai FSD:

Data source mode:

```text
LIVE
CACHED
PREPARED
```

Prepared dataset wajib tersedia untuk demo.

---

# 22. Logging

Gunakan structured logging.

Recommended:

> **Pino**

Packages:

```text
pino
pino-pretty
```

`pino-pretty` hanya development.

Log harus mencatat:

- request context;
- error code;
- operation;
- timestamp;
- request id.

Jangan log:

- password;
- auth token;
- API key;
- full sensitive session.

---

# 23. Error Handling

Buat application error abstraction.

Recommended:

```text
AppError
ValidationError
UnauthorizedError
ForbiddenError
NotFoundError
ExternalServiceError
AIServiceError
InsufficientDataError
```

Route Handler mengubah error menjadi standardized API response.

---

# 24. API Response Convention

Recommended:

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Data belum lengkap."
  }
}
```

Raw stack trace tidak boleh dikirim ke client.

---

# 25. Security Requirements

Minimum security:

- secure password hash;
- auth session;
- server authorization;
- Zod validation;
- CSRF protection dari auth framework;
- secure cookies;
- environment secret management;
- no raw SQL injection;
- security headers;
- rate limiting untuk expensive endpoint;
- dependency security update.

---

# 25.1 Security Headers

Configure:

- Content-Security-Policy;
- X-Content-Type-Options;
- Referrer-Policy;
- Permissions-Policy;
- frame restriction sesuai kebutuhan.

Implementasi dapat menggunakan Next.js headers configuration.

---

# 25.2 SQL Injection

Gunakan Sequelize parameterization.

Raw query hanya diperbolehkan jika:

- benar-benar dibutuhkan;
- menggunakan bind/replacements;
- telah direview.

Jangan concatenate user input ke SQL.

---

# 25.3 XSS

React escaping digunakan secara default.

Hindari:

```tsx
dangerouslySetInnerHTML
```

kecuali content sudah disanitize.

---

# 26. Environment Configuration

Gunakan:

```text
.env.local
```

untuk local.

Production secret melalui deployment environment.

Repository hanya menyimpan:

```text
.env.example
```

---

# 26.1 Required Environment Variables

Example:

```dotenv
NODE_ENV=development
APP_URL=http://localhost:3000

AUTH_SECRET=

DATABASE_URL=
DB_HOST=postgres
DB_PORT=5432
DB_NAME=venturex
DB_USER=venturex
DB_PASSWORD=
DB_SSL=false

DB_POOL_MAX=10
DB_POOL_MIN=0
DB_POOL_IDLE=10000
DB_POOL_ACQUIRE=30000

AI_PROVIDER=
AI_API_KEY=
AI_MODEL=

TREND_DATA_MODE=PREPARED

LOG_LEVEL=info
```

Optional:

```dotenv
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

SENTRY_DSN=

REDIS_URL=
```

---

# 26.2 Environment Validation

Gunakan Zod.

Aplikasi harus fail fast pada startup jika mandatory environment variable tidak valid.

Contoh:

```text
missing DATABASE_URL
→ fail startup

missing AUTH_SECRET
→ fail startup
```

Jangan menunggu sampai request runtime untuk menemukan configuration critical yang hilang.

---

# 27. Docker

Docker wajib digunakan untuk:

> **containerization dan deployment reproducibility**

Production menggunakan multi-stage Docker build.

---

# 27.1 Docker Build Strategy

Recommended stages:

```text
base
↓
dependencies
↓
builder
↓
runner
```

Next.js config:

```typescript
const nextConfig = {
  output: "standalone"
}
```

`standalone` digunakan agar runtime image lebih kecil.

---

# 27.2 Docker Security

Production container harus:

- menjalankan app sebagai non-root;
- hanya copy production output;
- tidak copy `.env`;
- tidak copy `.git`;
- tidak copy node_modules host;
- expose hanya port aplikasi.

---

# 27.3 Recommended Production Dockerfile Pattern

Conceptual:

```dockerfile
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
```

Final Dockerfile harus disesuaikan dengan pnpm/Next.js output aktual.

---

# 28. Docker Compose

Development environment minimal:

```text
app
postgres
```

Example structure:

```yaml
services:
  app:
    build:
      context: .
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_DB: venturex
      POSTGRES_USER: venturex
      POSTGRES_PASSWORD: change-me
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

Password pada example bukan production secret.

---

# 28.1 PostgreSQL Health Check

Required:

```text
pg_isready
```

App jangan diasumsikan database langsung ready hanya karena container sudah started.

---

# 28.2 App Health Endpoint

Recommended:

```text
GET /api/health
```

Response minimal:

```json
{
  "status": "ok"
}
```

Optional:

- database connectivity;
- app version.

Jangan expose secret/config.

---

# 29. Deployment Strategy

VENTUREX bersifat container-first.

Compatible target:

- VPS Docker;
- Railway;
- Render;
- Fly.io;
- cloud container runtime;
- Kubernetes future.

Untuk hackathon:

> gunakan platform dengan operational overhead rendah.

---

# 29.1 Production Components

```text
Internet
↓
TLS / Reverse Proxy / Platform Load Balancer
↓
VENTUREX Docker Container
↓
PostgreSQL
↓
AI / External Data APIs
```

Jika deploy ke VPS:

Recommended reverse proxy:

```text
Caddy
```

atau:

```text
Nginx
```

untuk TLS/reverse proxy.

Jika platform sudah menangani TLS, reverse proxy tambahan tidak wajib.

---

# 30. Database Deployment

Production PostgreSQL boleh:

1. managed PostgreSQL; atau
2. Docker PostgreSQL untuk simple hackathon deployment.

Untuk production nyata:

> managed PostgreSQL lebih direkomendasikan.

Alasan:

- backup;
- monitoring;
- recovery;
- patching.

---

# 31. Database Backup

Minimum sebelum final demo:

- database seed tersedia;
- SQL/database backup tersedia;
- restore procedure diuji.

Production future:

- automated backup;
- retention policy;
- point-in-time recovery jika provider mendukung.

---

# 32. Testing Stack

Testing wajib memiliki tiga level.

---

# 32.1 Unit Test

Recommended:

> **Vitest**

Digunakan untuk:

- scoring logic;
- service logic;
- validation;
- mapper;
- utility.

---

# 32.2 Component Test

Recommended:

```text
React Testing Library
```

Digunakan untuk:

- form;
- score component;
- risk component;
- conditional UI.

---

# 32.3 End-to-End

Gunakan:

> **Playwright**

Test:

```text
Register
Login
Onboarding
Opportunity
AI fallback
Roadmap
Authorization
```

---

# 32.4 Database Integration Test

Gunakan:

- dedicated test database;
- Docker PostgreSQL;
- transaction cleanup.

Jangan menjalankan integration test pada production database.

---

# 33. Code Quality

Gunakan:

> ESLint

Untuk Next.js 16:

Run:

```bash
pnpm eslint .
```

Jangan mengandalkan deprecated `next lint`.

---

# 33.1 Formatter

Recommended:

> Prettier

Config harus konsisten untuk seluruh team.

---

# 33.2 Pre-Commit

Recommended:

```text
Husky
lint-staged
```

Pre-commit:

- format staged;
- lint staged.

Full test tidak wajib di pre-commit jika terlalu lambat.

---

# 34. Required Scripts

Recommended `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:migrate": "...",
    "db:migrate:undo": "...",
    "db:seed": "..."
  }
}
```

Exact migration command menyesuaikan Umzug/CLI implementation.

---

# 35. CI/CD

Recommended platform:

> GitHub Actions

Pipeline:

```text
Push / Pull Request
↓
Install pnpm
↓
Install dependencies
↓
Lint
↓
Type Check
↓
Unit Test
↓
Build
↓
Docker Build
↓
Deploy (main only)
```

---

# 35.1 Required Quality Gate

Pull Request tidak boleh merge jika gagal:

- lint;
- typecheck;
- unit test;
- production build.

E2E dapat dijalankan:

- main branch;
- release candidate;
- scheduled;
- pre-demo.

---

# 36. Git Workflow

Recommended simple workflow:

```text
main
develop
feature/*
fix/*
```

Untuk tim kecil hackathon, boleh lebih sederhana:

```text
main
feature/*
```

asalkan Pull Request tetap digunakan.

Commit harus:

- kecil;
- jelas;
- tidak menyimpan secret.

---

# 37. Observability

Minimum:

- structured server logging;
- error tracking;
- health endpoint.

Recommended error monitoring:

> Sentry

Optional untuk MVP jika waktu sangat terbatas.

---

# 38. Caching Strategy

VENTUREX memiliki dua jenis data.

## User-Specific

Contoh:

- profile;
- fit score;
- saved opportunity;
- roadmap.

Jangan cache secara public/shared.

---

## Shared Market Data

Contoh:

- trends;
- public evidence;
- prepared datasets.

Boleh menggunakan:

- Next.js caching;
- database cache;
- timed revalidation.

---

# 38.1 Cache Rule

Jangan membuat cache key yang mengabaikan:

```text
user id
profile version
data version
```

untuk personalized output.

---

# 39. AI Cache

Recommended key:

```text
userId
+
opportunityId
+
profileVersion
+
trendDataVersion
+
aiModelVersion
```

Jika salah satu berubah:

- analysis dapat dianggap stale.

---

# 40. Date & Time

Recommended library:

```text
date-fns
```

untuk formatting jika native Intl tidak cukup.

Prioritaskan:

```typescript
Intl.DateTimeFormat
```

untuk simple formatting.

---

# 41. Utility Libraries

Recommended core utilities:

```text
clsx
tailwind-merge
class-variance-authority
```

untuk component class composition.

Jika menggunakan shadcn/ui, library tersebut umum digunakan.

---

# 42. Dependency Policy

Dependency baru hanya boleh ditambahkan bila:

1. problem jelas;
2. native/framework solution tidak memadai;
3. package maintained;
4. license compatible;
5. security acceptable;
6. dependency tidak overlap dengan library existing.

Dilarang memasang library hanya untuk satu utility sederhana yang dapat ditulis aman dalam beberapa baris.

---

# 43. Dependency Category Summary

## Mandatory

```text
next
react
react-dom
typescript

sequelize
pg

next-auth
argon2

zod

tailwindcss
```

## Strongly Recommended

```text
react-hook-form
@hookform/resolvers

shadcn/ui dependencies
lucide-react
recharts

pino

vitest
@testing-library/react
playwright
```

## Conditional

```text
ai
provider-specific AI SDK

sonner
date-fns
zustand
sentry
redis/upstash packages
```

---

# 44. Suggested Installation Groups

Conceptual only; use current compatible versions.

## Core

```bash
pnpm add next react react-dom
```

## Database

```bash
pnpm add sequelize pg pg-hstore
```

## Auth

```bash
pnpm add next-auth@5.0.0-beta.32 argon2
```

## Validation / Form

```bash
pnpm add zod react-hook-form @hookform/resolvers
```

## UI

```bash
pnpm add lucide-react recharts
```

## Logging

```bash
pnpm add pino
pnpm add -D pino-pretty
```

## Test

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @playwright/test
```

---

# 45. Sequelize Model Requirements

Model minimum:

```text
User
EntrepreneurProfile
BusinessProfile
Trend
Opportunity
UserOpportunityAnalysis
Evidence
SavedOpportunity
Roadmap
RoadmapStep
```

---

# 45.1 Model Convention

Filename:

```text
user.model.ts
entrepreneur-profile.model.ts
business-profile.model.ts
trend.model.ts
opportunity.model.ts
```

Table name:

```text
snake_case plural
```

Example:

```text
users
entrepreneur_profiles
business_profiles
```

Code property:

```text
camelCase
```

Database column:

```text
snake_case
```

Sequelize dapat menggunakan:

```text
underscored: true
```

---

# 46. Database Index Requirements

Minimum index candidates:

```text
users.email UNIQUE
users.user_type

trends.category
trends.updated_at

opportunities.category
opportunities.related_trend_id

user_opportunity_analyses.user_id
user_opportunity_analyses.opportunity_id

saved_opportunities(user_id, opportunity_id) UNIQUE

roadmaps.user_id
roadmaps.opportunity_id
roadmap_steps.roadmap_id
```

Index final ditentukan setelah query pattern diuji.

---

# 47. API Naming

Gunakan plural resource noun:

```text
/api/trends
/api/opportunities
/api/roadmaps
```

Hindari endpoint seperti:

```text
/api/getAllOpportunityData
```

Gunakan HTTP semantic.

---

# 48. Error Code Convention

Gunakan stable machine-readable codes:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
PROFILE_INCOMPLETE
INSUFFICIENT_DATA
AI_SERVICE_UNAVAILABLE
EXTERNAL_DATA_UNAVAILABLE
INTERNAL_ERROR
```

---

# 49. Performance

Karena PRD belum menetapkan hard SLA, MVP menggunakan target engineering:

- initial app page harus tetap responsive;
- data independent di-fetch parallel;
- AI menggunakan loading state;
- large visualization lazy-loaded jika diperlukan;
- image optimized dengan Next Image;
- bundle client diminimalkan.

---

# 49.1 Client Bundle Rule

Jangan import server-only dependency ke client:

```text
sequelize
pg
argon2
AI secret SDK server config
```

Jika build menemukan server package pada browser bundle, harus diperbaiki.

---

# 50. Accessibility

Minimum:

- semantic HTML;
- label pada form;
- keyboard navigation;
- accessible button;
- focus state;
- readable contrast;
- descriptive error.

shadcn/Radix membantu tetapi tidak menggantikan testing.

---

# 51. Responsive Requirement

Breakpoint minimal:

- mobile;
- tablet;
- desktop.

Core flow wajib dapat digunakan minimal pada:

```text
360px width
```

dan desktop umum.

---

# 52. Browser Support

Target:

- current Chrome;
- current Edge;
- current Firefox;
- modern Safari jika memungkinkan.

Internet Explorer tidak didukung.

---

# 53. Secrets Management

Dilarang commit:

```text
.env
.env.local
API keys
DB password
AUTH_SECRET
private certificate
```

`.gitignore` harus mencakup environment secrets.

---

# 54. `.dockerignore`

Minimum:

```text
node_modules
.next
.git
.env
.env.*
coverage
playwright-report
test-results
*.log
```

`.env.example` boleh masuk repository.

---

# 55. Next.js Configuration

Recommended:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

Security header dan image domain ditambahkan sesuai kebutuhan.

---

# 56. Data Source Abstraction

Jangan menulis:

```text
GoogleTrendsService
```

di seluruh domain code.

Gunakan interface seperti:

```text
TrendDataProvider
```

agar provider dapat diganti.

---

# 57. Repository Pattern

Example:

```text
OpportunityRepository
TrendRepository
UserRepository
RoadmapRepository
```

Service tidak mengetahui detail Sequelize query yang kompleks.

---

# 58. Scoring Engine

Scoring engine harus berupa pure/deterministic function sejauh memungkinkan.

Example:

```text
src/features/scoring/
├── opportunity-score.ts
├── entrepreneur-fit-score.ts
├── business-fit-score.ts
└── risk-assessment.ts
```

Keuntungan:

- mudah unit test;
- tidak tergantung AI;
- explainable;
- reproducible.

---

# 59. AI Must Not Calculate Core Score

Opportunity Score dan Fit Score **tidak boleh berasal dari prompt AI secara langsung**.

Correct:

```text
Structured Data
↓
Scoring Engine
↓
Score
↓
AI receives score
↓
AI explains score
```

Wrong:

```text
Prompt AI:
"Berikan score 0-100"
```

---

# 60. Roadmap Generation

Roadmap dapat menggunakan AI tetapi output harus melalui structured schema.

Flow:

```text
Profile
+
Opportunity
+
Score
+
Risk
+
Evidence
↓
AI Roadmap Generator
↓
Zod Validation
↓
Persistence
```

---

# 61. Prepared Dataset

Repository dapat memiliki:

```text
data/demo/
```

untuk demo seed.

Contoh:

```text
fnb-trends.json
opportunities.json
evidence.json
```

Namun application harus ingest ke database atau provider abstraction.

UI tidak boleh hardcode demo card langsung di component.

---

# 62. Development Environment

Recommended:

```text
Docker Compose:
- PostgreSQL

Next.js:
- local Node process
```

atau full Docker development.

Pilihan pertama lebih cepat untuk developer experience.

Production tetap containerized.

---

# 63. Local Development Workflow

```bash
git clone ...
cd venturex

corepack enable
pnpm install

cp .env.example .env.local

docker compose up -d postgres

pnpm db:migrate
pnpm db:seed

pnpm dev
```

---

# 64. Production Build Verification

Sebelum release:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker build .
```

Semua harus berhasil.

---

# 65. Security Dependency Update

Karena Next.js dan authentication library memiliki security patch berkala:

Release checklist wajib mencakup:

```text
check Next.js security release
check NextAuth/Auth.js advisory
check Node LTS patch
check PostgreSQL patch
pnpm audit / dependency scanner
```

Jangan upgrade major dependency satu jam sebelum demo tanpa regression test.

---

# 66. Next.js Security Baseline Note

Baseline dokumen:

```text
Next.js 16.3.6 Active LTS
```

Gunakan security-patched release terbaru saat final deploy.

Jangan downgrade ke unsupported Next.js version hanya karena tutorial lama.

---

# 67. Sequelize Stability Decision

Decision:

```text
Sequelize v6 stable
```

bukan:

```text
Sequelize v7 alpha
```

Tujuan:

- menghindari alpha API risk;
- dokumentasi lebih matang;
- lebih aman untuk timeline hackathon.

Migration ke v7 dapat dilakukan setelah v7 stable dan project selesai.

---

# 68. PostgreSQL Version Decision

Gunakan:

```text
PostgreSQL 18
```

Baseline patch:

```text
18.6
```

Gunakan latest supported patch dari major 18 saat deployment.

---

# 69. NextAuth Risk Decision

Karena requirement user menetapkan NextAuth:

```text
NextAuth v5 beta patched
```

digunakan dengan controlled risk.

Rules:

1. exact version pin;
2. security advisory monitoring;
3. test Login/Logout/Proxy;
4. no automatic beta upgrade;
5. prefer stable v5 jika tersedia sebelum production final.

---

# 70. Technical Decisions Not Yet Final

Item berikut perlu ditentukan sebelum final implementation:

1. exact AI provider;
2. AI model;
3. external F&B trend source;
4. final score weighting;
5. risk threshold;
6. cache revalidation interval;
7. deployment provider;
8. OAuth provider selain credential;
9. Redis requirement;
10. Sentry requirement;
11. exact PostgreSQL hosting;
12. exact CI deployment strategy.

Item ini **bukan blocker** untuk membuat application skeleton.

---

# 71. MVP Recommended Final Stack

Ringkasan stack utama:

```text
Frontend / Fullstack:
Next.js 16.3.x
App Router
React 19
TypeScript

Styling:
Tailwind CSS 4
shadcn/ui
Lucide React

Form:
React Hook Form
Zod

Backend:
Next.js Route Handlers
Server Actions where appropriate
Service Layer
Repository Pattern

Database:
PostgreSQL 18
Sequelize 6
pg

Authentication:
NextAuth.js/Auth.js v5 beta patched
Credentials Provider
JWT Session
Argon2id

AI:
AI Provider Abstraction
Vercel AI SDK recommended
Zod Structured Output

Visualization:
Recharts

Logging:
Pino

Testing:
Vitest
React Testing Library
Playwright

Containerization:
Docker
Docker Compose
Next.js standalone output

CI/CD:
GitHub Actions

Monitoring:
Structured Logs
Sentry optional

Package Manager:
pnpm
```

---

# 72. Mandatory Technology Rules

## MUST

- App Router.
- TypeScript strict.
- PostgreSQL.
- Sequelize v6 stable.
- migrations.
- server-side authorization.
- Zod validation.
- Docker production image.
- NextAuth authentication.
- password hashing.
- environment secrets.
- prepared data fallback.
- scoring outside AI.
- lint/typecheck/build before release.

---

# 73. Prohibited Practices

## MUST NOT

- use `pages/` router for new application route;
- put password in plain text;
- put API key in client code;
- commit `.env`;
- use Sequelize `sync({alter:true})` in production;
- query PostgreSQL directly from Client Component;
- calculate Opportunity Score solely via LLM;
- expose another user's roadmap/profile;
- use raw SQL string concatenation;
- trust frontend validation only;
- hardcode all demo output directly in UI;
- use unsupported/EOL runtime;
- deploy Next.js dev server as production server;
- run container as root if avoidable;
- use floating `latest` tag for critical production dependency without testing.

---

# 74. Architecture Quality Attributes

Stack harus mendukung:

## Maintainability

Layer separation.

## Security

Authentication + authorization + validation.

## Reliability

Fallback dataset + graceful AI failure.

## Explainability

Deterministic scoring.

## Portability

Docker.

## Scalability

Stateless web app where practical.

## Testability

Service/repository separation.

## Performance

Server Components + minimized client bundle.

---

# 75. Definition of Ready — Technical

Implementation dimulai jika:

- repository tersedia;
- Node version ditetapkan;
- package manager ditetapkan;
- env example tersedia;
- Docker PostgreSQL tersedia;
- database schema draft tersedia;
- auth strategy disetujui;
- folder convention disetujui;
- PRD/FSD requirement ID dapat dirujuk.

---

# 76. Definition of Done — Technical Feature

Feature selesai jika:

1. TypeScript compile.
2. ESLint pass.
3. validation tersedia.
4. authorization tersedia bila dibutuhkan.
5. service/repository separation sesuai.
6. test critical logic pass.
7. no secret exposure.
8. error handling tersedia.
9. responsive basic verified.
10. production build pass.
11. Docker build tidak rusak.
12. requirement PRD/FSD terpenuhi.

---

# 77. Release Checklist

```text
[ ] pnpm install --frozen-lockfile
[ ] lint pass
[ ] typecheck pass
[ ] unit test pass
[ ] E2E core flow pass
[ ] Next.js production build pass
[ ] Docker build pass
[ ] migration test pass
[ ] production env validated
[ ] AUTH_SECRET configured
[ ] database SSL/config verified
[ ] AI secret configured
[ ] prepared dataset available
[ ] auth authorization tested
[ ] security patches reviewed
[ ] health endpoint works
[ ] demo seed works
[ ] database backup available
```

---

# 78. Documentation Required in Repository

Repository wajib memiliki:

```text
README.md
.env.example
Dockerfile
compose.yaml
TECH_STACK_REQUIREMENT.md
docs/
```

Recommended docs:

```text
docs/
├── BRD.md
├── PRD.md
├── FSD.md
├── ERD.md
├── API.md
└── DEPLOYMENT.md
```

---

# 79. Final Technical Architecture

```text
┌─────────────────────────────────────────┐
│               BROWSER                   │
│ React / Tailwind / shadcn               │
└─────────────────┬───────────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────┐
│             NEXT.JS 16 APP              │
│                                         │
│ App Router                              │
│ Server Components                       │
│ Route Handlers                          │
│ Server Actions                          │
│ NextAuth                                │
│ Zod Validation                          │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Application Service Layer           │ │
│ └───────────────┬─────────────────────┘ │
│                 │                       │
│ ┌───────────────▼─────────────────────┐ │
│ │ Domain / Scoring / Risk Logic       │ │
│ └───────────────┬─────────────────────┘ │
│                 │                       │
│ ┌───────────────▼─────────────────────┐ │
│ │ Repository / Integration Layer      │ │
│ └───────┬────────────────┬────────────┘ │
└─────────┼────────────────┼──────────────┘
          │                │
          ▼                ▼
┌──────────────────┐  ┌──────────────────┐
│ PostgreSQL 18    │  │ AI / Trend APIs  │
│ Sequelize v6     │  │ External Sources │
└──────────────────┘  └──────────────────┘

Runtime:
Docker / Node.js 24 LTS
```

---

# 80. Final Stack Decision

Untuk VENTUREX MVP, stack resmi yang digunakan adalah:

> **Next.js 16 App Router + TypeScript + PostgreSQL 18 + Sequelize v6 + NextAuth.js + Tailwind CSS + Zod + Docker**, dengan modular architecture, AI provider abstraction, deterministic scoring engine, testing dengan Vitest/Playwright, dan production deployment menggunakan Next.js standalone Docker image.

Stack ini dipilih untuk menjaga keseimbangan antara:

- kecepatan development;
- kemampuan fullstack;
- maintainability;
- keamanan;
- testability;
- reproducibility;
- kesiapan live demo;
- kemampuan berkembang setelah hackathon.

---

# 81. Official Baseline References

Versi baseline dokumen diverifikasi terhadap dokumentasi resmi pada tanggal 26 September 2026:

- Next.js official documentation dan Next.js release/security announcements.
- Node.js official LTS releases.
- PostgreSQL official versioning policy.
- Sequelize official documentation.
- Auth.js / NextAuth repository dan security-patched releases.
- Docker official Next.js containerization guidance.

Versi patch harus diperiksa kembali sebelum final production deployment.

---

**END OF DOCUMENT**


## User journey exports (22 October 2026)

Server-side PDFKit 0.20 and ExcelJS 4.4 produce PDF/XLSX from validated owner-scoped snapshots. Noto Sans regular/bold is bundled under its OFL license for PDF text; Excel uses Arial with wrapping and print settings. Font assets are included in standalone tracing. No external rendering service or additional model call is required. See [Journey Reports](Journey%20Reports.md).
# Billing Sandbox amendment

The existing Next.js server runtime integrates Duitku POP sandbox through server-side `fetch`; no Duitku secret or authoritative amount reaches the client bundle. PostgreSQL/Sequelize transactions and row locks serialize credit reservation and callback settlement. Required server environment variables are `APP_URL`, `DUITKU_MERCHANT_CODE`, and `DUITKU_API_KEY`. Billing operators are persisted in PostgreSQL and verified through an `ADMIN` Auth.js session, not an email allowlist.
