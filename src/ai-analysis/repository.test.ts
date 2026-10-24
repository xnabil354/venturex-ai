import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { Op } from "sequelize";
import { parseUserId } from "../auth/user-types";
import { OpportunityAnalysisRepository } from "./repository";

describe("OpportunityAnalysisRepository", () => {
  it("scopes retrieval to both authenticated user and Opportunity and selects newest AI snapshot", async () => {
    const findOne = vi.fn().mockResolvedValue(null);
    const repo = new OpportunityAnalysisRepository({ findOne } as never);
    const fingerprint = "a".repeat(64);
    await repo.findLatest(parseUserId("10000000-0000-4000-8000-000000000001"), "ENTREPRENEUR", "60000000-0000-4000-8000-000000000001", fingerprint);
    const options = findOne.mock.calls[0]?.[0];
    expect(options.where.userId).toBe("10000000-0000-4000-8000-000000000001");
    expect(options.where.userType).toBe("ENTREPRENEUR");
    expect(options.where.opportunityId).toBe("60000000-0000-4000-8000-000000000001");
    expect(options.where.aiAnalysis[Op.contains]).toEqual({ contextFingerprint: fingerprint });
    expect(options.order).toEqual([["generatedAt", "DESC"], ["id", "ASC"]]);
  });

  it("creates a new row so score, Fit, and Risk snapshots from older analyses are not overwritten", async () => {
    const created = {
      id: "b0000000-0000-4000-8000-000000000001",
      userId: parseUserId("10000000-0000-4000-8000-000000000001"),
      opportunityId: "60000000-0000-4000-8000-000000000001",
      profileVersion: 1,
      opportunityScore: null,
      fitScore: "75.00",
      scoreStatus: "INSUFFICIENT_DATA",
      riskLevel: null,
      riskReasons: [],
      aiAnalysis: { schemaVersion: 1 },
      aiProvider: "provider",
      aiModel: "model",
      generatedAt: new Date("2026-10-01T00:00:00.000Z"),
    };
    const create = vi.fn().mockResolvedValue(created);
    const repo = new OpportunityAnalysisRepository({ create } as never);
    const input = {
      userId: created.userId,
      userType: "ENTREPRENEUR" as const,
      opportunityId: created.opportunityId,
      datasetVersionId: null,
      scoringModelId: null,
      profileVersion: 1,
      opportunityScore: null,
      fitScore: "75.00",
      scoreStatus: "INSUFFICIENT_DATA" as const,
      riskLevel: null,
      confidenceLevel: null,
      opportunityScoreBreakdown: { status: "INSUFFICIENT_DATA" },
      fitScoreBreakdown: { status: "AVAILABLE" },
      riskReasons: [],
      aiAnalysis: { schemaVersion: 1 },
      aiProvider: "provider",
      aiModel: "model",
      generatedAt: created.generatedAt,
      createdAt: created.generatedAt,
    };
    await expect(repo.create(input)).resolves.toMatchObject({ id: created.id, fitScore: "75.00", aiProvider: "provider" });
    expect(create).toHaveBeenCalledWith(input);
  });
});
