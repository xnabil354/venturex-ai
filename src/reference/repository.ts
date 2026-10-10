import { getCustomerSegmentModel, type CustomerSegment } from "./customer-segment.model";
import { getFnbCategoryModel, type FnbCategory } from "./fnb-category.model";
import { getSalesChannelModel, type SalesChannel } from "./sales-channel.model";
import type {
  CustomerSegmentReference,
  FnbCategoryReference,
  SalesChannelReference,
} from "./types";

export interface ReferenceRepositoryPort {
  listActiveFnbCategories(): Promise<readonly FnbCategoryReference[]>;
  listActiveCustomerSegments(): Promise<readonly CustomerSegmentReference[]>;
  listActiveSalesChannels(): Promise<readonly SalesChannelReference[]>;
}

function toFnbCategoryReference(category: FnbCategory): FnbCategoryReference {
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    parentId: category.parentId,
  };
}

function toCustomerSegmentReference(
  segment: CustomerSegment,
): CustomerSegmentReference {
  return {
    id: segment.id,
    code: segment.code,
    name: segment.name,
    description: segment.description,
  };
}

function toSalesChannelReference(channel: SalesChannel): SalesChannelReference {
  return { id: channel.id, code: channel.code, name: channel.name };
}

export class ReferenceRepository implements ReferenceRepositoryPort {
  private readonly categoryModel = getFnbCategoryModel();
  private readonly segmentModel = getCustomerSegmentModel();
  private readonly channelModel = getSalesChannelModel();

  async listActiveFnbCategories(): Promise<readonly FnbCategoryReference[]> {
    const categories = await this.categoryModel.findAll({
      where: { isActive: true },
      order: [["code", "ASC"]],
    });
    return categories.map(toFnbCategoryReference);
  }

  async listActiveCustomerSegments(): Promise<readonly CustomerSegmentReference[]> {
    const segments = await this.segmentModel.findAll({
      where: { isActive: true },
      order: [["code", "ASC"]],
    });
    return segments.map(toCustomerSegmentReference);
  }

  async listActiveSalesChannels(): Promise<readonly SalesChannelReference[]> {
    const channels = await this.channelModel.findAll({
      where: { isActive: true },
      order: [["code", "ASC"]],
    });
    return channels.map(toSalesChannelReference);
  }
}
