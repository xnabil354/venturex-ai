import "server-only";

import { auth } from "../auth";
import { UserRepository } from "../db/repositories/user-repository";
import { toSafeUser, userIdSchema, type SafeUser } from "./user-types";

export async function getCurrentUser(): Promise<SafeUser | null> {
  const session = await auth();
  if (session?.user?.accountType !== "USER") return null;
  const rawUserId = session?.user?.id;

  if (!rawUserId) {
    return null;
  }

  const parsedUserId = userIdSchema.safeParse(rawUserId);
  if (!parsedUserId.success) {
    return null;
  }

  const user = await new UserRepository().findById(parsedUserId.data);
  return user && !user.loginDisabledAt ? toSafeUser(user) : null;
}
