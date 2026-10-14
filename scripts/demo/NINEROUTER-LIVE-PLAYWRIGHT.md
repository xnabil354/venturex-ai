# 9Router live synthetic Playwright check

This is a separate, opt-in check. The regular synthetic-demo Playwright suite remains in `MOCK` mode and does not consume provider tokens.

The live check sends the fixed server-owned `DEMO_UMKM` fixture in one explicit browser action. It does not use a real account or write to a database. The provider key is read server-side from `.env`; never place it in a command, test fixture, browser, or chat.

The configured endpoint is public plaintext HTTP. A rotated, dedicated test key reduces the impact of exposure but does not make the connection secure. Use a key that can be revoked, with any available usage limits. Do not use a key that grants access to other services or data.

Before a live run:

1. Create a replacement 9Router key, revoke the previously exposed/used key, and store only the replacement as `NINEROUTER_API_KEY` in `.env`.
2. Confirm `.env` has `AI_PROVIDER=ninerouter`, the fixed 9Router base URL, and `NINEROUTER_MODEL=cx/gpt-6-luna-xhigh`.
3. In a fresh PowerShell session at the repository root, explicitly arm one run:

   ```powershell
   $env:VENTUREX_9ROUTER_KEY_ROTATED_CONFIRMED = "true"
   $env:VENTUREX_9ROUTER_LIVE_E2E_ARMED = "true"
   pnpm test:e2e:ninerouter-live
   Remove-Item Env:VENTUREX_9ROUTER_KEY_ROTATED_CONFIRMED
   Remove-Item Env:VENTUREX_9ROUTER_LIVE_E2E_ARMED
   ```

The test fails during preflight without launching the server unless both shell gates, the key, provider, exact endpoint, and model are present. It runs from a temporary isolated copy of the current working tree, excludes `.env` and build artifacts, and uses the installed dependencies through a junction. This avoids the existing development server's `.next` lock and keeps generated `next-env.d.ts` changes out of the working tree. The runner launches only a loopback development server, uses the existing one-attempt process budget, disables Playwright retries, and makes one browser POST. It does not take screenshots, traces, or videos.

Treat a failed run as having consumed the one-request authorization. Do not rerun after any request attempt without a new Product Owner authorization. Revoke the dedicated key after the test. The request budget is enforced per server process, not as a durable provider-account quota.
