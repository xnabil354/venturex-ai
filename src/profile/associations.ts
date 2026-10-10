import { getUserModel } from "../db/models/user.model";
import { getCustomerSegmentModel } from "../reference/customer-segment.model";
import { getFnbCategoryModel } from "../reference/fnb-category.model";
import { getSalesChannelModel } from "../reference/sales-channel.model";
import { getBusinessProductModel } from "./business-product.model";
import { getBusinessProfileModel } from "./business-profile.model";
import {
  getBusinessProfileCustomerSegmentModel,
  getBusinessProfileSalesChannelModel,
} from "./business-profile-junction.model";
import { getEntrepreneurProfileModel } from "./entrepreneur-profile.model";
import {
  getEntrepreneurProfileCustomerSegmentModel,
  getEntrepreneurProfileInterestModel,
  getEntrepreneurProfileSalesChannelModel,
} from "./entrepreneur-profile-junction.model";

declare global {
  var __venturexProfileAssociationsInitialized: boolean | undefined;
}

export function initializeProfileAssociations(): void {
  if (globalThis.__venturexProfileAssociationsInitialized) {
    return;
  }

  const User = getUserModel();
  const EntrepreneurProfile = getEntrepreneurProfileModel();
  const BusinessProfile = getBusinessProfileModel();
  const BusinessProduct = getBusinessProductModel();
  const FnbCategory = getFnbCategoryModel();
  const CustomerSegment = getCustomerSegmentModel();
  const SalesChannel = getSalesChannelModel();
  const Interest = getEntrepreneurProfileInterestModel();
  const ProfileCustomerSegment = getEntrepreneurProfileCustomerSegmentModel();
  const ProfileSalesChannel = getEntrepreneurProfileSalesChannelModel();
  const BusinessCustomerSegment = getBusinessProfileCustomerSegmentModel();
  const BusinessSalesChannel = getBusinessProfileSalesChannelModel();

  User.hasOne(EntrepreneurProfile, {
    foreignKey: "userId",
    as: "entrepreneurProfile",
  });
  EntrepreneurProfile.belongsTo(User, { foreignKey: "userId", as: "user" });

  EntrepreneurProfile.belongsToMany(FnbCategory, {
    through: Interest,
    foreignKey: "entrepreneurProfileId",
    otherKey: "fnbCategoryId",
    as: "interests",
  });
  FnbCategory.belongsToMany(EntrepreneurProfile, {
    through: Interest,
    foreignKey: "fnbCategoryId",
    otherKey: "entrepreneurProfileId",
    as: "entrepreneurProfiles",
  });

  EntrepreneurProfile.belongsToMany(CustomerSegment, {
    through: ProfileCustomerSegment,
    foreignKey: "entrepreneurProfileId",
    otherKey: "customerSegmentId",
    as: "customerSegments",
  });
  CustomerSegment.belongsToMany(EntrepreneurProfile, {
    through: ProfileCustomerSegment,
    foreignKey: "customerSegmentId",
    otherKey: "entrepreneurProfileId",
    as: "entrepreneurProfiles",
  });

  EntrepreneurProfile.belongsToMany(SalesChannel, {
    through: ProfileSalesChannel,
    foreignKey: "entrepreneurProfileId",
    otherKey: "salesChannelId",
    as: "salesChannels",
  });
  SalesChannel.belongsToMany(EntrepreneurProfile, {
    through: ProfileSalesChannel,
    foreignKey: "salesChannelId",
    otherKey: "entrepreneurProfileId",
    as: "entrepreneurProfiles",
  });

  User.hasOne(BusinessProfile, { foreignKey: "userId", as: "businessProfile" });
  BusinessProfile.belongsTo(User, { foreignKey: "userId", as: "user" });
  BusinessProfile.hasMany(BusinessProduct, {
    foreignKey: "businessProfileId",
    as: "products",
  });
  BusinessProduct.belongsTo(BusinessProfile, {
    foreignKey: "businessProfileId",
    as: "businessProfile",
  });
  BusinessProduct.belongsTo(FnbCategory, {
    foreignKey: "fnbCategoryId",
    as: "category",
  });

  BusinessProfile.belongsToMany(CustomerSegment, {
    through: BusinessCustomerSegment,
    foreignKey: "businessProfileId",
    otherKey: "customerSegmentId",
    as: "customerSegments",
  });
  CustomerSegment.belongsToMany(BusinessProfile, {
    through: BusinessCustomerSegment,
    foreignKey: "customerSegmentId",
    otherKey: "businessProfileId",
    as: "businessProfiles",
  });

  BusinessProfile.belongsToMany(SalesChannel, {
    through: BusinessSalesChannel,
    foreignKey: "businessProfileId",
    otherKey: "salesChannelId",
    as: "salesChannels",
  });
  SalesChannel.belongsToMany(BusinessProfile, {
    through: BusinessSalesChannel,
    foreignKey: "salesChannelId",
    otherKey: "businessProfileId",
    as: "businessProfiles",
  });

  globalThis.__venturexProfileAssociationsInitialized = true;
}
