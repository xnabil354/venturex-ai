import "server-only";

import { QueryTypes } from "sequelize";

import { adminIdSchema, type AdminId, type AdminRecord } from "@/auth/admin-types";
import { normalizeEmail } from "@/auth/validation";
import { getSequelize } from "@/db/sequelize";

type AdminRow = {
  readonly id: string;
  readonly email: string;
  readonly password_hash: string;
  readonly created_at: Date;
  readonly updated_at: Date;
};

function toAdminRecord(row: AdminRow): AdminRecord {
  return {
    id: adminIdSchema.parse(row.id),
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AdminRepository {
  async findById(id: AdminId): Promise<AdminRecord | null> {
    const [row] = await getSequelize().query<AdminRow>(
      "SELECT id, email, password_hash, created_at, updated_at FROM admins WHERE id = $1",
      { bind: [id], type: QueryTypes.SELECT },
    );
    return row ? toAdminRecord(row) : null;
  }

  async findByEmail(email: string): Promise<AdminRecord | null> {
    const [row] = await getSequelize().query<AdminRow>(
      "SELECT id, email, password_hash, created_at, updated_at FROM admins WHERE email = $1",
      { bind: [normalizeEmail(email)], type: QueryTypes.SELECT },
    );
    return row ? toAdminRecord(row) : null;
  }
}
