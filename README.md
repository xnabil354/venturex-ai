# VENTUREX AI

VENTUREX AI is an AI-assisted decision-support web application for Indonesia's Food & Beverage (F&B) entrepreneurs. It helps two user groups discover relevant market signals, assess business opportunities, understand the supporting evidence, and turn a selected opportunity into an actionable roadmap.

The product supports two journeys:

- **Prospective F&B entrepreneurs:** Discover → Analyze → Start
- **Existing F&B SMEs:** Discover → Analyze → Grow

VENTUREX provides decision support, not a guarantee of business success. Scores, signals, and AI explanations must be evaluated alongside real-world research.

## MVP scope

The current application covers the foundations for:

- registration, sign-in, session handling, and user-type onboarding;
- entrepreneur and existing-business profiles, including detailed location data;
- personalised dashboard and Trend Radar;
- opportunity discovery, detail, scoring, fit, risk, evidence, saving, and comparison;
- startup and growth roadmaps, journey completion, and PDF/XLSX reports;
- sandbox billing, AI credit entitlements, and bounded admin monitoring;
- weekly Food & Drink notifications with an in-app inbox and optional Web Push; and
- a curated F&B trend catalogue, with an auditable local review/publication workflow.

Some data and AI integrations are deliberately opt-in or local-demo only. See the relevant configuration and safety notes before enabling them.

## Technology

| Area | Stack |
| --- | --- |
| Web framework | Next.js App Router 16.3.6, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL 18, Sequelize 6, Umzug migrations |
| Authentication | NextAuth/Auth.js v5 beta |
| Validation | Zod 4 |
| AI and external data | AI SDK, 9Router, SearchApi, Bright Data |
| Background/output | Web Push, PDFKit, ExcelJS |
| Tests | Vitest, Testing Library, Playwright |
| Package manager | pnpm 10 |

## Prerequisites

- Node.js 24 (`>=24 <25`)
- Corepack and pnpm 10
- Docker with Docker Compose v2, for local PostgreSQL

## Local development

1. Enable Corepack and install dependencies:

   ```bash
   corepack enable
   corepack pnpm install
   ```

2. Create local environment configuration. Never commit this file or real credentials:

   ```bash
   cp .env.example .env
   ```

   Replace `AUTH_SECRET` with a locally generated secret. For a fresh database, also set a unique `ADMIN_BOOTSTRAP_PASSWORD` of at least 32 characters before migrations. It becomes the password for `adminventurex@gmail.com`; remove the variable after migrations. The remaining default database settings match `compose.yaml`.

   To change that admin password later, run `node --env-file=.env scripts/change-admin-password.mjs` in an interactive terminal. The script prompts twice without echoing the password and updates the existing admin account.

3. Start PostgreSQL:

   ```bash
   docker compose -f compose.yaml -f compose.dev.yaml up -d postgres
   ```

4. Apply schema migrations and seed reference data:

   ```bash
   corepack pnpm db:migrate
   corepack pnpm db:seed:reference
   ```

5. Run the application:

   ```bash
   corepack pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

To stop the local database without deleting its named volume:

```bash
docker compose -f compose.yaml -f compose.dev.yaml stop postgres
```

## VPS deployment with Docker Compose

The production Compose setup runs the app and PostgreSQL. It publishes the app only on `127.0.0.1:3000` by default for a host-installed Nginx reverse proxy; set `APP_PORT` if that port is already in use. PostgreSQL has no published port.

1. Copy `.env.production.example` to `.env.production` on the VPS. Set `APP_URL` to the HTTPS domain Nginx will serve; Compose also passes it to Auth.js as `AUTH_URL` so redirects use the public origin behind the proxy. Generate unique `AUTH_SECRET` and `POSTGRES_PASSWORD` values, and put the same database password in `DATABASE_URL`. The database host in that URL must remain `postgres`. For a fresh database, set a unique `ADMIN_BOOTSTRAP_PASSWORD` of at least 32 characters. Migration 024 uses it for the initial admin account `adminventurex@gmail.com`.
2. Build the production image, apply pending migrations, and seed reference data:

   ```bash
   docker compose --env-file .env.production build app
   docker compose --env-file .env.production --profile ops run --rm migrate
   docker compose --env-file .env.production --profile ops run --rm seed-reference
   ```

   After migration 024 succeeds, remove `ADMIN_BOOTSTRAP_PASSWORD` from `.env.production`. Then start the app:

   ```bash
   docker compose --env-file .env.production up -d app
   ```

   To change the admin password on this deployment after rebuilding the image, run `docker compose --env-file .env.production exec app node scripts/change-admin-password.mjs` from an interactive terminal. This uses the app container's configured `DATABASE_URL`; verify the deployment before entering the new password.

3. Check startup and health:

   ```bash
   docker compose --env-file .env.production ps
   docker compose --env-file .env.production logs --tail=100 app
   curl http://127.0.0.1:3000/api/health
   ```

The PostgreSQL data volume is named `venturex_postgres_data`. Back it up before applying migrations to a database that contains data. Do not run `docker compose down -v` unless you intend to delete that database volume.

The project requires Node 24. If dependencies were copied from another machine or built under a different Node major, reinstall them before starting the app. Native modules such as `argon2` must match the active runtime.

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run strict TypeScript checks |
| `pnpm test` | Run unit and component tests |
| `pnpm test:e2e` | Run browser end-to-end tests |
| `pnpm db:migrate:status` | Show migration status |
| `pnpm db:migrate:undo` | Revert the latest migration |
| `pnpm catalog:import` | Preview the curated-catalog import (read-only by default) |
| `pnpm catalog:lifecycle` | Review, validate, and publish curated catalogue records |
| `pnpm notifications:setup` | Generate ignored local Web Push keys |
| `pnpm notifications:worker` | Run the notification scheduler and push outbox worker |

## Curated trend catalogue

The repository includes a versioned candidate manifest at `data/catalog/curated-fnb-2025-candidates.v1.json`. Import preview is read-only:

```bash
pnpm catalog:import
```

Applying it writes to the local development database and requires explicit confirmations:

```bash
pnpm catalog:import -- --apply --confirm-db=venturex_dev --confirm-user=venturex
```

Do not run the apply command without separate Product Owner approval. Imported records begin as drafts; they do not become visible to users until they complete the local factual-review and publication workflow. See [the catalogue operations guide](scripts/catalog/README.md) for safeguards and lifecycle commands.

## Environment configuration

Copy `.env.example` rather than creating a configuration from scratch. It documents:

- application URL, session secret, and PostgreSQL connection settings;
- connection-pool settings;
- opt-in SearchApi Google Trends collection and display-rights controls; and
- SearchApi Trend Radar, weekly notification, and opportunity-evidence controls;
- sandbox Duitku and Web Push settings; and
- server-only 9Router AI-provider configuration, development HTTP restrictions, and isolated synthetic-demo controls.

Keep provider keys server-side. Public HTTP inference, live Trend inference, and live local demos are disabled by default for a reason; enable them only when their explicit confirmation flags and data-processing conditions have been satisfied.

## Project structure

```text
src/
  app/             Next.js routes, route handlers, and page states
  auth/            Authentication, session, and user-routing logic
  profile/         Entrepreneur and business-profile modules
  trend/           Trend domain, curation, projection, and provenance
  reference/       Shared category, segment, and channel reference data
  scoring/         Opportunity, fit, and risk scoring
  opportunity/     Catalog opportunities and private hypothesis workflows
  roadmap/         Startup/Growth roadmap generation and persistence
  billing/         Sandbox payments, entitlements, credits, and admin controls
  notifications/   Weekly digest inbox, Web Push, and worker logic
  reports/         Journey progress and PDF/XLSX exports
  ai-analysis/     AI analysis providers and guarded local demo
  catalog/         Curated-catalog import and lifecycle workflow
  components/      Product UI components
  db/              Sequelize connection, models, and repositories
db/migrations/     Versioned PostgreSQL migrations
data/catalog/      Versioned curated-catalog candidates
docs/              Product, functional, API, database, and operational specs
```

## Documentation

- [Documentation index](docs/README.md)
- [Current implementation snapshot](docs/Current%20Implementation.md)
- [Product requirements](docs/VENTUREX_AI_PRD.md)
- [Functional specification](docs/VENTUREX_AI_FSD.md)
- [Database design](docs/Database%20Design.md)
- [API design](docs/API%20Design.md)
- [Technical stack requirements](docs/Tech%20Stack%20Requirement.md)
- [Trend Intelligence configuration](docs/Trend%20Intelligence%20Configuration.md)
- [9Router provider configuration](docs/9Router%20Provider%20Configuration.md)
- [Billing sandbox](docs/Billing%20Sandbox%20MVP.md)
- [Weekly trend notifications](docs/Trend%20Notifications.md)
- [Journey reports](docs/Journey%20Reports.md)
- [Local synthetic AI demo](docs/Local%20Synthetic%20AI%20Demo.md)
- [Design system reference](DESIGN.md)

## Contributing notes

Before changing product behaviour, follow the PRD, FSD, database, API, and technical-stack documents above. Maintain the existing modular-monolith boundaries, keep TypeScript strict, and add appropriate loading, empty, error, and authorization handling for data-driven functionality.
