export type OpportunityEvidenceRecord = {
  readonly id: string;
  readonly sourceName: string;
  readonly sourceType: string;
  readonly sourceReference: string | null;
  readonly sourceUrl: string | null;
  readonly sourceDate: Date | null;
  readonly retrievedAt: Date;
  readonly metadata: unknown;
};
