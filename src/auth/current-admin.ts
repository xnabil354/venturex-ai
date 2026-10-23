import "server-only";

import { auth } from "@/auth";
import { adminIdSchema, toSafeAdmin, type SafeAdmin } from "@/auth/admin-types";
import { AdminRepository } from "@/db/repositories/admin-repository";

/** Server-side boundary for every admin page and API. ASVS 8.3.1. */
export async function getCurrentAdmin(): Promise<SafeAdmin | null> {
  const session = await auth();
  if (session?.user?.accountType !== "ADMIN" || !session.user.id) return null;
  const parsedId = adminIdSchema.safeParse(session.user.id);
  if (!parsedId.success) return null;
  const admin = await new AdminRepository().findById(parsedId.data);
  return admin ? toSafeAdmin(admin) : null;
}
