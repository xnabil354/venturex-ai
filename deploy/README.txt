VENTUREX production deployment — venturex.web.id

Architecture
Browser -> Cloudflare -> host Nginx HTTPS -> 127.0.0.1:3000 -> Docker Next.js
Next.js + notification worker -> PostgreSQL 18 on private Compose network
Next.js -> HTTPS venturex.web.id/v1 -> host Nginx -> 127.0.0.1:20128 -> 9Router

The existing host Nginx is shared with other sites and remains on the host.
Next.js and PostgreSQL run in Docker. 9Router runs under systemd.
.env.production is consumed at runtime and excluded from the Docker build.
The main compose.yaml provides HTTPS AI transport without editing secrets.
compose.production.yaml remains as an empty compatibility overlay for old commands.
Inside the app container, venturex.web.id resolves to the Docker host gateway,
bypassing Cloudflare for AI transport while retaining certificate validation.
The /v1/ proxy permits only loopback and the private 172.21.0.0/16 app network.
External requests receive 403; the 9Router dashboard is not published.
Keep the Compose subnet and the Nginx allow rule synchronized on another host.

Deploy/update (from repository root)
  ./deploy/compose config --quiet
  ./deploy/compose build app
  ./deploy/compose up -d --wait postgres
  # Back up the database before migrating an existing installation:
  # use a private directory outside the repository, with umask 077.
  ./deploy/compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /PRIVATE/PATH/venturex.dump
  ./deploy/compose run --rm migrate
  ./deploy/compose up -d --no-build --wait --wait-timeout 120 app
  ./deploy/compose ps
  curl --fail https://venturex.web.id/api/health
  ./deploy/verify-ai

Migration is explicit, never hidden in container startup. Do not run down -v:
that removes the database volume. Do not automatically seed fabricated catalog
data or reset existing records. Reference seeding is an explicit ops profile.
For an application rollback, retain/tag the previous Docker image before build,
restore its image tag and recreate app. Database rollback requires reviewing the
specific migration and, if necessary, restoring a tested backup; do not run undo
blindly against production data.

Host configuration (already installed on this VPS)
  deploy/nginx/venturex.web.id.conf -> /etc/nginx/sites-available/venturex.web.id.conf
  deploy/systemd/9router.service -> /etc/systemd/system/9router.service
  deploy/systemd/9router-healthcheck.service and .timer -> /etc/systemd/system/
  deploy/systemd/9router-healthcheck -> /usr/local/sbin/9router-healthcheck (0755)
  deploy/renew-nginx -> /etc/letsencrypt/renewal-hooks/deploy/venturex-nginx (0755)
  nginx -t && systemctl reload nginx
  systemctl daemon-reload
  systemctl enable --now docker nginx 9router 9router-healthcheck.timer certbot.timer

9Router operational rules
The installed 9Router version is 0.5.109. The service directly executes its
custom-server.js using Node 24.19.0. Paths in the service are host-specific;
review them when upgrading Node or reinstalling 9Router. Preserve DATA_DIR,
NODE_PATH, provider credentials and the SQLite database during an upgrade.
Never launch the interactive `9router` CLI alongside the service: this version's
launcher kills matching next-server processes across the host. That can kill
VENTUREX and unrelated Next.js applications, as well as its own terminal wrapper.
No tmux or active SSH session is required.

Restart=always recovers process exits. The health timer checks HTTP responsiveness
every minute, retries three times, and restarts a hung service. An intentional
systemctl stop remains stopped. It does not restart the provider for account
quota, expired upstream authorization or a model error: those require diagnosis.
The service retains the existing root-owned installation/data. NoNewPrivileges,
ProtectSystem=strict and PrivateTmp reduce its write access. Moving to a dedicated
unprivileged user requires relocating the installation and existing credentials.

  systemctl status 9router --no-pager
  journalctl -u 9router -f
  systemctl restart 9router
  systemctl list-timers 9router-healthcheck.timer certbot.timer
  ./deploy/compose logs --tail 100 app

Access the private dashboard with an SSH tunnel from your own computer:
  ssh -N -T -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:20128:127.0.0.1:20128 root@72.62.247.63
Then open http://127.0.0.1:20128/dashboard and sign in with the existing password.
Run that command in Windows PowerShell, not inside the VPS SSH shell. Keep the
PowerShell window open. A quiet session after authentication is normal with -N.
Alternatively, copy deploy/9router-tunnel.ps1 to Windows and run it locally.
Use -LocalPort 20129 if 20128 is already occupied; then browse localhost:20129.
Port 20128 on the VPS intentionally binds only to 127.0.0.1; the public IP URL
does not serve the dashboard. AI inference uses the separate private HTTPS path.

Codex text paste over SSH
An image-paste error mentioning X11 means Codex attempted the Linux clipboard
path on the remote machine. This VPS is a headless SSH session with no DISPLAY
or WAYLAND_DISPLAY. The Windows clipboard belongs to the laptop.
Use the terminal's Paste action, for example Ctrl+Shift+V or its Paste menu.
In Windows Terminal Settings -> Actions, ensure Paste is bound to Ctrl+Shift+V.
The text must be pasted by the local terminal, rather than sending a raw image
paste shortcut to Codex. For other SSH clients, use that client's Paste action.
No X11 service is required for pasting plain text. Windows clipboard interaction
cannot be verified or changed from this VPS session.
The user confirmed their client is Termius and text paste recovered by itself.
Use Termius's local Paste action if it recurs. Windows Terminal shortcuts above
apply specifically to Windows Terminal.
Windows Terminal reference:
https://learn.microsoft.com/en-us/windows/terminal/customize-settings/actions
Codex CLI reference (OpenAI Docs): https://learn.chatgpt.com/docs/cli

Timeouts and limits
Nginx read/send timeouts are 210 seconds, above the application's configured
120-second Finder and 60-second analysis deadlines. Public browser requests
still pass through Cloudflare. Its documented default Proxy Read Timeout is
125 seconds: https://developers.cloudflare.com/fundamentals/reference/connection-limits/
Multi-step analysis can exceed that external deadline even if every individual
provider call respects its own limit. If real workloads hit 524, use DNS-only
for the application domain (with suitable origin protection), an appropriate
Cloudflare plan/setting, or an explicitly designed asynchronous job API.
Merely increasing the Nginx timeout cannot extend Cloudflare's timeout.

Backups and verification (25 October 2026)
Initial PostgreSQL pg_dump and consistent SQLite backup are stored outside Git
in /root/venturex-deploy-backup (0700; files 0600), together with original host
configuration. These are local rollback copies, not off-host disaster recovery.
Docker logs rotate at 10 MB x 3 per production container; systemd logs use journald.
TLS renewal uses the existing certbot timer/webroot and reloads Nginx after renewal.
The certificate inspected during deployment expires on 22 January 2027.

Verified: production Docker build; TypeScript; 54 existing AI transport/worker
tests; all 27 migrations applied with none pending; public HTTP-to-HTTPS redirect;
public health endpoint with DB connection; private HTTPS AI discovery and live
synthetic JSON inference using cx/gpt-6-luna-xhigh; systemd recovery after SIGKILL;
public /v1 denial. Real user hypothesis quality, paid-provider quotas and future
24/7 uptime cannot be established by these deployment smoke checks.

Chromium also verified /, /login and /register at desktop (1440px) and mobile
(390px) widths: HTTP 200, no page JavaScript errors and no horizontal overflow.
Unauthenticated /dashboard redirected to /login. PostgreSQL backup archive
contents were readable with pg_restore --list. During the initial deployment,
no production account was created and no real user's profile was sent to AI.

Roadmap origin repair verification (25 October 2026)
Reproduced the original failure through production HTTPS with a short-lived
synthetic account: GET progress 200, PATCH checkbox 403. After deploying the fix,
all six stages persisted, completion became true, reopening stage six persisted
and relocked completion, and an evil.invalid Origin still received 403. The test
account, roadmap and progress rows were removed afterward. No real user's
roadmap was modified and no paid AI request was needed for this regression check.
36 targeted tests, TypeScript, changed-file ESLint and the Docker build passed.
The previous image is retained as venturex-ai:before-roadmap-origin-fix-20261025.
SSH server settings permit TCP forwarding and the local 9Router login returns
200. The Windows tunnel script is provided but was not executed on a real laptop.

AI network repair (25 October 2026, 09:00 UTC)
The active app had been recreated using compose.yaml alone. Since the previous
network settings lived only in compose.production.yaml, runtime configuration
fell back to http://localhost:20128/v1 from env_file. That address is local to
the app container, not the VPS, and produced ECONNREFUSED in 1-2 ms before HTTP
headers. It was unrelated to model reasoning duration, schema or concurrency.
The original deployment instructions allowed this mismatch; networking now lives
entirely in compose.yaml. The old overlay and base-only resolved configurations
were checked to be identical. A normal base-only up was used to restore service.
For another HTTPS gateway use NINEROUTER_CONTAINER_BASE_URL. Never substitute a
container loopback URL for the host service. The verify-ai command performs a
read-only model-discovery probe using runtime credentials without printing them
or generating a hypothesis. It exits nonzero for invalid transport, unreachable
gateway or absent configured model. Run it after each deployment.
Post-repair verification: runtime model discovery HTTP 200; synthetic structured
inference through generateNineRouterJson (the application's guarded AI SDK
adapter) HTTP 200, schema PASSED, about 4.6 seconds using cx/gpt-6-luna-xhigh.
The old loopback configuration was also confirmed to fail the new verifier.
The app and PostgreSQL were healthy after base-only Compose deployment, and
9Router remained active with no restarts. No real profile was sent for the probe.
