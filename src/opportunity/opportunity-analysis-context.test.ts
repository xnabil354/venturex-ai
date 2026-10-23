import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ONBOARDING_STATUSES, USER_TYPES, userIdSchema, type SafeUser } from "../auth/user-types";
import type { ReferenceRepositoryPort } from "../reference/repository";
import {
  buildOpportunityAnalysisContext,
  DatabaseOpportunityProfileContextBuilder,
  fingerprintOpportunityAnalysisContext,
  OpportunityProfileContextError,
  type BuiltOpportunityProfileContext,
} from "./opportunity-analysis-context";
import type { SearchApiOpportunityEvidence } from "./searchapi-evidence-contract";

const user: SafeUser & { readonly userType: "ENTREPRENEUR" } = {
  id: userIdSchema.parse("80000000-0000-4000-8000-000000000011"),
  email: "private@example.test",
  userType: USER_TYPES.ENTREPRENEUR,
  onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
};

const category = { id: "80000000-0000-4000-8000-000000000021", code: "DRINKS", name: "Minuman", parentId: null };
const segment = { id: "80000000-0000-4000-8000-000000000022", code: "LOCAL", name: "Pelanggan lokal", description: null };
const channel = { id: "80000000-0000-4000-8000-000000000023", code: "DELIVERY", name: "Pesan antar" };

const evidence: SearchApiOpportunityEvidence = {
  sourceType: "RELATED_QUERY_RISING",
  productQuery: "Soto Ayam",
  query: "soto ayam harga murah",
  position: 2,
  interestIndex: null,
  growthLabel: "+450%",
  growthPercent: 450,
  isBreakout: false,
  geo: "ID",
  period: "24 jam terakhir",
  providerTime: "now 1-d",
  searchProperty: "web",
  retrievedAt: "2026-10-18T04:00:00.000Z",
  expiresAt: "2026-10-18T04:05:00.000Z",
  publisher: "Google Trends",
  provider: "SearchApi.io",
  url: "https://trends.google.com/trends/explore?geo=ID&date=now+1-d&q=soto+ayam",
  providerSourceUrl: null,
};

function references(): ReferenceRepositoryPort {
  return {
    listActiveFnbCategories: vi.fn().mockResolvedValue([category]),
    listActiveCustomerSegments: vi.fn().mockResolvedValue([segment]),
    listActiveSalesChannels: vi.fn().mockResolvedValue([channel]),
  };
}

describe("Opportunity analysis profile and evidence context", () => {
  it("builds an Entrepreneur-only profile projection with resolved labels and declared constraints", async () => {
    const getForEdit = vi.fn().mockResolvedValue({
      preferredProductType: " Soto Ayam ",
      interestCategoryIds: [category.id],
      customerSegmentIds: [segment.id],
      salesChannelIds: [channel.id],
      budget: { min: 2500000, max: 7500000 },
      location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
      experienceLevel: "BEGINNER",
      timeCommitment: "LIMITED",
      businessObjective: "Mencoba jualan makan siang.",
      notes: "Ingin kemasan yang bisa dibawa.",
    });
    const builder = new DatabaseOpportunityProfileContextBuilder({
      entrepreneurProfiles: { getForEdit },
      references: references(),
    });

    const result = await builder.build(user);

    expect(getForEdit).toHaveBeenCalledWith(user.id);
    expect(result.profile).toEqual({
      persona: "ENTREPRENEUR",
      preferredProductType: "Soto Ayam",
      categories: ["Minuman"],
      customerSegments: ["Pelanggan lokal"],
      salesChannels: ["Pesan antar"],
      budget: { min: 2500000, max: 7500000, currency: "IDR" },
      location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
      experienceLevel: "BEGINNER",
      timeCommitment: "LIMITED",
      businessObjective: "Mencoba jualan makan siang.",
      notes: "Ingin kemasan yang bisa dibawa.",
    });
    expect(result.dataAvailability.profileFieldsPresent).toContain("profile.notes");
    expect(JSON.stringify(result)).not.toContain(user.id);
    expect(JSON.stringify(result)).not.toContain(user.email);
  });

  it.each([
    { experienceLevel: null, timeCommitment: "LIMITED", missingField: "profile.experienceLevel" },
    { experienceLevel: "BEGINNER", timeCommitment: null, missingField: "profile.timeCommitment" },
    { experienceLevel: null, timeCommitment: null, missingField: null },
  ] as const)("marks nullable entrepreneur fields missing when their values are null: $missingField", async ({ experienceLevel, timeCommitment }) => {
    const builder = new DatabaseOpportunityProfileContextBuilder({
      entrepreneurProfiles: {
        getForEdit: vi.fn().mockResolvedValue({
          preferredProductType: null,
          interestCategoryIds: [category.id],
          customerSegmentIds: [segment.id],
          salesChannelIds: [channel.id],
          budget: { min: 2500000, max: 7500000 },
          location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
          experienceLevel,
          timeCommitment,
          businessObjective: null,
          notes: null,
        }),
      },
      references: references(),
    });

    const result = await builder.build(user);

    expect(result.profile).toMatchObject({ experienceLevel, timeCommitment });
    expect(result.dataAvailability.profileFieldsPresent).toContain("profile.categories");
    expect(result.dataAvailability.profileFieldsPresent).toContain("profile.budget");
    if (experienceLevel === null) {
      expect(result.dataAvailability.profileFieldsPresent).not.toContain("profile.experienceLevel");
      expect(result.dataAvailability.profileFieldsMissing).toContain("profile.experienceLevel");
    } else {
      expect(result.dataAvailability.profileFieldsPresent).toContain("profile.experienceLevel");
    }
    if (timeCommitment === null) {
      expect(result.dataAvailability.profileFieldsPresent).not.toContain("profile.timeCommitment");
      expect(result.dataAvailability.profileFieldsMissing).toContain("profile.timeCommitment");
    } else {
      expect(result.dataAvailability.profileFieldsPresent).toContain("profile.timeCommitment");
    }
  });

  it("builds UMKM context from the current business profile, including only declared product prices", async () => {
    const getForEdit = vi.fn().mockResolvedValue({
      businessName: "Kedai Soto",
      businessCategoryId: category.id,
      location: { text: "Bandung", city: "Bandung", province: "Jawa Barat" },
      averagePrice: { min: 18000, max: 30000 },
      products: [
        { name: "Soto Ayam", categoryId: category.id, price: 22000 },
        { name: "Es Teh", categoryId: null, price: null },
      ],
      customerSegmentIds: [segment.id],
      salesChannelIds: [channel.id],
      businessDescription: "Warung makan keluarga.",
      notes: "Jangan tambah alat berat.",
    });
    const builder = new DatabaseOpportunityProfileContextBuilder({ businessProfiles: { getForEdit }, references: references() });
    const businessUser: SafeUser & { readonly userType: "UMKM_EXISTING" } = { ...user, userType: USER_TYPES.UMKM_EXISTING };

    const result = await builder.build(businessUser);

    expect(getForEdit).toHaveBeenCalledWith(user.id);
    expect(result.profile).toMatchObject({
      persona: "UMKM_EXISTING",
      businessName: "Kedai Soto",
      businessCategory: "Minuman",
      averagePrice: { min: 18000, max: 30000, currency: "IDR" },
      products: [
        { name: "Soto Ayam", category: "Minuman", price: 22000 },
        { name: "Es Teh", category: null, price: null },
      ],
      notes: "Jangan tambah alat berat.",
    });
    expect(result.dataAvailability.profileFieldsPresent).toContain("profile.products[].price");
    expect(result.dataAvailability.profileFieldsPresent).not.toContain("profile.experienceLevel");
  });

  it("fails closed when a profile reference cannot be resolved or a free-text field exceeds its context bound", async () => {
    const builder = new DatabaseOpportunityProfileContextBuilder({
      entrepreneurProfiles: {
        getForEdit: vi.fn().mockResolvedValue({
          preferredProductType: null,
          interestCategoryIds: ["80000000-0000-4000-8000-000000000099"],
          customerSegmentIds: [segment.id],
          salesChannelIds: [channel.id],
          budget: { min: 0, max: 0 },
          location: { text: "Bandung", city: null, province: null },
          experienceLevel: "BEGINNER",
          timeCommitment: "LIMITED",
          businessObjective: null,
          notes: null,
        }),
      },
      references: references(),
    });
    await expect(builder.build(user)).rejects.toMatchObject({ code: "PROFILE_INCOMPLETE" });

    const longTextBuilder = new DatabaseOpportunityProfileContextBuilder({
      entrepreneurProfiles: {
        getForEdit: vi.fn().mockResolvedValue({
          preferredProductType: null,
          interestCategoryIds: [category.id],
          customerSegmentIds: [segment.id],
          salesChannelIds: [channel.id],
          budget: { min: 0, max: 0 },
          location: { text: "Bandung", city: null, province: null },
          experienceLevel: "BEGINNER",
          timeCommitment: "LIMITED",
          businessObjective: null,
          notes: "x".repeat(1201),
        }),
      },
      references: references(),
    });
    await expect(longTextBuilder.build(user)).rejects.toBeInstanceOf(OpportunityProfileContextError);
    await expect(longTextBuilder.build(user)).rejects.toMatchObject({ code: "PROFILE_CONTEXT_TOO_LARGE" });
  });

  it("removes account-like contact details and labeled credentials from free-text profile context", async () => {
    const builder = new DatabaseOpportunityProfileContextBuilder({
      entrepreneurProfiles: {
        getForEdit: vi.fn().mockResolvedValue({
          preferredProductType: "Kopi",
          interestCategoryIds: [category.id],
          customerSegmentIds: [segment.id],
          salesChannelIds: [channel.id],
          budget: { min: 1000000, max: 2000000 },
          location: { text: "Bandung", city: null, province: null },
          experienceLevel: "BEGINNER",
          timeCommitment: "LIMITED",
          businessObjective: null,
          notes: "Kontak kontak@example.test atau 081234567890. API key: synthetic-private-secret.",
        }),
      },
      references: references(),
    });

    const result = await builder.build(user);
    const notes = (result.profile as Extract<typeof result.profile, { persona: "ENTREPRENEUR" }>).notes;

    expect(notes).toContain("[email dihapus]");
    expect(notes).toContain("[nomor telepon dihapus]");
    expect(notes).toContain("[rahasia dihapus]");
    expect(notes).not.toContain("kontak@example.test");
    expect(notes).not.toContain("081234567890");
    expect(notes).not.toContain("synthetic-private-secret");
  });

  it("retains provider semantics, flags a brand-oriented candidate, and fingerprints changed notes without storing them", () => {
    const profile: BuiltOpportunityProfileContext = {
      profile: {
        persona: "UMKM_EXISTING",
        businessName: "Kopi",
        businessCategory: "Minuman",
        businessDescription: null,
        location: null,
        averagePrice: { min: 10000, max: 25000, currency: "IDR" },
        products: [{ name: "Kopi Susu", category: "Minuman", price: 18000 }],
        customerSegments: ["Pelanggan lokal"],
        salesChannels: ["Pesan antar"],
        notes: "Waktu operasional terbatas.",
      },
      dataAvailability: {
        profileFieldsPresent: ["profile.businessName", "profile.businessCategory", "profile.averagePrice", "profile.products", "profile.customerSegments", "profile.salesChannels", "profile.notes"],
        profileFieldsMissing: ["profile.location", "profile.businessDescription", "profile.products[].price", "profile.products[].category"],
      },
    };
    const context = buildOpportunityAnalysisContext(profile, { ...evidence, productQuery: "Kopi", query: "kopi kenangan", sourceType: "RELATED_QUERY_TOP", interestIndex: 100, growthLabel: null, growthPercent: null, isBreakout: false });
    const changed = buildOpportunityAnalysisContext({ ...profile, profile: { ...profile.profile, notes: "Waktu usaha terbatas." } }, { ...evidence, productQuery: "Kopi", query: "kopi kenangan", sourceType: "RELATED_QUERY_TOP", interestIndex: 100, growthLabel: null, growthPercent: null, isBreakout: false });
    const secret = "context-fingerprint-test-secret-with-at-least-thirty-two-characters";

    expect(context.evidence.queryIntentCandidate).toBe("BRAND_OR_NAVIGATIONAL");
    expect(context.evidence.interestIndex).toBe(100);
    expect(context.evidence.growthPercent).toBeNull();
    expect(context.evidence.ownershipVerified).toBe(true);
    expect(fingerprintOpportunityAnalysisContext(context, { authSecret: secret, model: "cx/gpt-6-luna-xhigh" })).not.toBe(fingerprintOpportunityAnalysisContext(changed, { authSecret: secret, model: "cx/gpt-6-luna-xhigh" }));
    expect(JSON.stringify(context)).not.toContain(secret);
  });
});
