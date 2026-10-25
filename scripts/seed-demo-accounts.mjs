import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import pg from "pg";

const REQUIRED_DATABASE = "venturex_dev";
const TRIAL_CREDITS = 5;
const CATEGORIES = ["BEVERAGES", "SNACKS", "MAIN_MEALS"];
const SEGMENTS = ["OFFICE_WORKERS", "STUDENTS", "CONVENIENCE_SEEKERS", "FAMILIES"];
const CHANNELS = ["OFFLINE_STORE", "DELIVERY_PLATFORM", "DIRECT_ONLINE", "PREORDER_PICKUP"];

const entrepreneur = {
  email: "entrepreneur@example.com",
  locationText: "Koridor Jl. MT Haryono / Sungai Ampal, Damai Baru, Balikpapan Selatan, Kota Balikpapan, Kalimantan Timur",
  city: "Kota Balikpapan",
  province: "Kalimantan Timur",
  district: "Balikpapan Selatan",
  subdistrict: "Damai Baru",
  budgetMin: 75_000_000,
  budgetMax: 150_000_000,
  experienceLevel: "SOME_EXPERIENCE",
  timeCommitment: "FULL_TIME",
  preferredProductType: "dirty latte -86",
  businessObjective: "Menguji konsep coffee shop modern di koridor MT Haryono dengan menu terjangkau, layanan cepat, dan potensi pembelian berulang.",
  notes: "Memulai dengan kedai berukuran kecil, layanan takeaway dan delivery, serta area duduk terbatas. Ingin menguji menu dan permintaan sebelum memperbesar kapasitas.",
  categories: ["BEVERAGES", "SNACKS"],
  segments: ["OFFICE_WORKERS", "STUDENTS", "CONVENIENCE_SEEKERS"],
  channels: ["OFFLINE_STORE", "DELIVERY_PLATFORM", "DIRECT_ONLINE"],
};

const business = {
  email: "umkmexisting@example.com",
  name: "Dapur Sudirman Balikpapan",
  category: "MAIN_MEALS",
  locationText: "Koridor Jl. Jend. Sudirman, Klandasan Ulu, Balikpapan Kota, Kota Balikpapan, Kalimantan Timur",
  city: "Kota Balikpapan",
  province: "Kalimantan Timur",
  district: "Balikpapan Kota",
  subdistrict: "Klandasan Ulu",
  averagePriceMin: 25_000,
  averagePriceMax: 55_000,
  description: "Restoran masakan Indonesia untuk makan siang dan malam, melayani pelanggan kawasan perkantoran serta pesanan takeaway dan delivery.",
  notes: "Ingin meningkatkan pesanan makan siang pada hari kerja, mempercepat layanan saat jam sibuk, dan mengevaluasi menu yang paling diminati.",
  segments: ["OFFICE_WORKERS", "FAMILIES", "CONVENIENCE_SEEKERS"],
  channels: ["OFFLINE_STORE", "DELIVERY_PLATFORM", "PREORDER_PICKUP"],
  products: [
    { name: "Nasi Ayam Bakar Sambal Raja", category: "MAIN_MEALS", price: 38_000 },
    { name: "Nasi Ikan Bakar", category: "MAIN_MEALS", price: 48_000 },
    { name: "Nasi Goreng Kampung", category: "MAIN_MEALS", price: 32_000 },
    { name: "Es Teh Lemon", category: "BEVERAGES", price: 25_000 },
  ],
};

function connectionUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL wajib tersedia.");
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && database === REQUIRED_DATABASE)) {
    throw new Error("Seed demo hanya boleh dijalankan pada venturex_dev di localhost.");
  }
  return raw;
}

function requiredPassword() {
  const password = process.env.VENTUREX_DUMMY_PASSWORD;
  if (!password || password.length < 8 || password.length > 128) {
    throw new Error("VENTUREX_DUMMY_PASSWORD wajib berisi 8–128 karakter.");
  }
  return password;
}

async function referenceMap(client, table, codes) {
  const result = await client.query(`SELECT id, code FROM ${table} WHERE code = ANY($1::text[]) AND is_active = true`, [codes]);
  const map = new Map(result.rows.map((row) => [row.code, row.id]));
  const missing = codes.filter((code) => !map.has(code));
  if (missing.length) throw new Error(`Referensi ${table} tidak aktif atau tidak ada: ${missing.join(", ")}`);
  return map;
}

async function createUser(client, email, userType, passwordHash) {
  const id = randomUUID();
  await client.query(
    "INSERT INTO users (id, email, password_hash, user_type, onboarding_status, created_at, updated_at) VALUES ($1, $2, $3, $4, 'COMPLETED', NOW(), NOW())",
    [id, email, passwordHash, userType],
  );
  return id;
}

async function createTrial(client, userId) {
  const lotId = randomUUID();
  await client.query("INSERT INTO billing_accounts (user_id) VALUES ($1)", [userId]);
  await client.query(
    "INSERT INTO credit_lots (id, user_id, source, initial_credits, remaining_credits) VALUES ($1, $2, 'TRIAL', $3, $3)",
    [lotId, userId, TRIAL_CREDITS],
  );
  await client.query(
    "INSERT INTO credit_ledger_entries (id, user_id, lot_id, kind, credits_delta, reference) VALUES ($1, $2, $3, 'GRANT', $4, $5)",
    [randomUUID(), userId, lotId, TRIAL_CREDITS, `trial:${userId}`],
  );
  await client.query("SELECT pg_notify('venturex_billing_changed', $1)", [userId]);
}

async function createEntrepreneur(client, passwordHash, categories, segments, channels) {
  const userId = await createUser(client, entrepreneur.email, "ENTREPRENEUR", passwordHash);
  const profileId = randomUUID();
  await client.query(
    `INSERT INTO entrepreneur_profiles
      (id, user_id, location_text, city, province, district, subdistrict, country_code,
       budget_min, budget_max, experience_level, time_commitment, preferred_product_type,
       business_objective, notes, profile_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ID', $8, $9, $10, $11, $12, $13, $14, 1, NOW(), NOW())`,
    [profileId, userId, entrepreneur.locationText, entrepreneur.city, entrepreneur.province,
      entrepreneur.district, entrepreneur.subdistrict, entrepreneur.budgetMin, entrepreneur.budgetMax,
      entrepreneur.experienceLevel, entrepreneur.timeCommitment, entrepreneur.preferredProductType,
      entrepreneur.businessObjective, entrepreneur.notes],
  );
  for (const code of entrepreneur.categories) {
    await client.query("INSERT INTO entrepreneur_profile_interests (entrepreneur_profile_id, fnb_category_id) VALUES ($1, $2)", [profileId, categories.get(code)]);
  }
  for (const code of entrepreneur.segments) {
    await client.query("INSERT INTO entrepreneur_profile_customer_segments (entrepreneur_profile_id, customer_segment_id) VALUES ($1, $2)", [profileId, segments.get(code)]);
  }
  for (const code of entrepreneur.channels) {
    await client.query("INSERT INTO entrepreneur_profile_sales_channels (entrepreneur_profile_id, sales_channel_id) VALUES ($1, $2)", [profileId, channels.get(code)]);
  }
  await createTrial(client, userId);
}

async function createBusiness(client, passwordHash, categories, segments, channels) {
  const userId = await createUser(client, business.email, "UMKM_EXISTING", passwordHash);
  const profileId = randomUUID();
  await client.query(
    `INSERT INTO business_profiles
      (id, user_id, business_name, business_category_id, location_text, city, province,
       district, subdistrict, country_code, average_price_min, average_price_max,
       business_description, operation_model, notes, profile_version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ID', $10, $11, $12, NULL, $13, 1, NOW(), NOW())`,
    [profileId, userId, business.name, categories.get(business.category), business.locationText,
      business.city, business.province, business.district, business.subdistrict,
      business.averagePriceMin, business.averagePriceMax, business.description, business.notes],
  );
  for (const product of business.products) {
    await client.query(
      "INSERT INTO business_products (id, business_profile_id, name, fnb_category_id, price, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())",
      [randomUUID(), profileId, product.name, categories.get(product.category), product.price],
    );
  }
  for (const code of business.segments) {
    await client.query("INSERT INTO business_profile_customer_segments (business_profile_id, customer_segment_id) VALUES ($1, $2)", [profileId, segments.get(code)]);
  }
  for (const code of business.channels) {
    await client.query("INSERT INTO business_profile_sales_channels (business_profile_id, sales_channel_id) VALUES ($1, $2)", [profileId, channels.get(code)]);
  }
  await createTrial(client, userId);
}

async function main() {
  const url = connectionUrl();
  const password = requiredPassword();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const identity = await client.query("SELECT current_database() AS database_name");
    if (identity.rows[0]?.database_name !== REQUIRED_DATABASE) throw new Error("Identitas database tidak cocok.");
    console.info(`Target seed: ${REQUIRED_DATABASE} (localhost)`);
    await client.query("BEGIN");
    const existing = await client.query("SELECT email FROM users WHERE lower(email) = ANY($1::text[])", [[entrepreneur.email, business.email]]);
    if (existing.rowCount) throw new Error(`Akun sudah ada: ${existing.rows.map((row) => row.email).join(", ")}. Tidak ada data yang ditimpa.`);
    const categories = await referenceMap(client, "fnb_categories", CATEGORIES);
    const segments = await referenceMap(client, "customer_segments", SEGMENTS);
    const channels = await referenceMap(client, "sales_channels", CHANNELS);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await createEntrepreneur(client, passwordHash, categories, segments, channels);
    await createBusiness(client, passwordHash, categories, segments, channels);
    await client.query("COMMIT");
    console.info("Seed berhasil: 2 akun, 2 profil lengkap, 4 produk, dan 5 kredit trial per akun.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Seed gagal: ${error instanceof Error ? error.message : "kesalahan tidak diketahui"}`);
  process.exitCode = 1;
});
