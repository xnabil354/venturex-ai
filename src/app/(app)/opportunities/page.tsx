import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { ONBOARDING_STATUSES, isUserType } from "@/auth/user-types";
import { PrivateOpportunityFinder } from "@/components/opportunities/private-opportunity-finder";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";
import { parsePrivateListPage } from "@/opportunity/private-list-page";
import { isSearchApiEvidenceTokenConfigured } from "@/opportunity/searchapi-evidence-token";
import { DatabaseOpportunityProfileContextBuilder } from "@/opportunity/opportunity-analysis-context";
import { isLocalProfileNineRouterTransportAllowed, isLoopbackHttpTransport, isPublicHttpTransport, readLocalProfileNineRouterConfig } from "@/ai-analysis/ninerouter";
import { BusinessQuerySelect } from "@/components/trends/business-query-select";
import { businessQueryOptions } from "@/trend/business-query-options";
import { BusinessProfileService } from "@/profile/business-service";
import { ReferenceRepository } from "@/reference/repository";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ page?: string | readonly string[]; queryKey?: string }> }) {
  const params = await searchParams;
  const page = parsePrivateListPage(params.page);
  let hasMore = false;
  const user = await getCurrentUser();
  if (!user || user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
    notFound();
  }
  const userType = user.userType;
  if (!isUserType(userType)) notFound();
  const queryOptions = userType === "UMKM_EXISTING" ? await (async () => { const profile = await new BusinessProfileService().getForEdit(user.id); const refs = await new ReferenceRepository().listActiveFnbCategories(); return businessQueryOptions(profile, refs.find(c => c.id === profile.businessCategoryId)?.name); })() : [];
  const queryKey = queryOptions.some(o => o.key === params.queryKey) ? params.queryKey! : "business";

  let initialItems = [] as Awaited<ReturnType<PrivateOpportunityHypothesisRepository["listForUser"]>>;
  let initialLoadFailed = false;
  try {
    const repository = new PrivateOpportunityHypothesisRepository();
    if (userType === "ENTREPRENEUR") {
      const result = await repository.listPageForUser(user.id, page);
      initialItems = result.items; hasMore = result.hasMore;
    } else { const result = await repository.listBusinessPage(user.id, page); initialItems = result.items; hasMore = result.hasMore; }
  } catch {
    initialLoadFailed = true;
  }

  let profileContextCategories: string[] = [];
  let profileContextAvailable = false;
  let profileActionRequired = userType === "ENTREPRENEUR";
  try {
    const context = await new DatabaseOpportunityProfileContextBuilder().build({ ...user, userType });
    const fields = new Set(context.dataAvailability.profileFieldsPresent);
    profileActionRequired = userType === "ENTREPRENEUR" && !fields.has("profile.preferredProductType");
    const categories: readonly (readonly [boolean, string])[] = userType === "ENTREPRENEUR"
      ? [
        [fields.has("profile.preferredProductType") || fields.has("profile.categories"), "Jenis produk dan kategori F&B"],
        [fields.has("profile.customerSegments"), "Target pelanggan"],
        [fields.has("profile.salesChannels"), "Kanal penjualan"],
        [fields.has("profile.budget"), "Rentang budget modal"],
        [fields.has("profile.location"), "Lokasi usaha yang dinyatakan"],
        [fields.has("profile.experienceLevel"), "Pengalaman"],
        [fields.has("profile.timeCommitment"), "Komitmen waktu"],
        [fields.has("profile.businessObjective"), "Tujuan usaha"],
        [fields.has("profile.notes"), "Catatan profil"],
      ]
      : [
        [fields.has("profile.businessName") || fields.has("profile.businessCategory"), "Identitas dan kategori usaha"],
        [fields.has("profile.products"), "Produk yang sudah dijual"],
        [fields.has("profile.products[].price") || fields.has("profile.averagePrice"), "Harga produk dan rentang harga rata-rata"],
        [fields.has("profile.customerSegments"), "Target pelanggan"],
        [fields.has("profile.salesChannels"), "Kanal penjualan"],
        [fields.has("profile.location"), "Lokasi usaha yang dinyatakan"],
        [fields.has("profile.businessDescription"), "Deskripsi usaha"],
        [fields.has("profile.notes"), "Catatan profil"],
      ];
    profileContextCategories = categories.flatMap(([available, label]) => available ? [String(label)] : []);
    profileContextAvailable = profileContextCategories.length > 0;
  } catch {
    profileContextAvailable = false;
  }

  const providerConfig = readLocalProfileNineRouterConfig();
  const configuredBaseUrl = process.env.NINEROUTER_BASE_URL ?? providerConfig?.baseURL;
  const publicHttpTransport = isPublicHttpTransport(configuredBaseUrl);
  const loopbackHttp = isLoopbackHttpTransport(configuredBaseUrl);
  const transportAllowed = isLocalProfileNineRouterTransportAllowed(configuredBaseUrl);
  const inferenceEnabled = process.env.AI_ANALYSIS_TRENDS_USER_INFERENCE_ENABLED === "true";
  const sourceProcessingApproved = process.env.NINEROUTER_SEARCHAPI_PROCESSING_CONFIRMED === "true";
  const providerAvailable = inferenceEnabled && sourceProcessingApproved && providerConfig !== null && transportAllowed;
  const providerBlockMessage = !inferenceEnabled
    ? "Pembuatan hipotesis AI belum diaktifkan pada lingkungan ini."
    : !sourceProcessingApproved
      ? "Analisis belum tersedia saat ini."
      : publicHttpTransport
        ? "Analisis belum tersedia saat ini."
        : loopbackHttp && !transportAllowed
          ? "Gateway HTTP loopback hanya diizinkan di development dengan NINEROUTER_ALLOW_LOOPBACK_HTTP_DEV_ONLY=true, atau melalui tunnel terenkripsi yang telah diverifikasi."
          : !providerConfig || !transportAllowed
            ? "Fitur belum siap digunakan. Coba lagi nanti."
            : undefined;

  return (
    <>{queryOptions.length ? <BusinessQuerySelect options={queryOptions} selected={queryKey} /> : null}<PrivateOpportunityFinder comparisonOwnerId={user.id}
      key={`finder-${page}-${queryKey}`}
      {...(userType === "UMKM_EXISTING" ? { queryKey } : {})}
      profileActionRequired={profileActionRequired}
      pagination={{ page, hasMore }}
      showScoreDetails
      businessMode={userType === "UMKM_EXISTING"}
      initialItems={initialItems}
      initialLoadFailed={initialLoadFailed}
      profileContextCategories={profileContextCategories}
      profileContextAvailable={profileContextAvailable}
      providerAvailable={providerAvailable}
      {...(providerBlockMessage ? { providerBlockMessage } : {})}
      evidenceSigningAvailable={isSearchApiEvidenceTokenConfigured()}
      searchApiAvailable={!profileActionRequired && process.env.TREND_RADAR_SEARCHAPI_ENABLED === "true"}
      sourceProcessingApproved={sourceProcessingApproved}
    /></>
  );
}
