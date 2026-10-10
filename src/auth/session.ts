import "server-only";

import { auth } from "../auth";

export class UnauthorizedError extends Error {
  override readonly name = "UnauthorizedError";

  constructor() {
    super("Authentication required.");
  }
}

export async function requireAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return session.user;
}