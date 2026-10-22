import "server-only";
import { QueryTypes } from "sequelize";
import { getSequelize } from "@/db/sequelize";
import { getUserGeneratedOpportunityModel } from "@/db/models/user-generated-opportunity.model";
import { PrivateOpportunityHypothesisRepository } from "@/opportunity/private-hypothesis-repository";
import type { OpportunityPersona, PrivateOpportunityIdeaDto } from "@/opportunity/private-hypothesis";
import { journeyFingerprint, roadmapFingerprint, progressState } from "./journey";
import { privateStartupRoadmapSchema } from "@/roadmap/private-startup-contract";
import { privateGrowthRoadmapSchema } from "@/opportunity/business-analysis-contract";

export class JourneyStateError extends Error {}
export class JourneyRepository {
  private readonly opportunities = new PrivateOpportunityHypothesisRepository();
  find(userId: string, role: OpportunityPersona, id: string) {
    return role === "ENTREPRENEUR" ? this.opportunities.findForEntrepreneur(userId, id) : this.opportunities.findForBusiness(userId, id);
  }
  list(userId: string, role: OpportunityPersona, page: number) {
    return role === "ENTREPRENEUR" ? this.opportunities.listPageForUser(userId, page, false, true) : this.opportunities.listBusinessPage(userId, page, false, true);
  }
  async progress(userId: string, role: OpportunityPersona, item: PrivateOpportunityIdeaDto) {
    const rows = await getSequelize().query<{ stage: number; completed_at: Date }>(
      "SELECT stage, completed_at FROM journey_roadmap_progress WHERE user_id = :userId AND opportunity_id = :id AND fingerprint = :fingerprint ORDER BY stage",
      { replacements: { userId, id: item.id, fingerprint: journeyFingerprint(item, role) }, type: QueryTypes.SELECT },
    );
    return progressState(item, role, rows);
  }
  async update(userId: string, role: OpportunityPersona, id: string, input: { stage: number; completed: boolean; fingerprint: string }) {
    return getSequelize().transaction(async transaction => {
      const row = await getUserGeneratedOpportunityModel().findOne({ where: { id, userId, userType: role }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row) return null;
      const parsed = role === "ENTREPRENEUR" ? privateStartupRoadmapSchema.safeParse(row.hypothesis.startupRoadmap) : privateGrowthRoadmapSchema.safeParse(row.hypothesis.growthRoadmap);
      const plan = parsed.success ? parsed.data : null;
      if (!plan || input.stage > plan.steps.length || roadmapFingerprint(plan) !== input.fingerprint) throw new JourneyStateError("Roadmap telah berubah. Muat ulang halaman.");
      const replacements = { userId, id, ...input };
      if (input.completed) await getSequelize().query(`INSERT INTO journey_roadmap_progress(opportunity_id,user_id,fingerprint,stage) VALUES (:id,:userId,:fingerprint,:stage) ON CONFLICT DO NOTHING`, { replacements, transaction });
      else await getSequelize().query("DELETE FROM journey_roadmap_progress WHERE user_id=:userId AND opportunity_id=:id AND fingerprint=:fingerprint AND stage=:stage", { replacements, transaction });
      return true;
    });
  }
}
