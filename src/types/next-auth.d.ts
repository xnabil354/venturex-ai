import type { DefaultSession } from "next-auth";
import type { UserType } from "../auth/user-types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userType: UserType | null;
    } & DefaultSession["user"];
  }

  interface User {
    userType: UserType | null;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    userType: UserType | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userType?: UserType | null;
  }
}
