import "server-only";
import { USER_TYPES, type SafeUser } from "@/auth/user-types";
import { BusinessProfileService } from "@/profile/business-service";
import { EntrepreneurProfileService } from "@/profile/service";
import { ReferenceRepository } from "@/reference/repository";
import { businessQueryOptions } from "@/trend/business-query-options";
import type { TopicOption } from "./contract";

export async function notificationTopics(
  user: SafeUser,
): Promise<TopicOption[]> {
  if (user.userType === USER_TYPES.ENTREPRENEUR) {
    const profile = await new EntrepreneurProfileService().getForEdit(user.id);
    const query = (profile.preferredProductType ?? "")
      .normalize("NFKC")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 80);
    return query ? [{ key: "preferred", label: query, query }] : [];
  }
  if (user.userType === USER_TYPES.UMKM_EXISTING) {
    const [profile, categories] = await Promise.all([
      new BusinessProfileService().getForEdit(user.id),
      new ReferenceRepository().listActiveFnbCategories(),
    ]);
    return businessQueryOptions(
      profile,
      categories.find((row) => row.id === profile.businessCategoryId)?.name,
    );
  }
  return [];
}
