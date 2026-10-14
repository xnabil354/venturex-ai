# Trend Intelligence Configuration

**Status:** Approved product, domain, and MVP architecture configuration
**Scope:** Trend Intelligence only
Date: 2026-10-05

This document is the source of truth for Trend Intelligence product and domain decisions. It complements the product requirements in `docs/VENTUREX_AI_PRD.md` and `docs/VENTUREX_AI_FSD.md`. The database and API documents define their separate contracts and must follow the decisions recorded here.

The Dashboard Foundation remains unchanged. The current Trend backend is an internal foundation only; end-user Trend modules remain `UNAVAILABLE` until the product capability is released. This reconciliation changes documentation only.

## Approved User-Facing v1 Contract

**Status:** Approved contract; runtime implementation pending.
**Release slice:** `TREND LIST ONLY`.

The first user-facing Trend surface is a dedicated authenticated, server-rendered `/trends` route, not Trend cards embedded in the Dashboard. Its read path is `Server Component -> TrendService -> TrendRepository -> PostgreSQL` (`DIRECT_SERVER_SERVICE`); no Trend HTTP API is approved. The route requires an authenticated user with completed onboarding, and the server resolves the persisted current user and `userType`. Clients must not supply authoritative `userId`, `userType`, or `affectedUserType` values.

Eligibility remains persisted current-user `userType` + `PUBLISHED` + `affectedUserTypes`. This is audience eligibility, not profile personalization. The internal `TrendDto` may be mapped to a server-side display projection but is not a public API DTO. The list may display title, Trend category, optional F&B subject area, signal summary, supported direction, observation period when known, evidence source name, source date when known, material evidence limitations, general curated `businessRelevanceExplanation` labeled **Konteks relevansi bisnis**, and catalog `updatedAt` only as **Katalog diperbarui**. A missing source date may be stated as **Tanggal sumber tidak dicantumkan**; it must not be invented. Direction may remain absent for non-user-visible catalog records when evidence does not establish one; every user-visible Trend must have a supported non-null direction. If an eligible published record violates this contract, the implementation must fail closed with a controlled error rather than inventing a direction. No database nullability change is approved.

Source Type is excluded from Trend List v1 because current Trend evidence persistence and the internal `TrendDto` provide no approved structured source-type field or mapping. Do not infer Source Type from `sourceName`, `sourceReference`, URL/domain, `supportingDetail`, Trend category, F&B subject area, or other evidence metadata. A future structured Source Type requires separately approved semantics/taxonomy, authoritative mapping/input, persistence contract if needed, and DTO/display mapping.

Default order is `createdAt DESC`, then `id ASC`. This is deterministic catalog ordering, not market freshness, trend strength, profile relevance, or recommendation ranking. No freshness score, badge, threshold, or real-time claim is part of v1. The list shows only real curated persisted records; it must not seed fake Trends or evidence.

State semantics are distinct: `AVAILABLE` means released capability, successful query, and one or more eligible display-valid records; `EMPTY` means released capability, successful query, and zero eligible published records; `ERROR` means query or required display-contract failure; `UNAVAILABLE` means the user-facing capability is not yet released. Recommended empty copy: **Belum ada tren F&B terkurasi yang dipublikasikan untuk jenis pengguna ini.** Errors must not be presented as empty, and raw database errors must not be exposed.

Trend Detail and related-Opportunity openability are deferred from this first slice. `PRD-TREND-004` and `FSD-TREND-003` remain target requirements, not completed or optional requirements. Opportunity relationship capability is unavailable, not an empty relationship result; the existing empty-related-Opportunity copy applies only after an implemented relationship query succeeds with zero results. No Trend-to-Opportunity generation is included.

Delivery sequence is `/trends` List implementation, then separately scoped Dashboard Trend availability integration. Dashboard Configuration remains unchanged in this freeze, and Dashboard Trends remain `UNAVAILABLE` until runtime implementation and integration. Dashboard copy/state, any CTA, and navigation must be truthful before Trend v1 is declared release-complete. Do not expose a Trend navigation destination before `/trends` is usable.

These approved decisions do not describe current runtime availability: the Trend backend remains an internal foundation, `/trends` remains a placeholder, and Dashboard Trends remain `UNAVAILABLE` until the later implementation and integration work succeeds.

### Observation Period Display

Render the observation period from its persisted `periodStart` and `periodEnd` values using clear Indonesian date presentation:

| Observation period data | Approved UI presentation |
|---|---|
| Start and end available | `Periode observasi: 1 Jan – 31 Mar 2026` |
| Start available, end missing | `Awal observasi: 1 Jan 2026 · Akhir belum tersedia` |
| End available, start missing | `Akhir observasi: 31 Mar 2026 · Awal belum tersedia` |
| Start and end both missing | `Periode observasi belum tersedia` |

The dates above are illustrative formatting examples only. Render actual persisted period values when available; do not create synthetic observation dates.

Apply these semantics:

1. An absent end date does not mean that a trend is ongoing or currently active.
2. An absent start date does not mean that the evidence or Trend is recent.
3. Do not fabricate, estimate, or silently replace missing dates.
4. Period completeness does not create a freshness score, badge, threshold, or market-recency claim.
5. `observationPeriod` is distinct from `evidence.sourceDate`.
6. `Trend.updatedAt` is the catalog-record update time, not market freshness. If displayed, label it **Katalog diperbarui**.
7. These presentation rules do not change Trend eligibility, direction validation, publication state, or persistence.

## 1. Product Definition

VENTUREX Trend Intelligence helps F&B entrepreneurs and existing F&B businesses notice meaningful, evidence-backed changes in consumer behavior, products, channels, operations, and the market. It organizes observed F&B signals into a clear account of **what has been observed**, what evidence supports it, and why it may matter in the user's business context. This product definition does not select how evidence is collected or processed.

This product definition describes the released experience. The current backend foundation filters `PUBLISHED` Trends by the authenticated user's persisted `userType` and each Trend's `affectedUserTypes`; its `businessRelevanceExplanation` is general and curated, and the service does not load profile data.

It supports, but does not make, business decisions. The two user paths use different context:

The profile fields below describe future profile-aware context; the approved user-facing v1 does not evaluate them.

- **Entrepreneur (`ENTREPRENEUR`):** interests, location, budget range, experience, time commitment, preferred customer segments, sales channels, and preferred product type when provided.
- **Existing business (`UMKM_EXISTING`):** business category, location, current products, average price range, customer segments, and sales channels.

Trend Intelligence is not:

- a generic news feed; an item must represent a relevant F&B signal, not merely a recent article;
- social media monitoring; any future social signal must be public and aggregate, not surveillance of individuals or private communities;
- content recommendation; ranking or relevance does not turn a trend into a suggested post, menu, or campaign;
- an AI-generated insight without evidence; every published trend must be grounded in traceable source material.

## 2. MVP Scope

The broader Trend Intelligence product target retains these capabilities beyond the approved first user-facing list slice:

- discovery of validated, published F&B trends;
- classification using the frozen taxonomy in Section 3;
- a concise, factual trend presentation; a Trend shown in the approved List v1 must have a supported direction, while its observation period may be absent when unknown;
- useful source and freshness context sufficient to understand evidence and its limits; List v1 shows source dates when known and keeps them distinct from catalog timestamps, while derived freshness classification is deferred;
- profile-aware relevance using the current user's role-appropriate profile context; List v1 uses only general curated relevance and audience eligibility, not profile matching or ranking.

The MVP does not include:

- autonomous AI decisions or automatic business actions;
- guaranteed predictions or claims that a trend will continue;
- unsupported financial forecasting, market-size claims, or growth percentages;
- invented metrics, fake confidence scores, or numeric relevance values without an approved method and traceable inputs;
- trend-to-opportunity generation, opportunity scoring, risk scoring, or roadmap generation;
- a provider commitment, real-time promise, or claim that a source is available before it has been verified.

When reliable trend data is unavailable, the experience must say that the capability or data is unavailable. It must not substitute fabricated or illustrative trends.

## 3. F&B Trend Taxonomy

Each trend has exactly one primary trend category in the MVP. The trend category describes **the kind of change**; it is distinct from an F&B category such as Beverage or Bakery, which describes **the subject area** of the trend. A trend may be associated with an F&B subject area only when the evidence supports that association.

| Code | Name | Description |
|---|---|---|
| `CONSUMER_BEHAVIOR` | Consumer Behavior | Changes in consumer preferences, occasions, purchasing habits, or consumption patterns relevant to F&B. |
| `PRODUCT_MENU` | Product & Menu | Changes in food or beverage products, ingredients, flavors, formats, packaging, or menu patterns. |
| `CHANNEL_DISTRIBUTION` | Channel & Distribution | Changes in how F&B products are discovered, ordered, sold, delivered, or distributed. |
| `TECHNOLOGY_ADOPTION` | Technology Adoption | Adoption of technology in F&B customer or operator workflows when it changes how the business serves or reaches customers. |
| `OPERATIONAL_PATTERN` | Operational Pattern | Observable changes in sourcing, preparation, service, labor, waste, or operating practices in F&B. |
| `MARKET_MOVEMENT` | Market Movement | Evidence-backed changes in F&B supply, prices, competition, or market structure; not an unsupported market-size estimate. |

Do not create additional categories or multi-category tagging for the MVP. Revisit the taxonomy only through a reviewed product change when real trend data demonstrates a need.

## 4. Conceptual Trend Entity

This is a domain model, not a database schema. It describes the minimum meaning of a Trend:

| Concept | Meaning |
|---|---|
| Identity | A stable system identity for referring to one trend over its lifecycle. It is not an opportunity identity. |
| Trend signal | A normalized, factual statement of the observed change. Its title, summary, and description describe the signal, not its source material or a user-specific interpretation. |
| Trend category | One primary code from Section 3, describing the kind of change. |
| F&B subject area | The affected F&B category or scope, kept separate from trend category and included only when supported by evidence. |
| Direction and period | `RISING`, `STABLE`, or `DECLINING` over an identified observation period when the source supports that interpretation. Direction describes observed data; it is not a forecast. |
| Evidence | A separate record with an identifiable source, traceable reference, supporting detail, source date when known, and limitations where relevant. It supports the signal; it is not the signal or a generated relevance interpretation. The MVP does not require retaining a raw provider payload. |
| Business relevance explanation | A general, curated explanation of why the signal may matter to the selected audience. It is not evidence, an observed market fact, a profile-personalized explanation, an opportunity recommendation, or a guaranteed fit. |
| Profile-contextual relevance | A separate future explanation derived from the authenticated user's persisted profile. Do not present the general business relevance explanation as personally tailored when no profile context was evaluated. |
| Affected user types | One or both of `ENTREPRENEUR` and `UMKM_EXISTING`, selected only when the trend is suitable for that audience. This controls audience eligibility, not authorization. |
| Lifecycle state | One of `DRAFT`, `VALIDATED`, `PUBLISHED`, or `ARCHIVED`, as defined in Section 7. |

Do not treat an external source's index, count, or percentage as a VENTUREX metric without preserving its original meaning, unit, period, and provenance. No database columns, keys, constraints, or migration are specified here.

## 5. Data Source Strategy

### MVP Data Architecture Decision

The user-facing Hackathon Trend MVP continues to use an **Internal Persistent Curated Trend Catalog**. It does not consume externally collected candidates in the published Trend catalog or Trend List; the optional candidate-collection extension below is not a dependency of that user-facing path.

#### Approved Bright Data candidate-collection extension (Batch v1)

The explicitly approved integration batch allows a server-only adapter to collect Google Trends Trending Now candidates for Indonesia through the Bright Data zone venturex_trends_serp. A deterministic keyword screener classifies each candidate as LIKELY_FNB, REVIEW_REQUIRED, or OUT_OF_SCOPE. This is ephemeral candidate triage only.

The adapter is disabled by default. It reads BRIGHTDATA_TRENDS_ENABLED (true or false, default false), BRIGHTDATA_TRENDS_API_KEY (server-only and required only when enabled), and BRIGHTDATA_TRENDS_TIMEOUT_MS (default 10000; allowed range 250-30000). The zone, provider endpoint, and Google Trends target are fixed by this approved integration. The key must never use a NEXT_PUBLIC variable or appear in logs.

The provider observations retain their original query, region, source metrics, related-query and category data, start time in Unix seconds, and provenance. The adapter retrieval timestamp is collection metadata; it is not the source date, catalog update time, or a freshness measure. Screening explanations state the matched terms or ambiguity. These outputs do not create a Trend record or lifecycle state, assign a Trend taxonomy category, verify evidence, or establish a factual market claim. A Data Curator must independently review the source and decide whether to create a DRAFT record.

The adapter validates the response structure against the observed fields, and the keyword screener performs candidate triage only. Neither step validates whether source evidence supports a factual market claim. Factual evidence validation remains a separate human responsibility. The batch uses only mocked HTTP and synthetic fixtures; it makes no live provider requests and adds no scheduler, retry, polling, persistence, factual validation, or publication behavior.

```text
Real-world source / evidence
            ↓
Human curation and factual review
            ↓
Internal persistence
            ↓
Trend lifecycle
            ↓
Published Trend Service
            ↓
Safe typed DTO
            ↓
Future user interface
```

Curators may use real external sources as evidence, but they add and review catalog records through a trusted human process. The Bright Data candidate collector remains separate from the catalog and does not create DRAFT records. The published catalog remains independent of any provider. Internal persistence does not authorize synthetic market data: fabricated trends, sources, or claims must never be published.

### Internal context

Persisted profile data may support future profile-aware relevance:

- the authenticated user's type and the corresponding entrepreneur or business profile;
- profile preferences and F&B context listed in Section 1.

Internal profile data is not evidence that a market trend exists. It must not be sent to an external provider unless that use is separately reviewed and approved. The current Trend service does not load either profile type; its role filtering is audience eligibility only.

### External evidence

Evidence may come from aggregated search-trend data, public market signals, published industry reports, and public aggregate social signals. These are source classes for human curation. The approved Bright Data collector is limited to candidate collection from Google Trends Trending Now for Indonesia; it does not establish broader provider coverage, reliability, licensing, or production availability. Candidate observations still require independent source review before they can support a Trend.

### Evidence quality gate

Before a Trend can move from `DRAFT` to `VALIDATED`, its record must contain at least one evidence item with an identifiable source, a traceable reference, and supporting detail that explains how the source supports the signal. A designated human reviewer must confirm that the source exists and actually supports the claim, direction, and period. A populated field or syntactically valid URL is structural validation, not factual verification.

When evidence is undated or uncertain, the reviewer must state that explicitly in its supporting detail or limitations. The record must describe material limitations. No freshness threshold, approved-provider list, or confidence percentage is defined by this configuration.

Source rules:

- a published trend must be traceable to evidence that supports its description, direction, and period;
- distinguish `LIVE`, `CACHED`, and `PREPARED` only in future/general provider-backed workflows where applicable; these modes are not persisted by the current Trend foundation, and cached or prepared data must not be described as real-time;
- show `source_date` in approved List v1 when known and state when it is not supplied; keep it distinct from catalog timestamps. Derived source freshness remains future behavior, with no approved threshold or provider retrieval timestamp in the current foundation;
- do not ingest private social content, monitor individuals, or expose personal data as market evidence;
- if a source is unavailable or its evidence is insufficient, do not publish a trend based on an assumption.

## 6. AI Boundary

AI may assist with:

- summarizing supplied source material;
- suggesting a taxonomy category for human review;
- drafting a relevance explanation from verified evidence and the minimum necessary business context.

AI is not a source of truth and may not:

- invent a trend, source, evidence, market fact, statistic, or causal relationship;
- claim a prediction is certain or fabricate a growth rate, market size, confidence value, or relevance score;
- publish or validate a trend without the required evidence review;
- make or execute a business decision on behalf of a user.

If evidence is missing, stale, conflicting, or insufficient, the result must state the limitation or remain unpublished. Any future AI-generated factual claim must be traceable to its supporting evidence.

## 7. Trend Lifecycle and Ownership

Only `PUBLISHED` trends are available for user discovery. The lifecycle has exactly four states; the Data Curator creates a `DRAFT` record only after manual review of a candidate. Provider collection and screening results are pre-lifecycle and do not create a lifecycle record. AI and automated processing cannot advance a lifecycle state.

| State | Meaning |
|---|---|
| `DRAFT` | A candidate being prepared. It is not visible to users. |
| `VALIDATED` | A designated human reviewer has completed the validation gate. It is not yet visible to users. |
| `PUBLISHED` | A designated Product/Data Owner has approved the trend for discovery. It may be shown only to affected user types, with provenance and limitations. |
| `ARCHIVED` | A previously published trend has been removed from current discovery because it is stale, superseded, or no longer supported. It is not presented as current. |

| Transition | Who may move it | Required gate |
|---|---|---|
| Create `DRAFT` | Data Curator | Accept a real-world candidate for preparation. No `CANDIDATE` lifecycle state is created. |
| `DRAFT` to `VALIDATED` | Designated human reviewer | Complete structural validation and factual verification. Confirm F&B scope; taxonomy and subject-area fit; required evidence; support for the signal, direction, and period; uncertainty and limitations; and suitable affected user types. If any check fails, it remains `DRAFT`. |
| `VALIDATED` to `PUBLISHED` | Product/Data Owner | Confirm validation is still current, the evidence and its limitations are present, and the affected user types are appropriate; then explicitly approve discovery. |
| `PUBLISHED` to `ARCHIVED` | Product/Data Owner | Confirm the trend is stale, superseded, or no longer supported; record the reason and remove it from current discovery. |

These names describe operating responsibilities, not application roles, admin screens, or routes. No trend may be published until the organization assigns trusted reviewers and owners. The current backend does not enforce those responsibilities: its presence checks do not prove factual review or reviewer authority, and `server-only` is not authorization. The create, validate, publish, and archive methods are internal implementation methods only. Ordinary Entrepreneur and UMKM users must not receive mutation permission. Add no mutation route or server action until trusted server-side authorization exists. This configuration defines no other transition; reopening archived trends and the exact staleness threshold remain open decisions.

## 8. User Experience Principles

Future Trend Intelligence should follow `DESIGN.md` and the VENTUREX warm editorial direction:

- present a clear editorial account of an observed signal, not a generic analytics dashboard or social feed;
- make the trend, category, direction/period, source date when known, and evidence limitation easy to distinguish; any source-freshness indicator is future behavior and is not derived from catalog timestamps;
- preserve the future released-product requirement to explain why the signal may matter to this user using role-appropriate profile context; the current foundation provides audience eligibility and general curated relevance only;
- use restrained typography, warm neutral surfaces, deliberate accent color, and subtle borders; avoid excessive shadows and generic AI gradients;
- never use empty charts, fake KPI cards, unsupported market numbers, color-only warnings, or real-time language for cached/prepared data in future provider-backed views; the current foundation does not persist those source modes;
- show uncertainty and source limitations in plain language, without implying certainty or guaranteed business outcomes.

This section defines future behavior only; it does not authorize Dashboard or Trend Radar UI implementation.

## 9. Boundary with the Opportunity Engine

| Capability | Answers | Responsibility |
|---|---|---|
| Trend Intelligence | **What has been observed, and why might it matter?** | Presents evidence-backed changes and role-aware context. |
| Opportunity Engine | **What business action or option could be considered?** | Evaluates potential business options using trend and other business evidence. It is outside this freeze. |

A Trend is not an Opportunity, a recommendation, or an action plan. A trend may inform a later Opportunity, but the relationship is not necessarily one-to-one. Trend publication must not automatically create or score opportunities.

## 10. API and Database Impact

| Area | Decision |
|---|---|
| Database | The core catalog remains `trends` plus `trend_evidences`, as described in `docs/Database Design.md` and migration 008. Additive migration 017 provides an optional, bounded `trend_evidence_provenances` relation for approved source identifiers, publisher/transport distinction, retrieval time, explicit observation-period state, geography, and validated metric metadata. It does not backfill historical rows, change catalog lifecycle behavior, store raw provider payloads, or authorize persistence of Bright Data output while licensing review is open. `category_code` is the Trend taxonomy; nullable `fnb_category_id` is only the F&B subject area. The shared `evidences` design remains for future/shared domain use, including Opportunity, and is not the current Trend evidence store. |
| Server-side service and DTO | The current internal foundation has a server-side `TrendService` and typed `TrendDto`. Its published-list path resolves the current user, filters `PUBLISHED` records by persisted `userType` and `affectedUserTypes`, and does not load Entrepreneur or UMKM profile data. This is audience eligibility, not profile personalization. The DTO carries catalog identity, taxonomy/subject-area labels, signal, suitable evidence details, the general relevance explanation, affected user types, lifecycle state, and record timestamps. It excludes ORM objects, evidence IDs, and archive reason. `createdAt`/`updatedAt` are catalog record timestamps, not source freshness. |
| API exposure | No Trend API endpoint is implemented or approved. The Trend paths and payloads in `docs/API Design.md` remain proposals only; no endpoint, filter, sorting rule, or API DTO is committed by this configuration. Do not add a Dashboard aggregation endpoint. |

The selected data architecture, taxonomy distinction, server-side eligibility behavior, and current DTO boundary remain in effect. The optional provenance schema does not change the Trend service, DTO, API exposure, user-facing freshness, UI, or profile-personalization decisions. Profile-aware relevance and external API exposure remain future work.

## 11. Open Decisions

The following remain unresolved and must not be treated as implementation facts:

1. Additional external providers, source coverage, licensing, reliability, and any persistent or automated ingestion remain undecided. The approved Bright Data candidate collector is ephemeral and is not part of the user-facing Trend List data path.
2. Assignment of the Data Curator, human reviewer, and Product/Data Owner; trusted server-side authorization and any audit trail for their actions.
3. Operational evidence review details, including how uncertain or undated sources are recorded and whether reviewer identity must be persisted.
4. Future derived source-freshness semantics and any threshold. List v1 date semantics are resolved in the approved contract; a source date is not the same as catalog `updatedAt`.
5. Future profile-aware relevance method, including whether the explanation is computed per request or persisted. Profile-aware relevance is deferred from v1; no numeric relevance score or ranking formula is approved.
6. Whether source-defined numeric signals may be displayed, including their unit and caveats.
7. Whether archived trends can be reactivated and how corrections to published trends are versioned.
8. Whether Trend information should be exposed through an API, and which consumers, authorization rules, filters, and payload it would serve.
9. AI provider/model, prompt/versioning, evaluation, and human review tooling, if AI assistance is later approved.
10. Trend Detail and Trend-to-Opportunity relationship implementation, including relationship-query semantics and Opportunity openability; these target requirements remain deferred from List v1 and require separate approval.

These decisions do not block the curated-catalog MVP decision. Resolve each before the related ingestion, publication workflow, profile personalization, freshness display, API, schema auditability, AI capability, or Trend Detail/Opportunity relationship is implemented.

## 12. Batch 17E Authenticated Live Observation Slice

The Product Owner approved a narrow additive `/trends` user flow for an authenticated, manually refreshed Bright Data Google Trends Indonesia observation preview. This is not the published Trend List and does not change the catalog lifecycle, catalog DTO, or public Trend API contract.

- A user action may request a live refresh. Page rendering never calls Bright Data. The server keeps normalized snapshots in process memory with request coalescing, a bounded refresh interval, and no database persistence. Multi-instance deployments do not share this cache.
- Only `LIKELY_FNB` and `REVIEW_REQUIRED` groups may be shown; `OUT_OF_SCOPE` groups remain excluded. Screening is a keyword heuristic, not factual validation. The view must show provider attribution, actual retrieval time, original source reference, metrics exactly as returned with `UNSPECIFIED` units, unknown observation period, partial response information, and evidence limitations.
- An observation remains an unreviewed source signal. It is not a curated Trend, business Opportunity, recommendation, or catalog lifecycle state. It must not be automatically imported, validated, published, or persisted.
- Bright Data's public agreement does not conclusively establish rights for VENTUREX to display the SERP API output or transmit it to the configured AI provider in this product. Those operations remain independently gated by `BRIGHTDATA_TRENDS_DISPLAY_RIGHTS_CONFIRMED` and `NINEROUTER_BRIGHTDATA_PROCESSING_CONFIRMED`. Keep both `false` until applicable account/service terms or written permission are verified. Google Trends reuse requires Google attribution and compliance with Google's Terms of Service.
- The new authenticated API paths are limited to the live observation preview and its user-consented analysis. They do not expose mutation or catalog lifecycle operations. The existing curated catalog remains the default published-content section.

This exception implements the approved hackathon slice only. It does not resolve broad redistribution rights, automatic collection, persistent source caching, or general Trend API design.

## 13. Product Owner live-first decision, 14 October 2026

For the authenticated local hackathon website, the Product Owner self-attests permission for a manually requested, private Bright Data preview. The local `.env` opt-ins may be enabled for that scope. This is not independent verification of public redistribution rights and does not authorize public display, broad retention, or automated collection. The 2025 curated records and manifest remain unchanged as archive; Dashboard, Trend Radar, Opportunity Finder, and Saved Opportunities do not use them as current data or provider fallback.

AI-generated ideas are stored only in the separate owner-scoped hypothesis table after explicit consent and successful secure 9Router inference. The configured 9Router endpoint is public plaintext HTTP. Until a verified HTTPS endpoint or SSH tunnel is configured, the application must reject real-profile inference before any outbound call. The normal Opportunity Analysis provider guard remains unchanged. No provider output is automatically validated or published as a catalog Trend or Opportunity.

## 14. Product Owner Trend Radar relevance and time-window decision, 14 October 2026

The authenticated local Trend Radar preview remains a manually requested Google Trends Trending Now source observation. The source request uses Indonesia (`geo=ID`) and may select only the supported 4, 24, 48, or 168 hour windows. The selected window is sent as the source's `hours` parameter and is shown with the retrieval time. This is a trending-query window, not a time-series observation period for each query.

The current integrated Trending Now source is a general Google Search surge list. It does not provide a Bakso-specific query, F&B category, or alternate search-property filter in this integration. The user's primary product term (Entrepreneur preferred product type or the first UMKM product name) is used only as a local filter over the returned list; it is not sent to Google Trends. The F&B and term matching labels are VENTUREX heuristics, not source classifications or factual validation. An empty Bakso-filtered list means no matching item was found in that returned Trending Now list; it does not establish that Bakso has no search interest in Indonesia.

The page may expose the loaded Trending Now rows as Google Trends source observations with source reference, retrieval time, source-provided metrics and explicit unknown units/limitations. It must not infer demand, popularity outside the returned source list, sales, revenue, or business viability. The current preview remains in-memory and manually refreshed; it does not persist provider content, import records, or change publication lifecycle. The prior local hackathon display-rights self-attestation and any required server-side opt-in remain in force. No unsupported category, query, date-range, or search-property parameter may be sent to the current Trending Now target.
