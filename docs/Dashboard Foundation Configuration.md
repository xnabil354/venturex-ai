# Dashboard Foundation Configuration

Status: Frozen MVP configuration
Scope: Dashboard Foundation only

This document is the implementation source of truth for the VENTUREX Dashboard Foundation. Product intent remains in `docs/VENTUREX_AI_PRD.md` and `docs/VENTUREX_AI_FSD.md`. This document resolves only the Dashboard Foundation decisions listed below.

## 1. Access and route guard

The Dashboard has one protected route: `/dashboard`.

The server-side access rules are:

```text
guest
-> /login

authenticated + userType = null
-> /onboarding

ENTREPRENEUR + incomplete onboarding
-> /onboarding/entrepreneur

UMKM_EXISTING + incomplete onboarding
-> /onboarding/business

onboardingStatus = COMPLETED
-> /dashboard
```

Incomplete users do not enter the Dashboard in the MVP. Onboarding owns profile completion. The Dashboard must not fabricate completion percentages or progress scores.

## 2. Role-aware rendering

`/dashboard` is rendered server-side and selects its composition from the database-backed current user's `userType`.

```text
ENTREPRENEUR
-> Entrepreneur Dashboard

UMKM_EXISTING
-> UMKM Dashboard

null or incomplete
-> existing onboarding destination
```

Do not create `/dashboard/entrepreneur` or `/dashboard/umkm` without a new requirement.

## 3. Data access architecture

The Dashboard Foundation uses this server-side flow:

```text
Dashboard Server Component
-> getCurrentUser()
-> DashboardQueryService
-> role-specific profile repository
-> reference repositories
-> safe Dashboard DTO
```

The Foundation does not add `GET /api/v1/profile` or `GET /api/v1/dashboard`. It does not expand `GET /api/v1/me` into a Dashboard aggregation endpoint. A public profile read API may be decided later when Profile Edit requires a client contract.

The Dashboard must not make an internal HTTP request to its own API routes merely to read server-side data.

## 4. Foundation scope

The Dashboard Foundation includes:

- protected role-aware Dashboard rendering;
- real current profile or business summary;
- truthful persisted profile status;
- role-specific composition;
- honest unavailable states;
- cleanup of navigation to unavailable destinations;
- responsive and accessible structure;
- loading and controlled error states.

The Foundation does not include:

- Trend ingestion or Trend Radar;
- Opportunity engine;
- Opportunity Score, Fit Score, or Risk;
- recommendation ranking;
- AI analysis;
- Saved Opportunity persistence;
- Startup Roadmap;
- Growth Roadmap;
- Profile Edit;
- Change User Type;
- fabricated metrics, charts, or intelligence content.

## 5. Module state semantics

Every future Dashboard module uses one of these meanings:

- `AVAILABLE`: the runtime capability exists and the request returned data;
- `EMPTY`: the runtime capability exists, the request succeeded, and no records exist;
- `UNAVAILABLE`: the runtime capability has not been implemented;
- `ERROR`: the runtime capability exists but failed to load.

These states must not be conflated. An unimplemented module is not an empty module.

## 6. Current module availability

At the time this configuration is frozen, the following modules are `UNAVAILABLE`:

| Module | State |
|---|---|
| Trends | `UNAVAILABLE` |
| Opportunities | `UNAVAILABLE` |
| Saved Opportunities | `UNAVAILABLE` |
| Roadmap | `UNAVAILABLE` |

No request should be made to an unavailable module. No loading state should pretend that an unavailable module is being fetched.

## 7. Unavailable section presentation

The required future Dashboard sections remain visible as restrained `UNAVAILABLE` sections so the information architecture remains traceable to the PRD and FSD.

Each unavailable section may contain only:

1. section title;
2. short `Belum tersedia` status;
3. one factual explanatory sentence.

Unavailable sections must not contain:

- fake cards;
- permanent skeletons;
- fake charts;
- score placeholders;
- large illustrations;
- false timing commitments;
- CTA links to unusable features.

Copy must be calm and must not promise a release date.

## 8. Entrepreneur Dashboard composition

The Entrepreneur Dashboard contains, in order:

1. page context;
2. qualitative profile status;
3. Entrepreneur summary;
4. Opportunities unavailable section;
5. Trends unavailable section;
6. Saved Opportunities unavailable section;
7. Startup Roadmap unavailable section.

The real summary prioritizes:

- location;
- budget range;
- experience level;
- time commitment;
- selected F&B interests;
- selected customer segments;
- selected sales channels;
- preferred product type when available.

`businessObjective` and `notes` remain persisted fields but are not primary Dashboard summary fields.

## 9. Entrepreneur profile status

Because only completed users can access `/dashboard`, the Dashboard uses a qualitative state such as `Profil siap`.

The Dashboard must not create:

- `100%` or `90%` completion values;
- progress bars;
- completion scores;
- an invented completion formula.

## 10. UMKM Dashboard composition

The UMKM Dashboard contains, in order:

1. page context;
2. business summary;
3. Relevant Trends unavailable section;
4. Growth Opportunities unavailable section;
5. Saved Opportunities unavailable section;
6. Growth Roadmap unavailable section.

The real summary prioritizes:

- business name;
- business category name;
- location;
- average price range;
- current product count;
- customer segments;
- sales channels.

Do not display revenue, sales, transactions, inventory, growth percentage, or business health score without a real runtime source.

## 11. Product summary

The primary UMKM summary displays product count only.

The Dashboard does not load or display full product names for the primary summary. This keeps the query bounded, prevents a profile dump, and avoids inventing a top-product ranking that does not exist yet.

Product detail may be added later in a profile or product feature with its own requirement.

## 12. Business description

`businessDescription` remains relevant for future personalization, but is not displayed in the primary Dashboard summary.

The Dashboard should not turn the summary into a long profile narrative.

## 13. Greeting and context

The current user model does not contain a first or full name.

The Dashboard must not infer a name from an email address and must not use the email as a hero heading.

Approved context direction:

```text
Entrepreneur:
Selamat datang kembali
Ringkasan profil calon pengusaha Anda

UMKM:
Selamat datang kembali
Ringkasan bisnis {businessName}
```

`businessName` must come from the persisted Business Profile. Minor copy refinement is allowed if the meaning remains unchanged and the copy remains factual.

## 14. Inconsistent completed state

If `onboarding_status = COMPLETED` but the role-appropriate profile record cannot be found, the Dashboard renders a controlled profile error.

The application must not:

- fabricate a profile;
- auto-create a profile;
- silently change onboarding status;
- redirect to onboarding automatically;
- expose database or ORM errors.

The error should explain that profile data could not be loaded and offer a safe retry or reload action.

This is an inconsistent persisted state, not a normal empty state.

## 15. Safe Dashboard DTO

The Dashboard uses a role-aware safe DTO.

### Entrepreneur shape

```text
userType
onboardingStatus
profile:
  location
  budget { min, max }
  experienceLevel
  timeCommitment
  preferredProductType, optional
  interests: presentation labels
  customerSegments: presentation labels
  salesChannels: presentation labels
modules:
  trends
  opportunities
  savedOpportunities
  roadmap
```

### UMKM shape

```text
userType
onboardingStatus
profile:
  businessName
  businessCategory: presentation label
  location
  averagePrice { min, max }
  productCount
  customerSegments: presentation labels
  salesChannels: presentation labels
modules:
  trends
  opportunities
  savedOpportunities
  roadmap
```

The DTO must not expose:

- `passwordHash`;
- session secrets;
- raw Sequelize models;
- transaction metadata;
- internal junction IDs;
- `notes` as Dashboard data;
- raw ownership IDs unless an implemented interaction genuinely requires them.

## 16. Reference labels

Dashboard presentation must not use raw reference UUIDs.

The server maps F&B categories, customer segments, and sales channels to safe presentation values such as:

```text
{ code, name }
```

or an equivalent minimal label DTO. Ordering must be deterministic.

## 17. Future navigation policy

Primary navigation must not advertise routes whose runtime capability is not usable.

Until the corresponding feature is implemented, hide these primary navigation items:

- Trends;
- Opportunities;
- Saved;
- Roadmaps;
- Profile, when it remains only a placeholder.

Dashboard remains the primary usable destination. Do not replace hidden destinations with disabled anchors, dead links, or a feature-flag platform. Re-enable each item through a normal code change when its capability is ready.

## 18. Dashboard CTA policy

Unavailable sections have no CTA.

Do not add `Lihat Tren`, `Cari Peluang`, `Buka Roadmap`, or equivalent actions while their target route or runtime capability is unavailable.

A CTA may be added only when the destination is real, accessible, and backed by a usable capability.

## 19. Feature availability implementation

Do not create a generic feature-flag platform for the Dashboard Foundation.

Known application capability may be represented directly in the Dashboard DTO, for example:

```text
modules.trends.status = "UNAVAILABLE"
```

Do not add database configuration, an admin feature manager, remote flags, or environment flags without a separate requirement.

## 20. Visual hierarchy

The Dashboard visual order is:

```text
page title and context
-> concise real profile or business summary
-> required intelligence sections
-> restrained unavailable presentation
```

The Dashboard is not a generic admin dashboard. Do not create:

- four KPI cards;
- chart grids;
- bento dashboard layouts;
- oversized welcome heroes;
- excessive metric tiles.

The visual language remains:

- warm parchment canvas;
- paper-white functional surfaces;
- ink charcoal typography;
- midnight wine primary action;
- royal violet for focus and links;
- lilac mist for restrained emphasis;
- subtle borders;
- minimal shadow;
- compact editorial spacing.

Declared design dials: `ENERGY 1 / RHYTHM 2 / MOTION 1`.

## 21. Component architecture

The conceptual component structure is intentionally small:

```text
DashboardPage
├── DashboardContextHeader
├── EntrepreneurDashboard
│   └── EntrepreneurSummary
└── BusinessDashboard
    └── BusinessSummary
```

A small shared `DashboardModuleState` component, or equivalent, may present module availability states.

Reuse existing:

- `AppPage`;
- `PageContainer`;
- `EmptyState` primitives;
- existing design tokens.

Do not create a dashboard widget registry, generic card engine, plugin architecture, or premature abstraction.

## 22. Responsive behavior

Responsive behavior is fixed as follows:

- `375px`: single-column layout;
- `768px`: restrained two-column summary only where it improves scanning;
- `1280px`: use the existing `PageContainer` max-width.

Unavailable modules do not need to become a bento grid. The layout must not introduce horizontal scrolling, clipped text, or desktop-only interaction patterns.

## 23. Accessibility

The Dashboard must maintain:

- existing `<main>` ownership from the Application Shell;
- one appropriate `<h1>`;
- semantic section headings;
- real navigation links only;
- visible focus states;
- keyboard navigation;
- unavailable and error copy that is not color-only;
- reduced-motion compatibility;
- no disabled-link keyboard trap.

Skeletons are allowed only for genuine asynchronous loading.

## 24. Loading and error behavior

Profile summary is critical Dashboard data.

If the profile query fails, render a controlled page error with a safe retry or reload action.

Future unavailable modules do not use loading states. Once a capability is implemented, its load error may be isolated from the profile summary so one non-critical widget does not break the entire page.

Do not expose SQL, Sequelize errors, stack traces, or internal request details.

## 25. Performance

The Dashboard query layer must:

- select only summary fields;
- scope ownership by the current authenticated `userId`;
- avoid N+1 reference lookup;
- batch or map reference labels;
- use product `COUNT` rather than loading the complete product collection for the primary summary;
- use deterministic ordering;
- skip requests to unavailable modules;
- avoid premature caching.

Caching may be considered later only with clear invalidation semantics based on profile changes or `profileVersion`.

## 26. Security boundary

Dashboard data is always scoped to the authenticated current user.

The selected profile is determined from the database-backed current user's `userType`. The client must not provide authoritative `userId`, `profileId`, or `userType` values.

The server-side guard remains the authority for access. The Dashboard must not rely on client-only redirect, hidden navigation, or client state for authorization.

Cross-user and cross-role profile leakage is prohibited. Raw Sequelize objects must never be passed to the client.

## 27. Testing expectations

The eventual Dashboard implementation must test:

- completed Entrepreneur user renders Entrepreneur Dashboard;
- completed UMKM user renders UMKM Dashboard;
- guest is redirected to `/login`;
- incomplete users are redirected to the correct onboarding destination;
- real summary data maps correctly;
- reference IDs map to safe labels;
- cross-role and cross-user reads are rejected;
- completed user with missing profile receives controlled error;
- unavailable modules are rendered honestly;
- no fabricated intelligence content exists;
- unavailable navigation destinations are hidden;
- 375px, 768px, and 1280px responsive behavior;
- keyboard and focus accessibility.

Avoid low-value snapshot tests that only increase test count.

## 28. Remaining open decisions

This configuration does not resolve:

- Trend taxonomy;
- Google Trends or Bright Data implementation;
- Trend scoring;
- Opportunity type taxonomy;
- Opportunity Score weights;
- Fit Score weights;
- Risk thresholds;
- recommendation ranking;
- AI provider or prompts;
- Saved Opportunity behavior;
- Startup Roadmap behavior;
- Growth Roadmap behavior;
- Profile Edit UX;
- Change User Type;
- future feature availability after those modules are implemented.

These require separate product and technical decisions.

## 29. Implementation boundary

This freeze is documentation-only. It does not add or authorize:

- source changes;
- migrations;
- models;
- repositories;
- services;
- route handlers;
- runtime APIs;
- UI components;
- tests;
- seeds;
- package dependencies;
- fake, mock, or fabricated intelligence data.