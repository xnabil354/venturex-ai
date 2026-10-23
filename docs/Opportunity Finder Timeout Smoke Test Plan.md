# Opportunity Finder 9Router Timeout Smoke Test Plan

## Status

Prepared for Product Owner review. No paid 9Router inference was sent as part of this repair.

## Purpose

Compare a minimal valid Opportunity Finder prompt with a representative profile-sized prompt through the configured local 9Router gateway. Both requests use provider ninerouter, model cx/gpt-6-luna-xhigh, and http://localhost:20128/v1.

## Preconditions

- Obtain explicit authorization for up to two live provider requests. Do not retry either request automatically.
- Verify that the local gateway is ready and that gateway-side request diagnostics are available. The unauthenticated GET check to /v1/models timed out during this investigation, so port reachability alone is not an acceptable readiness signal.
- Keep the configured API key in the server environment. Do not print, copy, or record it.
- The current local .env sets `AI_OPPORTUNITY_FINDER_TIMEOUT_MS=120000`. This is an application deadline, not proof that the gateway or upstream model is healthy. This plan does not edit .env.
- Use an isolated in-memory repository and deterministic synthetic profile/evidence fixtures. Do not call SearchApi, read a real account profile, or write to the database.
- Use two distinct synthetic owner IDs so the existing per-user cooldown does not interfere with the comparison.

## Synthetic cases

1. **Minimal valid prompt:** Entrepreneur profile with product interest “kopi”, one synthetic customer segment, no notes, no financial values, and one synthetic Top query for “kopi susu”. Request one to three hypotheses under the existing JSON and grounding validators.
2. **Representative profile-sized prompt:** UMKM profile with synthetic business name and description, a synthetic product/category and sample prices, location, two customer segments, two sales channels, and a short synthetic note. Use one synthetic Rising query. Keep the prompt within the existing 16 KiB request budget.

The evidence must be constructed locally and sealed with the configured Auth secret. It must be clearly labeled synthetic and must not be sent to SearchApi. The profile context must use the existing allowlisted builder contract.

## Execution and measurements

Run case 1, then case 2 only if case 1 returns before the deadline. For each call, record only:

- Application and AI correlation IDs, requested model, configured timeout, and provider HTTP status.
- Inference start, outbound request start, response-header time, response-body completion time, and total duration.
- Prompt section byte counts, serialized request-body bytes, profile-field count, selected evidence count, requested hypothesis range, and response bytes.
- Concurrency-slot state, abort origin, schema-validation outcome, grounding-validation outcome, and in-memory persistence outcome.
- Gateway queue, connection, first-response, and total-generation timings when the gateway provides them.

Do not record prompts, profile values, response bodies, credentials, authentication headers, or gateway tokens. Do not persist the synthetic result.

## Stop conditions and interpretation

- Stop before sending if the local gateway cannot be verified as ready or its request diagnostics are unavailable.
- If a request reaches its configured deadline without completion, stop the comparison and do not retry. The local abort does not prove that upstream generation stopped.
- Treat an HTTP 408/504 as an upstream timeout, a local application deadline as an application timeout, and an incoming request abort as a client cancellation.
- A successful provider response is not a successful Opportunity result unless JSON schema and evidence-grounding validation both pass.
- A successful synthetic call does not prove that another user's profile will complete within the same duration.
