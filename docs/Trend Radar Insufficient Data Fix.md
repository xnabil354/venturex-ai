# Trend Radar: successful insufficient-data responses

## Reproduction and cause (22 October 2026)

Existing business product `ayam geprek carbonara`, Indonesia (`ID`), Web,
last 24 hours (`now 1-d`), category 0, timezone -420.
Two direct SearchApi requests returned HTTP 200, metadata status `Success`,
and the exact error `Your search doesn't have enough data to show here`.
Neither response contained its requested dataset:

- RELATED_QUERIES: `search_Lmagj14Ooqu606Yrl45E8MQp`.
- GEO_MAP / REGION: `search_mMjwVJvBznT151B69vynp5OY`.

The normalizers previously required dataset fields, misclassifying this known
successful no-data envelope as `PROVIDER_RESPONSE_INVALID` (application 502).
Independent time-series data can still exist for the same filters.

## Correction

Only the exact observed insufficient-data message with metadata status `Success`
is normalized as an empty dataset. Related queries become empty Top/Rising lists;
regional interest becomes an empty region list; time series becomes empty points
with a null average if it receives the same envelope. Missing datasets without
that explicit envelope and other provider errors still fail validation.

The existing cache TTL, request coalescing, per-dataset cache keys and request
budget also apply to these empty results. There is no automatic retry or silent
change of query, region or period, avoiding repeated calls for a legitimate empty
result and preserving evidence provenance. Empty-state copy suggests a longer
period or wider region. Provider credentials and configuration are unchanged.

## Verification

- Five targeted Vitest files: 46 tests passed, including all three empty dataset
  responses, cache reuse, rejection of unknown errors, routes, service and UI.
- Targeted ESLint passed.
- Live browser, Existing business, same product and filters: a fresh load showed
  empty related queries, a retained time-series graph (181 points), and empty
  regional interest; neither former format error remained.

Google Trends can withhold data for low-volume terms. Empty data is not a zero
market-size claim and cannot be made available by increasing API timeouts.
Reference: https://support.google.com/trends/answer/4365533
