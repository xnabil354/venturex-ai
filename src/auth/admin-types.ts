import { z } from "zod";

export const accountTypes = ["ADMIN", "USER"] as const;
export type AccountType = (typeof accountTypes)[number];

export function isAccountType(value: unknown): value is AccountType {
  return value === "ADMIN" || value === "USER";
}

export const adminIdSchema = z.string().uuid().brand<"AdminId">();
export type AdminId = z.infer<typeof adminIdSchema>;

export type AdminRecord = {
  readonly id: AdminId;
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SafeAdmin = Omit<AdminRecord, "passwordHash" | "createdAt" | "updatedAt">;

export function toSafeAdmin(admin: AdminRecord): SafeAdmin {
  return { id: admin.id, email: admin.email };
}
