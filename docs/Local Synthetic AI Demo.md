# Local Synthetic AI Demo

The local-only demonstration is separate from authenticated AI Analysis and uses two fixed, server-owned synthetic fixtures. `MOCK` is the default and uses a deterministic local provider. An explicitly authorized `LIVE_SYNTHETIC` mode can send only those fixture fields to the configured 9Router provider; it never reads account data, profiles, or opportunities from PostgreSQL. Analysis does not call Bright Data, persist results, or calculate Opportunity Score, Fit Score, or Risk Indicator.

Start it from the repository root:

```powershell
node scripts/demo/local-server.mjs
```

The launcher binds Next.js development mode to `127.0.0.1` on port `3016`. Open `http://127.0.0.1:3016/local-demo/ai-analysis`. A different local port may be supplied as the sole argument, for example `node scripts/demo/local-server.mjs 3020`.

The launcher forces `MOCK` unless started with `--live-synthetic`. Live synthetic mode requires explicit local authorization, `AI_ANALYSIS_SYNTHETIC_DEMO_LIVE_AUTHORIZED=true`, `AI_ANALYSIS_NINEROUTER_SYNTHETIC_SMOKE_ENABLED=true`, and a valid 9Router configuration. Public HTTP additionally requires `NINEROUTER_ALLOW_PUBLIC_HTTP_DEV_ONLY=true`; that exception accepts only `http://72.62.247.63:20128/v1` in the isolated local synthetic route. It does not make transport secure: the server-side bearer key travels unencrypted, so never use real-user context or a reusable production credential with this option. Normal authenticated inference and production continue to reject public HTTP. The provider path enforces the configured timeout, bounded request/response sizes, no retries, and a maximum of one outbound attempt per server process, including failures. The limit is process-local, not a durable cross-process quota. Provider charges may occur. No billing change or top-up is authorized by the launcher.

The route is disabled unless development mode, the private loopback launcher marker, the feature opt-in, expected loopback host and port all match. It rejects forwarded requests and requires a same-origin POST. Host and Origin checks are defense in depth, not user authentication. Demo persona data is synthetic and carries no application authority.

Results carry server-owned provider-mode metadata. Mock output is labeled `Contoh hasil simulasi — bukan respons 9Router live`; live output is labeled `Analisis 9Router — menggunakan profil demo sintetis`. Neither label represents market evidence or business validation. The live label must only be used for an actual provider result. The demo does not persist results.

## Bright Data source preview (Decommissioned)

The previous Bright Data source preview panel and endpoint (`POST /api/local/trend-source-preview`) have been decommissioned and removed. VENTUREX AI uses SearchApi.io for live Google Trends signals.
