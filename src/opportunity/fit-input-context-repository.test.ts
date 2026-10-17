import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";

const mocks = vi.hoisted(() => ({ sequelize: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("../db/sequelize", () => ({
  getSequelize: () => mocks.sequelize as import("sequelize").Sequelize,
}));

import { Sequelize } from "sequelize";

import { parseUserId } from "../auth/user-types";
import { getOpportunityCustomerSegmentModel } from "../db/models/opportunity-customer-segment.model";
import { getOpportunityFitRequirementModel } from "../db/models/opportunity-fit-requirement.model";
import { getOpportunitySalesChannelModel } from "../db/models/opportunity-sales-channel.model";
import { OpportunityFitInputContextRepository } from "./fit-input-context-repository";

const OPPORTUNITY_ID = "60000000-0000-4000-8000-000000000001";
const USER_ID = parseUserId("10000000-0000-4000-8000-000000000001");
const TRANSACTION = {} as Transaction;

let sequelize: Sequelize;

beforeAll(() => {
  sequelize = new Sequelize({ dialect: "postgres", logging: false });
  mocks.sequelize = sequelize;
});

afterAll(async () => {
  await sequelize.close();
});

function createRepository() {
  const opportunity = {
    id: OPPORTUNITY_ID,
    fnbCategoryId: "80000000-0000-4000-8000-000000000001",
    relatedTrend: {
      id: "70000000-0000-4000-8000-000000000001",
      lifecycleState: "PUBLISHED",
      affectedUserTypes: ["ENTREPRENEUR", "UMKM_EXISTING"],
    },
  };
  const opportunityRepository = {
    findVisibleForFitInput: vi.fn().mockResolvedValue(opportunity),
  };
  const requirementModel = {
    findByPk: vi.fn().mockResolvedValue({
      opportunityId: OPPORTUNITY_ID,
      capitalMin: "1000000",
      capitalMax: null,
      expectedPriceMin: "10000",
      expectedPriceMax: "30000",
      requiredExperienceLevel: "INTERMEDIATE",
      requiredTimeCommitment: null,
      operationalComplexity: "40.00",
      locationScope: "CITY",
      metadata: { source: "persisted-requirement" },
      updatedAt: new Date("2026-10-09T00:00:00.000Z"),
    }),
  } as unknown as ReturnType<typeof getOpportunityFitRequirementModel>;
  const opportunityCustomerSegmentModel = {
    findAll: vi.fn().mockResolvedValue([{ customerSegmentId: "segment-1" }]),
  } as unknown as ReturnType<typeof getOpportunityCustomerSegmentModel>;
  const opportunitySalesChannelModel = {
    findAll: vi.fn().mockResolvedValue([{ salesChannelId: "channel-1" }]),
  } as unknown as ReturnType<typeof getOpportunitySalesChannelModel>;
  const entrepreneurProfileRepository = {
    findByUserId: vi.fn().mockResolvedValue({
      id: "entrepreneur-profile-1",
      userId: USER_ID,
      locationText: "Kota tersimpan",
      city: null,
      province: "Provinsi tersimpan",
      district: null,
      subdistrict: null,
      countryCode: "ID",
      budgetMin: 20000000,
      budgetMax: 50000000,
      experienceLevel: "BEGINNER",
      timeCommitment: "PART_TIME",
      preferredProductType: null,
      businessObjective: null,
      notes: null,
      profileVersion: 3,
    }),
    loadSelectionIds: vi.fn().mockResolvedValue({
      interestCategoryIds: ["category-1"],
      customerSegmentIds: ["segment-2"],
      salesChannelIds: ["channel-2"],
    }),
  };
  const businessProfileRepository = {
    findByUserId: vi.fn().mockResolvedValue({
      id: "business-profile-1",
      userId: USER_ID,
      businessName: "Tersimpan",
      businessCategoryId: "business-category-1",
      locationText: "Lokasi bisnis tersimpan",
      city: "Kota bisnis",
      province: null,
      countryCode: "ID",
      averagePriceMin: 15000,
      averagePriceMax: 35000,
      businessDescription: "Deskripsi tersimpan",
      operationModel: null,
      notes: null,
      profileVersion: 2,
    }),
    loadState: vi.fn().mockResolvedValue({
      products: [
        { id: "product-1", name: "Aktif", fnbCategoryId: "category-1", price: 18000, isActive: true },
        { id: "product-2", name: "Nonaktif", fnbCategoryId: "category-2", price: 21000, isActive: false },
        { id: "product-3", name: "Belum lengkap", fnbCategoryId: null, price: null, isActive: true },
      ],
      customerSegmentIds: ["segment-3"],
      salesChannelIds: ["channel-3"],
    }),
  };
  const transactionRunner = async <T>(work: (transaction: Transaction) => Promise<T>) => work(TRANSACTION);

  const repository = new OpportunityFitInputContextRepository({
    opportunityRepository,
    requirementModel,
    opportunityCustomerSegmentModel,
    opportunitySalesChannelModel,
    entrepreneurProfileRepository,
    businessProfileRepository,
    transactionRunner,
  });

  return {
    repository,
    opportunityRepository,
    requirementModel,
    opportunityCustomerSegmentModel,
    opportunitySalesChannelModel,
    entrepreneurProfileRepository,
    businessProfileRepository,
  };
}

describe("OpportunityFitInputContextRepository", () => {
  it("loads persisted Entrepreneur fit inputs only through the current user's profile", async () => {
    const {
      repository,
      opportunityRepository,
      entrepreneurProfileRepository,
      businessProfileRepository,
    } = createRepository();

    await expect(repository.findForUser(USER_ID, "ENTREPRENEUR", OPPORTUNITY_ID)).resolves.toMatchObject({
      userType: "ENTREPRENEUR",
      opportunity: {
        fnbCategoryId: "80000000-0000-4000-8000-000000000001",
        requirements: {
          capitalMin: "1000000",
          capitalMax: null,
          expectedPriceMin: "10000",
          requiredTimeCommitment: null,
        },
        customerSegmentIds: ["segment-1"],
        salesChannelIds: ["channel-1"],
      },
      profile: {
        profileVersion: 3,
        budgetMin: 20000000,
        budgetMax: 50000000,
        city: null,
        preferredProductType: null,
        interestCategoryIds: ["category-1"],
        customerSegmentIds: ["segment-2"],
        salesChannelIds: ["channel-2"],
      },
    });
    expect(opportunityRepository.findVisibleForFitInput).toHaveBeenCalledWith(
      "ENTREPRENEUR",
      OPPORTUNITY_ID,
      TRANSACTION,
    );
    expect(entrepreneurProfileRepository.findByUserId).toHaveBeenCalledWith(USER_ID, TRANSACTION);
    expect(entrepreneurProfileRepository.loadSelectionIds).toHaveBeenCalledWith(
      "entrepreneur-profile-1",
      TRANSACTION,
    );
    expect(businessProfileRepository.findByUserId).not.toHaveBeenCalled();
  });

  it("loads persisted UMKM profile, active product inputs, segments, and channels", async () => {
    const { repository, businessProfileRepository, entrepreneurProfileRepository } = createRepository();

    await expect(repository.findForUser(USER_ID, "UMKM_EXISTING", OPPORTUNITY_ID)).resolves.toMatchObject({
      userType: "UMKM_EXISTING",
      profile: {
        profileVersion: 2,
        businessCategoryId: "business-category-1",
        averagePriceMin: 15000,
        businessDescription: "Deskripsi tersimpan",
        operationModel: null,
        products: [
          { fnbCategoryId: "category-1", price: 18000 },
          { fnbCategoryId: null, price: null },
        ],
        customerSegmentIds: ["segment-3"],
        salesChannelIds: ["channel-3"],
      },
    });
    expect(businessProfileRepository.findByUserId).toHaveBeenCalledWith(USER_ID, TRANSACTION);
    expect(businessProfileRepository.loadState).toHaveBeenCalledWith("business-profile-1", TRANSACTION);
    expect(entrepreneurProfileRepository.findByUserId).not.toHaveBeenCalled();
  });

  it("keeps absent requirement and profile data null and relationship inputs empty", async () => {
    const {
      repository,
      requirementModel,
      opportunityCustomerSegmentModel,
      opportunitySalesChannelModel,
      businessProfileRepository,
    } = createRepository();
    requirementModel.findByPk = vi.fn().mockResolvedValue(null);
    opportunityCustomerSegmentModel.findAll = vi.fn().mockResolvedValue([]);
    opportunitySalesChannelModel.findAll = vi.fn().mockResolvedValue([]);
    businessProfileRepository.findByUserId.mockResolvedValue(null);

    await expect(repository.findForUser(USER_ID, "UMKM_EXISTING", OPPORTUNITY_ID)).resolves.toMatchObject({
      opportunity: {
        requirements: null,
        customerSegmentIds: [],
        salesChannelIds: [],
      },
      profile: null,
    });
    expect(businessProfileRepository.loadState).not.toHaveBeenCalled();
  });

  it("does not load profile data when the existing visibility repository rejects the Opportunity", async () => {
    const { repository, opportunityRepository, entrepreneurProfileRepository } = createRepository();
    opportunityRepository.findVisibleForFitInput.mockResolvedValue(null);

    await expect(repository.findForUser(USER_ID, "ENTREPRENEUR", OPPORTUNITY_ID)).resolves.toBeNull();
    expect(entrepreneurProfileRepository.findByUserId).not.toHaveBeenCalled();
  });
});
