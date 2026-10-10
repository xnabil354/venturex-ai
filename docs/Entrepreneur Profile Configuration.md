# Entrepreneur Profile Configuration

**Status:** Frozen MVP configuration
**Effective date:** 28 September 2026
**Scope:** Entrepreneur Profile onboarding and its reference-data contracts

This document is the source of truth for the MVP configuration decisions that were previously open for Entrepreneur Profile implementation.

## Source traceability

- `PRD-PROFILE-001`
- `PRD-PROFILE-002`
- `PRD-PROFILE-003`
- `FSD-EPRO-001`
- `FSD-EPRO-002`
- `entrepreneur_profiles`
- `PUT /api/v1/profile/entrepreneur`
- `GET /api/v1/reference/fnb-categories`
- `GET /api/v1/reference/customer-segments`
- `GET /api/v1/reference/sales-channels`

This document freezes only Entrepreneur Profile configuration. Business Profile, Trend, Opportunity, scoring, AI, and roadmap decisions remain governed by their existing open-decision sections.

## 1. F&B categories

All MVP categories are top-level records with `parent_id = null`.

| Code | Display name | Rationale |
|---|---|---|
| `BEVERAGES` | Minuman | Broad beverage category without premature ingredient or style taxonomy. |
| `MAIN_MEALS` | Makanan utama | Covers ready-to-eat main meals and menu concepts. |
| `SNACKS` | Camilan | Covers quick-service and light-food concepts. |
| `BAKERY_DESSERTS` | Roti dan dessert | Keeps adjacent bakery and dessert concepts together for MVP discovery. |
| `FROZEN_READY_TO_COOK` | Frozen dan siap masak | Covers frozen and ready-to-cook products. |
| `HEALTHY_SPECIALTY` | Sehat dan kebutuhan khusus | Covers health-oriented and specialty food concepts without sensitive classification. |
| `CATERING_FOOD_SERVICE` | Katering dan layanan makanan | A business/product category for catering and food-service concepts. |

`CATERING_FOOD_SERVICE` is a business/product category. It must not be confused with `CATERING_B2B`, which is a sales channel.

## 2. Customer segments

Customer segments are non-exclusive and multi-select. They are broad targeting contexts, not sensitive personal classifications.

| Code | Display name | Description |
|---|---|---|
| `STUDENTS` | Pelajar dan mahasiswa | Konsumen yang mencari pilihan terjangkau dan praktis. |
| `OFFICE_WORKERS` | Pekerja kantor dan komuter | Konsumen yang membutuhkan kecepatan dan konsumsi rutin. |
| `FAMILIES` | Keluarga | Konsumsi bersama dan kebutuhan rumah tangga. |
| `VALUE_SEEKERS` | Konsumen yang mencari value | Memprioritaskan keseimbangan harga, porsi, dan manfaat. |
| `HEALTH_CONSCIOUS` | Konsumen yang memperhatikan kesehatan | Memperhatikan komposisi, keseimbangan, atau kebutuhan diet tertentu. |
| `CONVENIENCE_SEEKERS` | Konsumen yang mengutamakan kepraktisan | Memprioritaskan delivery, pre-order, pickup, dan kemudahan konsumsi. |

## 3. Sales channels

Sales channels are shared by Entrepreneur Profile, Business Profile, and future Opportunity Fit logic. They are not vendor-specific.

| Code | Display name | Rationale |
|---|---|---|
| `OFFLINE_STORE` | Gerai atau toko offline | Direct transactions at a physical location. |
| `DELIVERY_PLATFORM` | Platform delivery | Aggregated delivery distribution without binding the product to a vendor. |
| `DIRECT_ONLINE` | Penjualan langsung online | Direct sales through WhatsApp, social commerce, or owned online channels. |
| `PREORDER_PICKUP` | Pre-order dan pickup | Made-to-order or scheduled collection model. |
| `CATERING_B2B` | Katering dan B2B | Catering, office, event, reseller, and bulk-order channel. |

Vendor names such as GoFood or GrabFood are not master values.

## 4. Experience level

| Code | Display name | Definition |
|---|---|---|
| `BEGINNER` | Baru memulai | Belum pernah menjalankan usaha F&B secara nyata. |
| `SOME_EXPERIENCE` | Pernah mencoba | Pernah terlibat dalam penjualan kecil, proyek, atau usaha sederhana tetapi belum konsisten. |
| `EXPERIENCED` | Berpengalaman | Pernah menjalankan atau mengelola operasi usaha F&B secara rutin. |

## 5. Time commitment

| Code | Display name | Definition |
|---|---|---|
| `LIMITED` | Waktu terbatas | Hanya tersedia pada waktu tertentu dan tidak dapat menjalankan aktivitas secara rutin setiap hari. |
| `PART_TIME` | Paruh waktu | Dapat menyediakan waktu rutin di luar pekerjaan atau kewajiban utama. |
| `FULL_TIME` | Fokus penuh waktu | Siap menjadikan usaha sebagai aktivitas utama. |

The MVP does not convert these values into hours per week.

## 6. Budget behavior

Budget uses direct numeric integer Rupiah values:

```json
{
  "budget": {
    "min": 5000000,
    "max": 10000000
  }
}
```

Persistence and API fields:

- `budget_min`
- `budget_max`

Validation:

- `min >= 0`;
- `max >= min`;
- both values are integer Rupiah;
- no predefined budget-band master is created.

The UI may provide helper presets, but persisted source of truth remains numeric min/max. Budget is an estimated capital range, not a guaranteed measure of financial capacity.

## 7. Location behavior

| Field | MVP behavior |
|---|---|
| `location_text` | Required, human-readable, maximum 255 characters. |
| `city` | Optional. |
| `province` | Optional. |
| `country_code` | Server default `ID`. |

The MVP does not use Maps API, geocoding, coordinates, or automatic city/province inference.

## 8. Preferred product type

`preferred_product_type` remains optional free text backed by `VARCHAR(100)`.

Rules:

- trim whitespace;
- maximum 100 characters;
- empty value may be stored as `null`;
- no additional reference table.

It is context for personalization, not a replacement for the F&B category master.

## 9. Entrepreneur onboarding steps

The onboarding form uses three progressive steps. There is no separate review step.

### Step 1: Lokasi dan Minat

- location;
- interest/category.

### Step 2: Budget dan Target Pelanggan

- budget min/max;
- customer segments.

### Step 3: Cara Menjalankan Usaha

- preferred sales channels;
- experience level;
- time commitment;
- preferred product type, optional;
- business objective, optional;
- notes, optional.

Step 3 may show a confirmation summary before final submit. MVP does not persist drafts separately.

## 10. Profile completion

`onboarding_status = COMPLETED` is set only after one successful transaction:

```text
BEGIN
validate scalar fields
validate active reference IDs
create or update entrepreneur profile
replace interest junctions
replace customer segment junctions
replace sales channel junctions
set onboarding_status = COMPLETED
COMMIT
```

Any failure rolls the transaction back. Optional fields do not block completion.

Completion requires:

- valid location;
- valid budget;
- valid experience level;
- valid time commitment;
- at least one interest;
- at least one customer segment;
- at least one sales channel;
- successful transaction commit.

## 11. Profile version

- A new profile starts at `profile_version = 1`.
- The version increases only when personalization-relevant semantic data changes.
- A no-op update leaves the version unchanged.

Versioned fields:

- location;
- budget;
- experience level;
- time commitment;
- interest set;
- customer segment set;
- sales channel set;
- preferred product type;
- business objective.

`notes` is intentionally excluded from profile-version invalidation in the MVP. Notes are stored, but do not invalidate cached recommendation or analysis context because notes are not currently defined as a personalization input.

Before comparison:

- trim strings;
- normalize relevant values;
- sort junction IDs;
- deduplicate junction IDs.

If future AI or recommendation logic uses notes as input, versioning behavior requires a requirement change.

## 12. Reference seed strategy

Reference seed covers only:

- `fnb_categories`;
- `customer_segments`;
- `sales_channels`.

Rules:

- stable machine-readable codes;
- deterministic fixed UUIDs;
- idempotent upsert by `code`;
- transaction-protected seed execution;
- separate from Trend and Opportunity demo seed;
- no automatic deletion of existing referenced rows.

Seed implementation is intentionally outside this documentation commit.

## 13. Reference API contracts

Endpoints:

```text
GET /api/v1/reference/fnb-categories
GET /api/v1/reference/customer-segments
GET /api/v1/reference/sales-channels
```

Default behavior:

- return active rows only;
- deterministic ordering;
- no pagination for MVP;
- do not expose timestamps or internal database metadata.

DTOs:

### F&B category

```text
id
code
name
parentId
```

### Customer segment

```text
id
code
name
description
```

### Sales channel

```text
id
code
name
```

Responses continue to use the standard VENTUREX success envelope and request ID.

## 14. Explicitly unresolved decisions

This freeze does not resolve:

- Opportunity Score weights;
- Fit Score weights;
- Risk thresholds;
- Confidence formula;
- Opportunity type values;
- Trend taxonomy;
- external data source and refresh interval;
- Business Profile configuration;
- AI prompt/versioning behavior;
- Change User Type behavior.
