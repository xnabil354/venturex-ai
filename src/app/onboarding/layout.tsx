import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";

export default async function OnboardingLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  if (!(await getCurrentUser())) {
    redirect("/login");
  }

  return children;
}
