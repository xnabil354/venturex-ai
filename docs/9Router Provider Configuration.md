# AI Provider Configuration — 9Router

Batch 17G replaces Gemini in the authenticated Opportunity Analysis, authenticated Trend Signal Analysis, and isolated synthetic demo paths. Gemini adapters and the Gemini live-smoke harness are no longer used by these flows. The existing seven-field Zod analysis contract remains unchanged.

## Server configuration

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | Must be `ninerouter`. |
| `NINEROUTER_BASE_URL` | API origin ending in `/v1`. Normal authenticated inference requires HTTPS or a verified local authenticated loopback tunnel. The separate consented Trend Signal/private Opportunity routes can use `localhost`, `127.0.0.1`, or `::1` over HTTP only in development with the explicit local HTTP opt-in below. |
| `NINEROUTER_API_KEY` | Server-only credential. Never expose it in client bundles, logs, output, or source control. |
| `NINEROUTER_MODEL` | Product Owner requested identifier: `cx/gpt-6-luna-xhigh`. Configuration acceptance does not prove that the upstream account recognizes this identifier; model discovery must succeed first. |
| `AI_ANALYSIS_TIMEOUT_MS` | Bounded provider timeout, 1,000–60,000 milliseconds. |
| `NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY` | Defaults to `false`. When `true` in development, the exact `http://72.62.247.63:20128/v1` endpoint may be used by the local consented Trend Signal and private Opportunity flows, plus the isolated `LIVE_SYNTHETIC` demo. Those consented profile routes may also use exact loopback hosts (`localhost`, `127.0.0.1`, or `::1`) over HTTP in development. Production and the existing normal Opportunity Analysis provider still reject public HTTP. The bearer key and minimum allowlisted context travel over an unencrypted public network when a public endpoint is selected; loopback traffic stays on the local machine. Use only a dedicated, revocable key and synthetic/non-sensitive test profiles. |
| `NINEROUTER_BRIGHTDATA_PROCESSING_CONFIRMED` | Must remain `false` unless the applicable source and service terms permit sending Bright Data observations to 9Router. |
| `AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED` | Opt-in for the authenticated Trend Signal inference route; default `false`. |
| `AI_ANALYSIS_NINEROUTER_SYNTHETIC_SMOKE_ENABLED` | Separate local synthetic smoke gate; default `false`. |

Use the environment variable names in `.env.example` and keep credentials in an ignored local file or secret manager. Do not copy an API key into a browser-visible `NEXT_PUBLIC_*` variable.

## Request and privacy boundaries

The adapter uses the installed Vercel AI SDK OpenAI-compatible provider with the Chat Completions protocol. It pins `/chat/completions`, sends one non-streaming request, sets SDK retries to zero, rejects a second fetch invocation, bounds request/response sizes, validates JSON against the strict local schema, and emits only sanitized diagnostic metadata. Offline tests verify this adapter behavior; they do not prove upstream model compatibility.

Authenticated Opportunity Analysis requires an explicit, versioned user consent before a provider request. The server constructs the context from the authenticated profile, eligible Opportunity, published Trend, scores, risk state, and traceable evidence. The provider projection excludes account identifiers, name, email, location, exact finances, free-form profile notes, business description, and specific product names. The resulting analysis is persisted by the existing analysis service. A cached result is returned only when its provider, model, and context fingerprint match the current configuration and context.

Authenticated Trend Signal Analysis and private Opportunity hypothesis generation are separate routes. They require sign-in, a completed Entrepreneur or UMKM profile, an owned in-memory source snapshot, explicit consent, the relevant feature flags, valid provider configuration, and the Bright Data-to-9Router processing gate. When the local public-HTTP opt-in is enabled, profile routes additionally accept only loopback requests and show an explicit unencrypted-transport warning before consent. The allowlisted context contains selected product categories, an Entrepreneur's optional preferred product type when provided, customer segments, sales channels, and applicable experience/time categories; raw notes, account identifiers, location, and exact finances are excluded. The optional product type is treated as untrusted data, not an instruction. Trend analysis is returned without persistence; generated Opportunity hypotheses are persisted privately to the authenticated user's account and can be explicitly saved. Bright Data source display and transmission to 9Router are separate gated operations.

Provider retention, human review, downstream processing, and model alias acceptance have not been independently verified by VENTUREX. UI disclosures state these limits. A user's consent does not establish provider terms or source redistribution rights.

## Synthetic local demo

The local synthetic AI demo has a server-owned fixture registry and does not read account profiles or application database records. It defaults to MOCK; mock results are labeled as test/simulation output. A live synthetic mode is available only through the private local launcher, explicit process flags, provider configuration, and a server-side one-request process budget. Public HTTP opt-in is restricted to development and the single configured endpoint. Because HTTP does not encrypt the bearer key or request context, use this only for bounded local tests with a dedicated revocable key and synthetic/non-sensitive prompts; it is not suitable for production.

## Verification status

Batch 17G implementation is covered by mocked HTTP tests. The public HTTP development exception is not transport security and does not establish model acceptance. Do not label the selected model live-verified until an explicitly authorized request completes and its schema-validated result is rendered.

A Gemini API key was disclosed in an earlier conversation. Rotate that key and remove unused Gemini credentials from local environments. This implementation does not read Gemini keys.
