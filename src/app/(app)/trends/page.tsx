import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, USER_TYPES, isUserType, type SafeUser } from "@/auth/user-types";
import { TrendList } from "@/components/trends/trend-list";
import { notFound } from "next/navigation";
import { isPublicHttpTransport, readLocalProfileNineRouterConfig } from "@/ai-analysis/ninerouter";
import { EntrepreneurProfileService } from "@/profile/service";
import { BusinessProfileService } from "@/profile/business-service";

async function getProfileSearchTerm(userId: SafeUser["id"], userType: typeof USER_TYPES[keyof typeof USER_TYPES]): Promise<string> {
  try {
    if (userType === USER_TYPES.ENTREPRENEUR) {
      const profile = await new EntrepreneurProfileService().getForEdit(userId);
      return (profile.preferredProductType ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").trim().slice(0, 80);
    }
    const profile = await new BusinessProfileService().getForEdit(userId);
    return (profile.products[0]?.name ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").trim().slice(0, 80);
  } catch {
    return "";
  }
}

export default async function TrendsPage() {
  const user = await getCurrentUser();
  if (!user || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED || !isUserType(user.userType)) {
    notFound();
  }
  const initialKeyword = await getProfileSearchTerm(user.id, user.userType);
  return <TrendList initialKeyword={initialKeyword} publicHttpTransport={isPublicHttpTransport(readLocalProfileNineRouterConfig()?.baseURL)} />;
}
