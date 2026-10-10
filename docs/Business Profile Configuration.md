# Business Profile Configuration

**Status:** Frozen MVP configuration
**Effective date:** 28 September 2026
**Scope:** Business Profile onboarding, update semantics, persistence, and shared reference-data contracts

This document is the source of truth for the Business Profile MVP decisions that were previously open. It refines the requirements in the PRD/FSD and the schema/API descriptions without introducing runtime implementation.

## Source traceability

- `PRD-PROFILE-004`
- `PRD-PROFILE-005`
- `FSD-BPRO-001`
- `FSD-BPRO-002`
- `business_profiles`
- `business_products`
- `business_profile_customer_segments`
- `business_profile_sales_channels`
- `PUT /api/v1/profile/business`
- `GET /api/v1/reference/fnb-categories`
- `GET /api/v1/reference/customer-segments`
- `GET /api/v1/reference/sales-channels`

The configuration applies only to Business Profile. Dashboard, Trend, Opportunity, scoring, AI, Roadmap, product history, and Change User Type decisions remain outside this freeze.

## 1. Shared reference data

Business Profile reuses the existing frozen reference tables:

- `fnb_categories`;
- `customer_segments`;
- `sales_channels`.

No Business-specific duplicate master tables or endpoints are created. The existing reference seed remains authoritative: 7 F&B categories, 6 customer segments, and 5 sales channels. These are the same references used by Entrepreneur Profile.

## 2. Business category

`businessCategoryId` is:

- required;
- exactly one value;
- a single-select active `fnb_categories` reference.

Business Profile does not create a new category taxonomy. `CATERING_FOOD_SERVICE` remains a business/F&B category, while `CATERING_B2B` remains a sales channel.

## 3. Current products

The current product collection is required and contains 1 to 20 products. Each product has:

| Field | Rule |
|---|---|
| `name` | Required; normalized; 1–180 characters. |
| `categoryId` | Optional; active `fnb_categories` reference when present. |
| `price` | Optional integer Rupiah; `null` or a value `>= 0`. |

The client does not send `productId` or `isActive`. Product category is never inferred from business category, product name, or AI. A missing product category does not block completion.

### 3.1 Product name normalization

Before validation and comparison, product names are:

1. trimmed;
2. Unicode-normalized;
3. collapsed for internal whitespace;
4. compared case-insensitively.

The normalized name must contain 1–180 characters. Duplicate normalized names are a `VALIDATION_ERROR`; products are never silently deduplicated. For example, `Kopi Susu` and ` kopi   susu ` are duplicates.

### 3.2 Product price

Product price is an integer Rupiah amount. `null` is allowed and an empty UI value becomes `null`. The API never accepts formatted strings such as `Rp25.000`.

## 4. Average price

`averagePrice.min` and `averagePrice.max` are both required and are stored in `average_price_min` and `average_price_max`.

Validation:

- integer Rupiah values;
- `min >= 0`;
- `max >= min`.

No price-band reference master is created.

## 5. Location

Business Profile reuses Entrepreneur Profile location behavior:

| Field | Rule |
|---|---|
| `location.text` | Required human-readable text, maximum 255 characters. |
| `location.city` | Optional. |
| `location.province` | Optional. |
| `country_code` | Server-controlled ID, persisted as `ID`; not authoritative client input. |

MVP does not use Maps, geocoding, coordinates, or automatic city/province inference.

## 6. Customer segments

`customerSegmentIds` is a required multi-select with at least one active `customer_segments` reference.

The server validates UUIDs, removes duplicate IDs, and stores/compares the result in deterministic order. Duplicate IDs are not a validation error. For example, [A, B, A] is semantically [A, B]. This matches Entrepreneur Profile semantic-set behavior.

## 7. Sales channels

`salesChannelIds` is a required multi-select with at least one active `sales_channels` reference. Duplicate IDs are normalized and deduplicated rather than rejected.

The frozen sales-channel values are:

~~~text
OFFLINE_STORE
DELIVERY_PLATFORM
DIRECT_ONLINE
PREORDER_PICKUP
CATERING_B2B
~~~

Channels are generic and not vendor-specific.

## 8. Operation model

The `operation_model` database column remains nullable, but it is not displayed in Business onboarding and is excluded from the MVP PUT request. Its persisted value is `null` for this MVP. `OFFLINE_DELIVERY` is not frozen as an enum, and no Operation Model reference endpoint is created.

The schema may retain `PROFILE_IN_PROGRESS` for compatibility with the broader user-status model, but Business Profile MVP has no draft persistence and does not emit or depend on that state.

## 9. Business description and notes

`businessDescription` is optional plain text:

- trim whitespace;
- empty becomes `null`;
- maximum 1,000 characters;
- no HTML or rich text;
- personalization-relevant, so semantic changes increment `profile_version`.

`notes` is optional plain text:

- trim whitespace;
- empty becomes `null`;
- maximum 2,000 characters;
- stored but not used as personalization/recommendation context in the MVP;
- notes-only changes do not increment `profile_version`.

## 10. Profile version semantics

A new Business Profile starts at `profile_version = 1`.

Increment `profile_version` when a semantic change affects:

- business name;
- business category;
- location;
- average price;
- product set;
- customer segment set;
- sales channel set;
- business description.

Do not increment for:

- notes-only changes;
- reference ordering;
- duplicate reference IDs normalized away;
- a semantically identical normalized payload;
- the unused `operation_model` value.

### 10.1 Product semantic equality

Normalize each product to:

~~~text
normalized name
categoryId or null
price or null
~~~

Product order is irrelevant. Compare the normalized product collection deterministically. Adding, removing, renaming, changing category, or changing price is a semantic change and increments the profile version.

## 11. PUT product semantics

`PUT /api/v1/profile/business` performs full physical replacement of the current product collection for the profile.

Inside the transaction, the application:

1. loads the existing normalized state for semantic comparison;
2. validates the current payload;
3. updates or creates the Business Profile;
4. deletes all existing `business_products` rows for the profile;
5. inserts the normalized current products;
6. replaces both reference junction collections;
7. updates `users.onboarding_status` to `COMPLETED`;
8. commits all writes together.

Every inserted current product has `is_active = true`. Inactive historical product rows are not retained in the MVP. The `is_active` column remains for future evolution, but is not a lifecycle/history mechanism now. The client never sends `productId` or `isActive`, and the MVP does not create product history or fuzzy name matching.

Any failure rolls back the complete transaction.

## 12. Completion rule

Set `users.onboarding_status = COMPLETED` only when all of the following hold:

- the request is authenticated;
- the user has `user_type = UMKM_EXISTING`;
- business name, business category, location, and average price are valid;
- there is at least one valid current product;
- there is at least one active customer segment;
- there is at least one active sales channel;
- all transaction writes succeed.

Optional product category, product price, city, province, business description, and notes do not block completion. No `PROFILE_IN_PROGRESS` draft state is used for this flow.

## 13. Transaction boundary

The conceptual transaction is:

~~~text
BEGIN
validate current DB user
validate scalar payload
validate business category
validate optional product categories
validate customer segments
validate sales channels
load current normalized state
create/update business profile
delete existing product rows
insert current product rows
replace customer segment junctions
replace sales channel junctions
update onboarding_status = COMPLETED
COMMIT
~~~

Failure results in `ROLLBACK ALL`; a partial Business Profile is not valid MVP state.

## 14. Business onboarding steps

Business onboarding has exactly three progressive steps:

### Step 1 — Identitas Bisnis

- business name;
- business category;
- location;
- optional business description.

### Step 2 — Produk dan Harga

- current products;
- optional product category;
- optional product price;
- average price min/max.

### Step 3 — Pelanggan dan Cara Menjual

- customer segments;
- sales channels;
- optional notes.

`operationModel` is not displayed. There is no fourth step.

## 15. Reference API reuse

The existing endpoints are sufficient:

~~~text
GET /api/v1/reference/fnb-categories
GET /api/v1/reference/customer-segments
GET /api/v1/reference/sales-channels
~~~

No Business-specific reference APIs are created.

## 16. Frozen PUT contract

~~~json
{
  "businessName": "Kopi Nusantara",
  "businessCategoryId": "uuid-category",
  "location": {
    "text": "Jakarta Pusat",
    "city": "Jakarta Pusat",
    "province": "DKI Jakarta"
  },
  "averagePrice": {
    "min": 20000,
    "max": 40000
  },
  "products": [
    {
      "name": "Kopi Susu",
      "categoryId": "uuid-category",
      "price": 25000
    },
    {
      "name": "Teh Lemon",
      "categoryId": null,
      "price": null
    }
  ],
  "customerSegmentIds": ["uuid-segment"],
  "salesChannelIds": ["uuid-channel"],
  "businessDescription": "Kedai minuman untuk pelanggan sekitar area perkantoran.",
  "notes": null
}
~~~

The following are never authoritative client fields:

~~~text
userId
userType
onboardingStatus
profileVersion
countryCode
productId
isActive
operationModel
~~~

## 17. Authorization

- Guest → `401 UNAUTHORIZED`.
- `UMKM_EXISTING` → allowed.
- `ENTREPRENEUR` → `403 FORBIDDEN`.
- An authenticated user whose `user_type` is still `null` follows the existing API error convention; no new error code is invented.

The database/current-user state remains authoritative.

## 18. Explicitly unresolved decisions

This freeze does not resolve:

- Dashboard content;
- Trend taxonomy;
- Opportunity types;
- Business Fit weights;
- Risk thresholds;
- AI prompts or provider behavior;
- product history/versioning beyond the MVP replacement rule;
- future Operation Model taxonomy;
- saved opportunities;
- Change User Type.
