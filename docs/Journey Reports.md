# Journey reports and device support

Authorized extension, 22 October 2026. Applies to both personas; complements BRD, PRD, FSD, Database Design and API Design.

## Completion contract

Users explicitly mark each private roadmap stage completed after carrying out its activities. Startup has six stages; Growth has five. Completion is user-declared, not verified business success. A saved roadmap alone never unlocks a report. Stages may be reopened. PDF and XLSX exports require an owner-scoped saved opportunity, valid analysis, matching immutable roadmap/analysis fingerprints and all stages completed. Existing analyses also require concept verification. Reports summarize one selected journey, not unrecorded page visits or every opportunity in the account. Compare is optional.

Progress is separate from immutable roadmap JSON. `journey_roadmap_progress`: opportunity FK, owner FK, roadmap fingerprint, stage ordinal, completed timestamp; composite primary key opportunity/fingerprint/stage. Mutations lock the owner-scoped opportunity row. Progress is never inferred for existing records. Fingerprints identify the entire roadmap snapshot, so a different roadmap cannot inherit completion. Reopening a stage relocks downloads. No financial projections or new AI calls are generated during export.

## API

- GET `/api/v1/reports/journeys?page=1`: paginated private roadmap choices with completion counts and availability.
- GET `/api/v1/reports/journeys/:id/progress`: current stages and completion state.
- PATCH same: `{ stage: 1..6, completed: boolean, fingerprint: string }`; authenticated, onboarded owner, same-origin, strict bounded input. Stale snapshots return 409.
- GET `/api/v1/reports/journeys/:id?format=pdf|xlsx`: gate rechecked server-side; 409 incomplete, 404 absent/foreign, 401 unauthenticated. Responses private/no-store.

Exports include role-specific profile context (current at export), selected historical trend evidence, concept, analysis, scores/coverage, uncertainty, risks, and completed roadmap. Completion timestamps are user declarations. No provider names, model identifiers, internal versions, fingerprints or record IDs appear in reports. PDFKit and ExcelJS generate downloads server-side. Tables wrap; report pages repeat a concise identity/footer; Excel sheets have explicit print settings. Colors follow DESIGN.md.

## Device support

In-app notifications remain available without push. Push uses secure-context feature detection, explicit user action and an active service worker. The first device-button click prepares the worker without prompting permission; a second explicit click subscribes from the user gesture (Safari activation requirement). Preparation is never triggered merely by opening the inbox. iOS/iPadOS 16.4+ requires installation to the Home Screen. Browser settings, OS notification settings, private browsing and network/push services can prevent delivery. Unsupported browsers receive a usable explanation and can use the inbox. Physical-device and actual Safari tests must remain NOT RUN until performed. Engine emulation is not physical-device coverage.

Physical acceptance: HTTPS deployment, iPhone/iPad Home Screen install, explicit allow, test notification with app foreground/background/closed, tap navigation, scheduled digest, revoke/reenable, logout/account switch; repeat on Android Chrome, Samsung Internet, desktop Chrome/Edge/Firefox/Safari. Validate PDF/XLSX downloads and long-text layout on each supported viewer.
