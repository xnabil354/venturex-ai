import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, USER_TYPES, isUserType, type SafeUser } from "@/auth/user-types";
import { TrendList } from "@/components/trends/trend-list";
import { notFound } from "next/navigation";
import { getJakartaCurrentYear, getJakartaToday } from "@/trend/trend-radar-contract";
import { resolveTrendRadarProfileQuery } from "@/trend/trend-radar-service";
import { BusinessProfileService } from "@/profile/business-service";
import { ReferenceRepository } from "@/reference/repository";
import { businessQueryOptions } from "@/trend/business-query-options";
import { BusinessQuerySelect } from "@/components/trends/business-query-select";

async function getProfileSearchTerm(userId: SafeUser["id"], userType: typeof USER_TYPES[keyof typeof USER_TYPES]): Promise<string> {
  try {
    return await resolveTrendRadarProfileQuery(userId, userType);
  } catch {
    return "";
  }
}

export default async function TrendsPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ queryKey?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
    notFound();
  }
  const params = await searchParams;
  const queryOptions = user.userType === "UMKM_EXISTING" ? await (async () => { const profile = await new BusinessProfileService().getForEdit(user.id); const refs = await new ReferenceRepository().listActiveFnbCategories(); return businessQueryOptions(profile, refs.find(c => c.id === profile.businessCategoryId)?.name); })() : [];
  const queryKey = queryOptions.some(o => o.key === params.queryKey) ? params.queryKey! : "business";
  const productQuery = queryOptions.find(o => o.key === queryKey)?.query ?? await getProfileSearchTerm(user.id, user.userType);
  const now = new Date();
  return (
    <div className="relative isolate min-h-[calc(100dvh-64px)] bg-warm-parchment">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/Cozy%20Coffee%2C%20Croissant%2C%20and%20Blueberries.png')" }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-paper-white/85" />
      <div className="relative z-10">
        {queryOptions.length ? <BusinessQuerySelect options={queryOptions} selected={queryKey} /> : null}
        <TrendList
          key={queryKey}
          {...(user.userType === "UMKM_EXISTING" ? { queryKey } : {})}
          viewerId={user.id}
          currentYear={getJakartaCurrentYear(now)}
          productQuery={productQuery}
          today={getJakartaToday(now)}
        />
      </div>
    </div>
  );
}
