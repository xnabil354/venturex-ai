export type FnbCategoryReference = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
};

export type CustomerSegmentReference = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
};

export type SalesChannelReference = {
  readonly id: string;
  readonly code: string;
  readonly name: string;
};
