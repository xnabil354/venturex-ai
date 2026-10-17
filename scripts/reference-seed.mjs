import { Sequelize } from "sequelize";
import { z } from "zod";

const envSchema = z.object({ DATABASE_URL: z.string().url() });

const categories = [
  ["10000000-0000-4000-8000-000000000001", "BEVERAGES", "Minuman"],
  ["10000000-0000-4000-8000-000000000002", "MAIN_MEALS", "Makanan utama"],
  ["10000000-0000-4000-8000-000000000003", "SNACKS", "Camilan"],
  ["10000000-0000-4000-8000-000000000004", "BAKERY_DESSERTS", "Roti dan dessert"],
  ["10000000-0000-4000-8000-000000000005", "FROZEN_READY_TO_COOK", "Frozen dan siap masak"],
  ["10000000-0000-4000-8000-000000000006", "HEALTHY_SPECIALTY", "Sehat dan kebutuhan khusus"],
  ["10000000-0000-4000-8000-000000000007", "CATERING_FOOD_SERVICE", "Katering dan layanan makanan"],
  ["10000000-0000-4000-8000-000000000008", "OTHER", "Lainnya"],
];

const customerSegments = [
  ["20000000-0000-4000-8000-000000000001", "STUDENTS", "Pelajar dan mahasiswa", "Konsumen yang mencari pilihan terjangkau dan praktis."],
  ["20000000-0000-4000-8000-000000000002", "OFFICE_WORKERS", "Pekerja kantor dan komuter", "Konsumen yang membutuhkan kecepatan dan konsumsi rutin."],
  ["20000000-0000-4000-8000-000000000003", "FAMILIES", "Keluarga", "Konsumsi bersama dan kebutuhan rumah tangga."],
  ["20000000-0000-4000-8000-000000000004", "VALUE_SEEKERS", "Konsumen yang mencari value", "Memprioritaskan keseimbangan harga, porsi, dan manfaat."],
  ["20000000-0000-4000-8000-000000000005", "HEALTH_CONSCIOUS", "Konsumen yang memperhatikan kesehatan", "Memperhatikan komposisi, keseimbangan, atau kebutuhan diet tertentu."],
  ["20000000-0000-4000-8000-000000000006", "CONVENIENCE_SEEKERS", "Konsumen yang mengutamakan kepraktisan", "Memprioritaskan delivery, pre-order, pickup, dan kemudahan konsumsi."],
];

const salesChannels = [
  ["30000000-0000-4000-8000-000000000001", "OFFLINE_STORE", "Gerai atau toko offline"],
  ["30000000-0000-4000-8000-000000000002", "DELIVERY_PLATFORM", "Platform delivery"],
  ["30000000-0000-4000-8000-000000000003", "DIRECT_ONLINE", "Penjualan langsung online"],
  ["30000000-0000-4000-8000-000000000004", "PREORDER_PICKUP", "Pre-order dan pickup"],
  ["30000000-0000-4000-8000-000000000005", "CATERING_B2B", "Katering dan B2B"],
];

const env = envSchema.parse(process.env);
const sequelize = new Sequelize(env.DATABASE_URL, { dialect: "postgres", logging: false });

async function insertCategory(id, code, name, transaction) {
  await sequelize.query(
    `
      INSERT INTO "fnb_categories"
        ("id", "code", "name", "parent_id", "is_active", "created_at", "updated_at")
      VALUES (:id, :code, :name, NULL, TRUE, NOW(), NOW())
      ON CONFLICT ("code") DO UPDATE
      SET "name" = EXCLUDED."name", "is_active" = TRUE, "updated_at" = NOW()
    `,
    { replacements: { id, code, name }, transaction },
  );
}

async function insertCustomerSegment(id, code, name, description, transaction) {
  await sequelize.query(
    `
      INSERT INTO "customer_segments"
        ("id", "code", "name", "description", "is_active", "created_at", "updated_at")
      VALUES (:id, :code, :name, :description, TRUE, NOW(), NOW())
      ON CONFLICT ("code") DO UPDATE
      SET "name" = EXCLUDED."name", "description" = EXCLUDED."description",
          "is_active" = TRUE, "updated_at" = NOW()
    `,
    { replacements: { id, code, name, description }, transaction },
  );
}

async function insertSalesChannel(id, code, name, transaction) {
  await sequelize.query(
    `
      INSERT INTO "sales_channels"
        ("id", "code", "name", "is_active", "created_at", "updated_at")
      VALUES (:id, :code, :name, TRUE, NOW(), NOW())
      ON CONFLICT ("code") DO UPDATE
      SET "name" = EXCLUDED."name", "is_active" = TRUE, "updated_at" = NOW()
    `,
    { replacements: { id, code, name }, transaction },
  );
}

async function main() {
  await sequelize.authenticate();
  await sequelize.transaction(async (transaction) => {
    for (const [id, code, name] of categories) {
      await insertCategory(id, code, name, transaction);
    }
    for (const [id, code, name, description] of customerSegments) {
      await insertCustomerSegment(id, code, name, description, transaction);
    }
    for (const [id, code, name] of salesChannels) {
      await insertSalesChannel(id, code, name, transaction);
    }
  });
  console.info("Reference seed applied: 8 categories, 6 customer segments, 5 sales channels");
}

// no-excuse-ok: catch — CLI boundary reports failure without exposing credentials.
main()
  .catch((error) => {
    console.error("Reference seed failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
