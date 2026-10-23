# VENTUREX Development Instructions

Before implementing any feature, read:
- DESIGN.md
- docs/PRD.md
- docs/FSD.md
- docs/Database Design.md
- docs/API Design.md
- docs/Tech Stack Requirement.md

UI implementation MUST follow DESIGN.md.

Do not invent features outside PRD/FSD.
Do not change database/API contracts without reviewing their source documents.

Technology baseline:
- Next.js App Router
- TypeScript strict
- PostgreSQL
- Sequelize
- NextAuth
- Tailwind CSS
- Docker

Design principles:
- Superhuman-inspired warm editorial software UI
- no generic AI gradients
- no excessive shadows
- no excessive dashboard charts
- clear information hierarchy
- responsive and accessible

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
