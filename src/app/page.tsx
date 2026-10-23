import { LandingPage } from "@/components/landing";
import { getPublicPricingSnapshot } from "@/billing/public-pricing";
import { getCurrentUser } from "@/auth/current-user";
import { connection } from "next/server";

export default async function HomePage() {
  await connection();
  // ASVS 8.3.1: determine the authenticated route on the trusted server,
  // while /billing retains its own server-side authorization enforcement.
  const [pricing, user] = await Promise.all([
    getPublicPricingSnapshot().catch(() => null),
    getCurrentUser().catch(() => null),
  ]);

  return <LandingPage isAuthenticated={user !== null} pricing={pricing} />;
}
