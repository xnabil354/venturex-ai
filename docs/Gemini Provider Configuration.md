# Gemini Provider Configuration

Batch 11 connects the existing AI Analysis adapter to the Gemini OpenAI-compatible chat API. It does not change the analysis schema, API routes, persistence model, or user interface.

## Provider settings

| Variable | Value |
|---|---|
| `AI_ANALYSIS_PROVIDER` | `gemini` |
| `AI_ANALYSIS_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| `AI_ANALYSIS_API_KEY` | Store the key in a local ignored environment file or a deployment secret store. Do not commit or log it. |
| `AI_ANALYSIS_MODEL` | `gemini-3.1-flash-lite` |
| `AI_ANALYSIS_TIMEOUT_MS` | Existing bounded timeout, from 1,000 to 60,000 milliseconds |
| `AI_ANALYSIS_GEMINI_SYNTHETIC_SMOKE_ENABLED` | `false` by default; enables only the isolated smoke harness when explicitly set to `true` |
| `AI_ANALYSIS_GEMINI_FREE_TIER_CONFIRMED` | `false` by default; operator confirmation required by the isolated smoke harness |

The stable model and endpoint are pinned by configuration validation. The adapter uses the server-side API key as a bearer credential and sends a Gemini-compatible schema for the seven required fields. The full existing Zod domain schema, including string-length limits and strict field validation, is applied locally to the returned object. Each generation makes one request and does not retry automatically. See Google's [OpenAI compatibility guide](https://ai.google.dev/gemini-api/docs/openai), [Gemini 3.1 Flash-Lite model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite.md), and [structured output guide](https://ai.google.dev/gemini-api/docs/structured-output).

## Free-tier privacy boundary

Google's [Gemini API terms](https://ai.google.dev/gemini-api/terms?hl=en) state that content sent through unpaid Gemini API quota may be used to improve products and may be reviewed by people. Do not submit personal, sensitive, or confidential information through that tier.

The application does not currently have trusted provenance metadata proving that an authenticated user's profile is synthetic. Therefore, configuring Gemini or setting either smoke flag does **not** enable Gemini calls from the normal Opportunity Analysis API. Its default application adapter returns the existing unavailable state for Gemini.

The dedicated smoke harness uses only fixed synthetic Entrepreneur and UMKM fixtures. It does not load a user account, query or write PostgreSQL, call an application API route, persist analysis, or print the prompt or credential. It makes at most one request per fixture and skips unless both smoke flags are explicitly enabled.

## Safe smoke procedure

1. Create or rotate a Gemini API key, and store it only in ignored `.env.local` or a secret manager. Never use a key disclosed in chat, source code, logs, or a shared document.
2. In the provider console, confirm the project is using the unpaid quota and that available quota is sufficient. Do not enable billing for this smoke test.
3. Set the provider, endpoint, model, and API key variables above. Set both smoke flags to `true` only for the test session.
4. Run `pnpm test:gemini-smoke`. This invokes the synthetic-only harness separately from the normal test suite.
5. Set both flags back to `false` and remove the key from the local environment when finished.

If no secure replacement key or confirmed unpaid quota is available, do not run the smoke test. Mock HTTP tests remain offline and do not prove live Gemini connectivity. Enabling Gemini for normal user data requires a separate verified synthetic-data boundary or a separately approved provider/data-handling decision.
