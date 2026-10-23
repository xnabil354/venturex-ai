# Trend Evidence Provenance Foundation

## Scope

Migration `017-create-trend-evidence-provenances.ts` adds optional, structured metadata for a `trend_evidences` row. Its primary key is also a foreign key to that evidence row, so provenance is one-to-zero-or-one and deleting evidence cascades to its metadata. Historical evidence remains valid without a provenance row.

The current internal source allowlist is limited to Google Year in Search Indonesia 2025 and Google Trends Trending Now Indonesia. `original_publisher` records Google separately from `transport_provider`; Bright Data is represented only as the SERP API transport intermediary for the latter source. The linked evidence record remains the source of the original reference URL and evidence limitations, avoiding duplicated values.

## Unknown and bounded fields

Retrieval time is separate from the observation period. A missing observation period uses an explicit status and null boundaries; retrieval time or a provider's `started_at` value must not be substituted for observation-period dates. Geography is either the approved `ID` code or null. Metric entries have a bounded allowlist of names, explicit availability, semantic availability, and unit availability. Metric values are nullable and validated; no score, metric meaning, or unit is inferred.

The JSONB field stores only the bounded metric metadata shape, not a complete provider response. Raw provider payloads, credentials, headers, cookies, user profiles, and actual Bright Data response records are outside this schema's approved use. Licensing, retention, and attribution rights remain open; persisting real provider output requires separate approval.

## Review lifecycle compatibility

The current catalog lifecycle fingerprint remains unchanged and does not include this optional relation. Existing factual reviews and published records therefore retain their current behavior in this batch. The lifecycle snapshot loader also remains unchanged.

`src/catalog/catalog-fingerprint.ts` now prepares a separate, explicit fingerprint version 2 for Trend plus Evidence content. It includes the Trend's factual fields, the Evidence identity and source claims, and the validated provenance fields. Provenance retrieval time is included. Evidence, metric, and audience ordering is canonicalized. Lifecycle state and record creation/update timestamps are accepted as snapshot metadata but excluded from the hash. The schema rejects unknown fields, including Opportunity data and raw provider payloads, and rejects credential-bearing URL query parameter names in source references. A missing provenance relation is represented as `null`; a missing relation property is invalid, so absence cannot be confused with an omitted contract field.

Fingerprint version 1 remains the default only for unlabelled historical lifecycle-shaped snapshots, and its canonicalization is unchanged. A v2-shaped snapshot without an explicit version is rejected; versioned comparison requires the approval metadata to carry the same version. This is a preparation API only: the active lifecycle path, lifecycle transitions, audit event schema, audit writes, and existing approvals are not integrated with v2. No lifecycle transitions are implemented by this foundation.

`loadVersionedCatalogLifecycleSnapshot` is an isolated preparation loader. Callers must request version 1 or 2 explicitly. Version 1 delegates to the historical snapshot query, including its existing Opportunity projection. Version 2 joins optional provenance to Trend Evidence, returns `null` for evidence without a provenance row, validates the complete snapshot, and does not query Opportunity. It is not called by `CatalogLifecycleService`.

Before a future workflow relies on provenance-aware fingerprints for factual approval, a separately approved lifecycle change must load the provenance relation, record the fingerprint version in review/approval audit events, and require a new factual review whenever hashed Trend, Evidence, or provenance content changes. Existing fingerprint-version-1 approvals must not be silently reinterpreted or invalidated; migration to a new lifecycle contract requires separate Product Owner approval.
