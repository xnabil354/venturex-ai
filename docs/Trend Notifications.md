# Daily trend notifications — approved extension, 22 October 2026

User-approved extension to BRD retention goals and Discover for both ENTREPRENEUR and UMKM_EXISTING. This document amends the BRD/PRD/FSD, Database Design and API Design by reference. No automated opportunity, analysis or roadmap generation.

## Product and functional contract

- NOTIF-001: opt-in daily in-app digest, one profile-selected topic, maximum three Top and three Rising queries. Preserve source meaning; searches are not sales or market-size claims. No generated substitute terms. Reject obvious unrelated harmful/adult query terms; do not claim comprehensive semantic moderation.
- NOTIF-002: configurable HH:mm and Asia/Jakarta, Asia/Makassar or Asia/Jayapura. Default 08:00 WIB and 24h; optional 7d or calendar month-to-date in the existing Radar observation timezone (Asia/Jakarta, first day through today); UI labels this Bulan ini (WIB). Indonesian national web searches. Source observation timezone remains the Radar contract, Asia/Jakarta; schedule timezone is independent.
- NOTIF-003: owner-only inbox, cursor pagination, unread indicator and explicit mark-read. Opening inbox does not fetch trends. Inbox refresh uses the shared header polling result and does not reset unsaved settings. Results retain query/window/retrieval snapshot.
- NOTIF-004: browser Web Push is an additional opt-in per device, with explicit permission action, secure-context/unsupported/denied feedback and disable action. In-app works independently. Browser/OS delivery is best effort. iOS requires a supported installed Home Screen web app.
- NOTIF-005: server worker, no browser timers for delivery. At most one digest per user/local date. A delayed worker catches up only for today's digest, not historical days, and waits if today's configured clock is still in the future. Settings save schedules the next future occurrence; timezone/topic changes never rewrite existing digests. Changed/removed profile selections pause delivery until settings are saved again.
- NOTIF-006: source failures retry at most three times with five-minute spacing; then advance to next day. Empty usable data creates no fake trend notification and records a neutral status. Push uses a durable outbox, three attempts, expires after one day, deletes invalid 404/410 endpoints. A crash after remote acceptance can cause redelivery; stable notification tags replace duplicates. Exactly-once remote delivery is not claimed.
- NOTIF-007: short source-independent UI; warm parchment/paper cards, wine CTA, lilac focus, >=44px controls, single-column mobile layout. No provider/model/version labels.

## Persistence and API

Migration 021 adds notification_preferences (user PK/FK, settings, query snapshot, next_run_at, attempts/status), trend_notifications (UUID, owner FK, unique owner/day, immutable digest JSONB (topic selector, topic text, data window, retrieval time, bounded rows), read_at), push_subscriptions (unique endpoint, owner FK, bounded keys, last_test_at) and notification_push_deliveries (unique notification/subscription, state, attempts/next_attempt_at). All owner references cascade on delete. Due/unread indexes support workers/inbox. Raw SQL is parameterized through Sequelize; job claims use transactional FOR UPDATE SKIP LOCKED. No existing business tables are repurposed.

Authenticated, completed-user, private/no-store APIs for both personas:
- GET/PATCH /api/v1/notifications/preferences: read state/options; strict complete settings on PATCH, server resolves and snapshots profile topic.
- GET /api/v1/notifications?before=<UUID>: 20 records, compound created_at/id cursor, unread count and authenticated userId for client account-isolation checks. A changed account reloads the private UI rather than merging another account's inbox.
- PATCH /api/v1/notifications: strict {id: UUID}, owner-scoped mark-read.
- POST/DELETE /api/v1/notifications/push: validated subscription registration/removal for current owner. DELETE accepts endpoint. POST accepts browser subscription.
- POST /api/v1/notifications/push/test: explicit current-device generic test with per-subscription 60-second cooldown.
- GET /api/v1/notifications/push/context: current owner identifier for service-worker account isolation.

Mutations require same-origin and bounded bodies. Endpoints accept only known HTTPS push-service hosts to avoid arbitrary outbound URLs. Private subscription keys are never listed. Workers validate onboarding/persona and current topic before fetching data. Logout revokes current-device subscription before signing out; queued push checks current session owner before showing.

## Operations and acceptance

`pnpm notifications:setup` generates local VAPID keys into ignored `.notifications-vapid.json` without printing secrets. Configure VAPID subject as a contact mailto or public HTTPS URL for deployment. `pnpm notifications:worker` loads .env and optional ignored `.notifications-vapid.json`, polls each minute and exits on SIGINT/SIGTERM. `pnpm dev` and `pnpm start` launch both Next and the worker and stop both on shutdown. Deployments that invoke Next directly or use standalone output must supervise `pnpm notifications:worker` separately with source files/runtime dependencies and the same database/key configuration. A dedicated PostgreSQL advisory lease elects one scheduler per database; additional workers stay on standby. Shared provider deduplication remains process-local and is not preserved across leader restarts.

Verify schedule boundaries in all three zones, monthly date boundaries, unique daily publication, simultaneous worker claims, source empty/failure, profile drift, pagination/ownership, denied/unsupported push, invalid endpoints, outbox retry, logout and responsive UI. Live push requires browser permission and network reachability to its push service; report unverified OS delivery honestly.


Implementation references: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [Push subscription API](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe), [web-push](https://github.com/web-push-libs/web-push).
