import "server-only";

import { getUserGeneratedOpportunityModel, type UserGeneratedOpportunity } from "../db/models/user-generated-opportunity.model";
import { NINEROUTER_REQUESTED_MODEL } from "../ai-analysis/ninerouter";
import {
  privateOpportunityHypothesisSchema,
  privateOpportunitySourceSchema,
  type PrivateOpportunityIdeaDto,
  type PrivateOpportunityHypothesis,
  type PrivateOpportunitySource,
} from "./private-hypothesis";

export type PrivateHypothesisPersistenceInput = Readonly<{
  userId: string;
  userType: "ENTREPRENEUR" | "UMKM_EXISTING";
  hypothesis: PrivateOpportunityHypothesis;
  sourceReference: PrivateOpportunitySource;
  provider: "ninerouter";
  model: string;
  generatedAt: Date;
}>;

function toDto(record: UserGeneratedOpportunity): PrivateOpportunityIdeaDto | null {
  const hypothesis = privateOpportunityHypothesisSchema.safeParse(record.hypothesis);
  const source = privateOpportunitySourceSchema.safeParse(record.sourceReference);
  if (!hypothesis.success || !source.success || !record.id || record.model !== NINEROUTER_REQUESTED_MODEL) return null;
  return {
    id: record.id,
    hypothesis: hypothesis.data,
    source: source.data,
    provider: "ninerouter",
    model: NINEROUTER_REQUESTED_MODEL,
    generatedAt: record.generatedAt.toISOString(),
    saved: record.isSaved,
  };
}

export class PrivateOpportunityHypothesisRepository {
  private readonly model = getUserGeneratedOpportunityModel();

  async createMany(input: readonly PrivateHypothesisPersistenceInput[]): Promise<readonly PrivateOpportunityIdeaDto[]> {
    const rows = await this.model.bulkCreate(input.map((item) => ({
      userId: item.userId,
      userType: item.userType,
      hypothesis: item.hypothesis,
      sourceReference: item.sourceReference,
      provider: item.provider,
      model: item.model,
      generatedAt: item.generatedAt,
      isSaved: false,
      savedAt: null,
    })), { returning: true });
    return rows.map(toDto).filter((item): item is PrivateOpportunityIdeaDto => item !== null);
  }

  async listForUser(userId: string, savedOnly = false): Promise<readonly PrivateOpportunityIdeaDto[]> {
    const rows = await this.model.findAll({
      where: { userId, ...(savedOnly ? { isSaved: true } : {}) },
      order: [["createdAt", "DESC"], ["id", "ASC"]],
      limit: 50,
    });
    return rows.map(toDto).filter((item): item is PrivateOpportunityIdeaDto => item !== null);
  }

  async setSaved(userId: string, id: string, saved: boolean, now = new Date()): Promise<PrivateOpportunityIdeaDto | null> {
    const row = await this.model.findOne({ where: { id, userId } });
    if (!row) return null;
    await row.update({ isSaved: saved, savedAt: saved ? (row.savedAt ?? now) : null, updatedAt: now });
    return toDto(row);
  }
}
