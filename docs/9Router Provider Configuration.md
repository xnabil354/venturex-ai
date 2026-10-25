# AI Provider Configuration — 9Router

## Opportunity and score reliability audit, 25 October 2026

All generation flows use the guarded `generateNineRouterJson` transport. Calls
without a custom diagnostic handler now emit the same bounded, safe metadata to
`venturex_ai_provider_result`: request correlation, timing, HTTP status and schema
outcome, without prompts, responses or private profile values. Existing custom
Finder diagnostics remain intact. An outer AbortSignal with TimeoutError is
classified as an application deadline rather than a client disconnect.

Entrepreneur detail analysis checks cancellation before provider work, after
market evidence loading, when AI fails and immediately before persistence. A
cancelled request no longer becomes a newly saved partial snapshot. Genuine
provider failures retain the documented partial-data behavior and missing-score
rules. Business analysis already checks cancellation before persistence.

Live synthetic probes for ayam bakar madu and ayam bakar Padang exercised the
real 9Router requirements call and deterministic detail-score service. Both
returned validated requirements and available Opportunity/Fit scores. The probe
used synthetic profile/market data and an in-memory repository; it does not prove
availability of the same factors for a real account. No real profile was sent
and no account records were changed. Shared transport and both persona services
passed 232 offline tests; two opt-in live tests were skipped in that run. A
separate opt-in live run of the full private hypothesis pipeline passed for both
Entrepreneur and UMKM with synthetic profiles/evidence and mocked persistence,
including schema and grounding validation. This does not test live SearchApi
retrieval or authenticated browser interactions.

The production image was rebuilt and deployed successfully. The public health
endpoint and container-to-gateway HTTPS/model-discovery probe passed. The 9Router
systemd service was running with zero restarts during verification, and its
health-check timer was active. The rollback image is
`venturex-ai:before-ai-reliability-20261025`.

## Docker production transport repair, 25 October 2026

The active app was recreated from `compose.yaml` without the former production
overlay and inherited `http://localhost:20128/v1` from its environment file.
Inside Docker, this addressed the app container rather than the host's systemd
9Router, producing `NETWORK` / `ECONNREFUSED` before receiving HTTP headers.
All required transport settings now live in `compose.yaml`: HTTPS Nginx at
`https://venturex.web.id/v1`, a host-gateway domain mapping, and the private subnet
matching the Nginx allow rule. The legacy overlay remains compatible but is no
longer required. `NINEROUTER_CONTAINER_BASE_URL` optionally selects another HTTPS
gateway; API credentials still come from the ignored environment file.
`./deploy/verify-ai` checks live container transport and model discovery without
inference or printing credentials. This fix does not change generation schemas,
timeouts, grounding validation or the no-retry contract.

## Grounding geography repair, 21 October 2026

The hybrid materializer previously compared a SearchApi geographic code (`ID`, `US`, or the empty Worldwide code) with a localized display label (`Indonesia`, `Seluruh dunia`). This deterministic server mismatch rejected otherwise schema-valid responses with `FACT_REFERENCE_MISMATCH` before their fact references were checked. It affected both Entrepreneur and existing-business profiles and was independent of the selected product or model.

Analysis context v5 keeps the authoritative `geographicCode` separately from the human-readable `geographicScope`. Grounding compares codes; prompts retain readable region labels without redundant code metadata. No database migration or relaxed grounding rules are required. Offline regression coverage exercises both personas, Worldwide/country/province scopes, tea/coffee/food profiles, real geographic mismatches, stale evidence, and invalid/cross-owner references. Mocked-provider success does not establish live upstream reliability.

## Timeout reliability for Opportunity Finder

AI_ANALYSIS_TIMEOUT_MS is the total timeout for the general AI analysis paths, bounded to 1,000–60,000 ms. Opportunity Finder uses the separate AI_OPPORTUNITY_FINDER_TIMEOUT_MS because its xhigh profile analysis has a larger response deadline; it defaults to 120,000 ms and accepts 1,000–180,000 ms. Both are application deadlines passed to the AI SDK and abort the provider request when they expire. The Opportunity Ideas route declares the Node.js runtime and has no route-level maxDuration. Next.js documents maxDuration as deployment-platform-defined, so deployments must set AI_OPPORTUNITY_FINDER_TIMEOUT_MS below their independently verified route deadline. The local-development value does not guarantee that a remote 9Router gateway or upstream model will respond within that time.

Development diagnostics include a correlation ID, inference start and total duration, configured deadline, safe prompt/body byte counts, outbound-request and response timing milestones, concurrency-slot state, abort/timeout classification, upstream HTTP status, and schema/grounding validation outcomes. They exclude prompts, responses, credentials, profile values, and financial values. The Opportunity Finder propagates the incoming request abort signal to the AI SDK. A local application timeout, a client disconnect, and an upstream HTTP 408/504 are reported as separate categories.

Batch 17G replaces Gemini in the authenticated Opportunity Analysis, authenticated Trend Signal Analysis, and isolated synthetic demo paths. Gemini adapters and the Gemini live-smoke harness are no longer used by these flows. The existing seven-field Zod analysis contract remains unchanged.

## Server configuration

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | Must be `ninerouter`. |
| `NINEROUTER_BASE_URL` | API origin ending in `/v1`. Normal authenticated inference requires HTTPS or a verified local authenticated loopback tunnel. SearchApi-backed Opportunity inference also accepts the validated `http://localhost:20128/v1` loopback endpoint only in development with a loopback opt-in; public HTTP remains rejected. |
| `NINEROUTER_LOOPBACK_TUNNEL_CONFIRMED` | Set to `true` only after verifying an authenticated encrypted loopback tunnel. This remains required for tunnel-based use outside direct development; do not set it for an ordinary localhost gateway. |
| `NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY` | Defaults to `false`. When `true`, permits direct SearchApi Opportunity inference to use only `localhost`, `127.0.0.1`, or `::1` on port `20128` and path `/v1`, only when `NODE_ENV=development`, with no embedded URL credentials. It does not authorize public HTTP or other 9Router flows. |
| `NINEROUTER_API_KEY` | Server-only credential. Never expose it in client bundles, logs, output, or source control. |
| `NINEROUTER_MODEL` | Product Owner requested identifier: `cx/gpt-6-luna-xhigh`. Configuration acceptance does not prove that the upstream account recognizes this identifier; model discovery must succeed first. |
| `AI_ANALYSIS_TIMEOUT_MS` | Bounded provider timeout, 1,000–60,000 milliseconds. |
| `AI_OPPORTUNITY_FINDER_TIMEOUT_MS` | Opportunity Finder total timeout, 1,000–180,000 milliseconds; defaults to 120,000 milliseconds. Keep it below the verified request deadline of the deployment platform. |
| `NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY` | Defaults to `false`. When `true` in development, the exact `http://72.62.247.63:20128/v1` endpoint may be used by the isolated `LIVE_SYNTHETIC` demo and legacy consented Trend Signal route. SearchApi-backed Opportunity inference never accepts public HTTP. For backward compatibility, this flag can enable only the exact validated loopback gateway in that flow; prefer `NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY`. The bearer key and request context are unencrypted over public HTTP. |
| `NINEROUTER_BRIGHTDATA_PROCESSING_CONFIRMED` | Legacy Bright Data gate (decommissioned; Bright Data is no longer used). |
| `NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED` | Separate SearchApi Google Trends Explore to 9Router processing opt-in. Defaults to `false`; it never inherits the Bright Data gate. |
| `AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED` | Opt-in for the authenticated Trend Signal inference route; default `false`. |
| `AI_ANALYSIS_NINEROUTER_SYNTHETIC_SMOKE_ENABLED` | Separate local synthetic smoke gate; default `false`. |

Use the environment variable names in `.env.example` and keep credentials in an ignored local file or secret manager. Do not copy an API key into a browser-visible `NEXT_PUBLIC_*` variable.

## Request and privacy boundaries

The adapter uses the installed Vercel AI SDK OpenAI-compatible provider with the Chat Completions protocol. It pins `/chat/completions`, sends one non-streaming request, sets SDK retries to zero, rejects a second fetch invocation, bounds request/response sizes, validates JSON against the strict local schema, and emits only sanitized diagnostic metadata. Offline tests verify this adapter behavior; they do not prove upstream model compatibility.

The published Opportunity Analysis route requires explicit, versioned consent before a provider request. Its existing projection and persistence contract remain separate from the private SearchApi Opportunity Finder described below. The analysis cache is returned only when its provider, model, and context fingerprint match the current configuration and context.

Authenticated Trend Signal Analysis and private Opportunity hypothesis generation are separate routes. They require sign-in, a completed Entrepreneur or UMKM profile, an owner-bound validated source, explicit consent, the relevant feature flags, and valid provider configuration. The legacy Bright Data Trend Signal route uses its Bright Data-to-9Router gate; the SearchApi-backed Opportunity Finder uses `NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED`. The latter rejects public plaintext HTTP regardless of the development-only HTTP opt-in. The Opportunity Finder builds a type-safe, server-owned, allowlisted projection for the authenticated persona. With the current disclosure, that projection may include relevant location, financial amounts, free-text notes, business description, business/product names and prices, segments, channels, experience, time commitment, and business objective. It never includes account identifiers, credentials, session data, or another user's profile. SearchApi query text and source metrics are supplied only for the selected owner-bound evidence row. The query-intent label is a heuristic candidate, not a fact. SearchApi provider observations are not persisted, but a validated hypothesis retains bounded source provenance and a keyed context fingerprint in the existing private JSONB record. Trend analysis is returned without persistence; generated Opportunity hypotheses are persisted privately to the authenticated user's account and can be explicitly saved.

Provider retention, human review, downstream processing, and model alias acceptance have not been independently verified by VENTUREX. UI disclosures state these limits. A user's consent does not establish provider terms or source redistribution rights.

Schema validation failures use the Opportunity Finder's schema path manifest to report safe field paths, issue codes, type categories, array/string lengths, configured limits, and supported enum values. Correlation ID, configured model, upstream HTTP status, duration, and source category are attached to the server-side diagnostic. These metadata remain bounded and never include raw provider values, response bodies, prompts, profile notes or financial values, authentication headers, API keys, or source tokens. A valid upstream HTTP status is not treated as a valid hypothesis; Zod and evidence-grounding validation must both pass before persistence.

## Synthetic local demo

The local synthetic AI demo has a server-owned fixture registry and does not read account profiles or application database records. It defaults to MOCK; mock results are labeled as test/simulation output. A live synthetic mode is available only through the private local launcher, explicit process flags, provider configuration, and a server-side one-request process budget. Public HTTP opt-in is restricted to development and the single configured endpoint. Because HTTP does not encrypt the bearer key or request context, use this only for bounded local tests with a dedicated revocable key and synthetic/non-sensitive prompts; it is not suitable for production.

## Verification status

Batch 17G implementation is covered by mocked HTTP tests. The public HTTP development exception is not transport security and does not establish model acceptance. Do not label the selected model live-verified until an explicitly authorized request completes and its schema-validated result is rendered.

A Gemini API key was disclosed in an earlier conversation. Rotate that key and remove unused Gemini credentials from local environments. This implementation does not read Gemini keys.

## SearchApi Opportunity hypothesis flow

The Opportunity Finder requires a valid, non-template Auth.js `AUTH_SECRET` of at least 32 characters to encrypt owner-bound source references. The signals route checks this before contacting SearchApi so quota is not spent when the reference cannot be secured. Tokens use AES-256-GCM and expire with the corresponding SearchApi adapter cache entry; the same secret allows verification across application instances. Source tokens are not written to the database or logs.

The AI consent is versioned as `opportunities-searchapi-ninerouter-profile-v2`. It covers the selected related query, its Top/Rising semantics and metrics, geographic scope, time filter, search property, retrieval time, and the expanded persona-specific profile projection. The UI shows the profile-data categories that may be used before consent; the server rebuilds current values at generation time and does not accept browser-supplied profile content. The context fingerprint includes the canonical allowlisted profile projection, persona, selected evidence identity, context version, prompt version, and configured model; it is an HMAC and does not contain raw profile values. The onboarding `profileVersion` semantics remain unchanged, so profile notes continue to stay outside that version counter. Search interest does not establish purchase intent, demand, or sales.

The provider prompt treats all profile text, product names, SearchApi queries, and links as untrusted task data and explicitly rejects instruction-like content in those values. Free-text profile fields redact email addresses, phone numbers, UUID-like identifiers, and labeled credential values before prompt construction. Generated ideas must cite the server-issued selected-evidence identifier and present profile-field references. Numeric text is accepted only when it matches a value from the current profile or selected evidence; unsupported business-metric and financial-performance claims and guarantees remain invalid. The model may return a schema-validated `INSUFFICIENT_EVIDENCE` outcome, which is returned to the UI without persisting a hypothesis or presenting it as a connection failure. The workflow does not authorize training or fine-tuning. The configured 9Router service may relay requests to an upstream model provider; provider-side retention and downstream processing have not been independently verified.

For SearchApi-backed Opportunity inference, direct loopback HTTP is accepted only in development on `localhost`, `127.0.0.1`, or `::1`, port `20128`, path `/v1`, with no URL credentials, and with `NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY=true`. The older public-HTTP development flag remains a restricted compatibility opt-in for this loopback destination only. Public HTTP remains rejected regardless of either flag. `NINEROUTER_LOOPBACK_TUNNEL_CONFIRMED=true` remains reserved for an actually verified encrypted tunnel.
# Opportunity Finder structured output, 20 October 2026

Private SearchApi hypothesis generation opts into strict Chat Completions `response_format.json_schema`. The adapter derives the wire schema from the same persona-specific Zod schema used for local validation. A transport-only `{ result: ... }` envelope keeps the outcome union below the root; the service receives the inner result and the public API/persistence shapes remain unchanged. Disjoint discriminated unions use provider-compatible `anyOf`. Existing callers that do not opt in retain their current transport behavior.

The existing 16 KiB limit on base instructions and profile context is unchanged. Structured calls additionally include the same generated schema in the system message, because this gateway was observed accepting but not enforcing response_format for the full hypothesis schema. Body allowance includes both schema copies, schema guidance, and 1 KiB framing overhead, bounded by the existing global 48 KiB request ceiling. Diagnostic prompt sizes include the actual system schema text. Response limits, timeout, concurrency, and no transport retry remain unchanged. Invalid envelopes, extra fields, invalid required fields, and invalid references still fail closed. No fallback silently disables structured output.

The configured gateway passed a small synthetic schema probe and an initial synthetic generation for both personas, but subsequent full-schema calls violated types despite strict response_format. Acceptance of that parameter therefore does not prove constrained decoding. The identical system schema is required as compatibility guidance; local schema and grounding validation remain mandatory. References: [AI SDK compatible providers](https://ai-sdk.dev/providers/openai-compatible-providers), [reported 9Router Codex compatibility issue](https://github.com/decolua/9router/issues/2896). The reported upstream issue is background context, not proof of the version or failure mode of this installation.
