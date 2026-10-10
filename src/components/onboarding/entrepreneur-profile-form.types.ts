export type ReferenceItem = {
  readonly code: string;
  readonly description?: string | null;
  readonly id: string;
  readonly name: string;
  readonly parentId?: string | null;
};

export type ReferenceData = {
  readonly categories: readonly ReferenceItem[];
  readonly channels: readonly ReferenceItem[];
  readonly segments: readonly ReferenceItem[];
};

export type ReferenceState =
  | { readonly status: "loading" }
  | { readonly data: ReferenceData; readonly status: "ready" }
  | { readonly message: string; readonly status: "error" };
