import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

import { AuthService } from "./auth/service";
import { isAccountType } from "./auth/admin-types";
import { isUserType } from "./auth/user-types";

export const authConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = await new AuthService().validateCredentials(credentials);
        if (!user) {
          return null;
        }

        return {
          id: user.account.id,
          email: user.account.email,
          userType: user.accountType === "USER" ? user.account.userType : null,
          accountType: user.accountType,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.userType = user.userType;
        token.accountType = user.accountType;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.userType = isUserType(token.userType) ? token.userType : null;
      session.user.accountType = isAccountType(token.accountType) ? token.accountType : "USER";
      return session;
    },
  },
} satisfies NextAuthConfig;
