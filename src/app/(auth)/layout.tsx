import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { getCurrentAdmin } from "@/auth/current-admin";
import { resolvePostLoginDestination } from "@/auth/routing";
import { AuthLayout } from "@/components/auth/auth-layout";

export default async function AuthenticationLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getCurrentUser();
  if (user) {
    redirect(resolvePostLoginDestination(user));
  }
  if (await getCurrentAdmin()) {
    redirect("/admin/dashboard");
  }

  return <AuthLayout>{children}</AuthLayout>;
}
