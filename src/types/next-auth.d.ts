import type { DefaultSession } from "next-auth";
import type { UserType } from "../auth/user-types";
import type { AccountType } from "../auth/admin-types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userType: UserType | null;
      accountType: AccountType;
    } & DefaultSession["user"];
  }

  interface User {
    userType: UserType | null;
    accountType: AccountType;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    userType: UserType | null;
    accountType: AccountType;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userType?: UserType | null;
    accountType?: AccountType;
  }
}
