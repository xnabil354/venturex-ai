# Curated catalog importer

This development-only tool imports the versioned manifest at `data/catalog/curated-fnb-2025-candidates.v1.json`.

## Read-only preview

Dry-run is the default and performs only identity and catalog `SELECT` queries:

```powershell
pnpm catalog:import
```

It accepts only PostgreSQL on `localhost`, `127.0.0.1`, or `::1`, port `5432`, with database `venturex_dev` and role `venturex`. It refuses `NODE_ENV=production` and verifies the connected PostgreSQL database and role before reading the catalog.

## Apply

Database writes require an explicit flag and matching target confirmations:

```powershell
pnpm catalog:import -- --apply --confirm-db=venturex_dev --confirm-user=venturex
```

The flags are target safeguards, not Product Owner approval. Obtain separate approval before running this command. Apply creates only Trends, their `trend_evidences`, and linked Opportunities in one serializable transaction. Trends are always created as `DRAFT`; the importer never validates, publishes, updates, or deletes records. Exact existing content is a no-op. Partial imports, identifier collisions, changed content, and duplicate provenance stop without applying changes.

The manifest remains pending Product Owner review. Its search signals are historical Google Year in Search 2025 observations, and each linked Opportunity is an unvalidated business hypothesis. Importing does not make any Trend or Opportunity visible in Finder; existing catalog reads require the parent Trend to be published.

## Local lifecycle review and publication

The lifecycle CLI is restricted to the local `venturex_dev` database (`venturex` on loopback port `5432`) and refuses production mode. It does not create a public endpoint or database schema. The audit ledger is stored at `%USERPROFILE%\VENTUREX-private-audit\catalog-lifecycle-audit.jsonl`, outside the repository and web root. The operator must provision that directory with an explicit DACL for the verified operator account, `SYSTEM`, and local Administrators. `VENTUREX_CATALOG_AUDIT_PATH`, when set, must resolve to that exact per-user path; an alternate or relative location is rejected. Each JSONL entry includes the manifest ID and SHA-256, Trend ID, a SHA-256 fingerprint of the Trend, evidence, and linked Opportunity content, an ISO timestamp, the process OS account, the action's declared role, decision, rationale, and evidence limitations. Entries form a hash chain that detects internal edits and reordering. This is limited tamper resistance, not tamper-proof storage: a process sharing the operator's Windows identity can still modify the ledger, an administrator can alter ACLs, and deleting a tail of the file is not detectable without an external checkpoint.

The CLI records the OS account, while the role is self-attested by the command selected. This does not prove that the account holder is the designated factual reviewer or Product/Data Owner. The factual review and Product/Data Owner decision are separate commands, even when one person performs both. Approval and review decisions are not recorded until the user explicitly runs those commands. Lifecycle actions for the same Trend use an exclusive local workflow lock; a stale lock blocks further actions pending manual inspection. Lifecycle state changes require the corresponding prior decision and exact per-Trend confirmation. The CLI records a transition intent before mutation, then records the outcome. Filesystem ledger writes and PostgreSQL transitions cannot be committed atomically; an intent without an outcome blocks further lifecycle actions until an operator reconciles the database state and audit file manually.

Commands below are examples only. They were not run as part of implementation. Read each Trend's factual review package and decide the decision, rationale, and limitations before executing anything.

```powershell
pnpm catalog:lifecycle -- review --trend-id b1200000-2025-5500-8000-000000000001 --decision APPROVED --rationale "<review rationale>" --limitation "Year in Search rank is relative growth, not total search volume or purchase demand." --limitation "The observation is historical and does not establish current interest or commercial viability."
pnpm catalog:lifecycle -- validate --trend-id b1200000-2025-5500-8000-000000000001 --confirm "VALIDATE b1200000-2025-5500-8000-000000000001"
pnpm catalog:lifecycle -- approve-publication --trend-id b1200000-2025-5500-8000-000000000001 --decision APPROVED --rationale "<Product/Data Owner publication decision>"
pnpm catalog:lifecycle -- publish --trend-id b1200000-2025-5500-8000-000000000001 --confirm "PUBLISH b1200000-2025-5500-8000-000000000001"
```

Repeat the review and decision commands for the second Trend using its ID. A `REJECTED` review blocks validation until a later review is approved. A rejected publication decision blocks publication until a later approval is recorded. The command rechecks the exact manifest checksum, stored Trend/evidence/Opportunity content, current lifecycle state, audit-chain integrity, and prior approvals. It calls the shared `assertTrendTransition` domain rule, repeats the existing evidence/relevance/audience requirements, and performs a conditional state update equivalent to the repository's compare-and-set transition. `venturex_dev` must remain DRAFT until a separate Product/Data Owner instruction authorizes specific commands.
