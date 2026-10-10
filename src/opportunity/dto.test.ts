import { describe, expect, it } from "vitest";

import type { OpportunityDetailRecord, OpportunityRecord } from "./domain";
import {
  OpportunityDisplayContractError,
  toOpportunityDetail,
  toOpportunityListItem,
} from "./dto";

const record: OpportunityRecord = {
  id: "60000000-0000-4000-8000-000000000001",
  name: "Menu minuman berbasis tanaman",
  description: "  Pilihan minuman bertambah.\n  Deskripsi ini berasal dari katalog tersimpan.  ",
  categoryName: "Minuman",
  relatedTrend: {
    id: "70000000-0000-4000-8000-000000000001",
    title: "Minat pada minuman berbasis tanaman meningkat",
    lifecycleState: "PUBLISHED",
    affectedUserTypes: ["ENTREPRENEUR"],
  },
};
const detailRecord: OpportunityDetailRecord = {
  ...record,
  opportunityType: "NEW_PRODUCT",
  targetConsumerSummary: "Konsumen minuman.",
  competitionLevel: "MEDIUM",
  competitionSummary: "Ringkasan persaingan tersimpan.",
};

describe("Opportunity list DTO", () => {
  it("projects persisted catalog fields and normalizes the description summary", () => {
    expect(toOpportunityListItem(record)).toEqual({
      id: record.id,
      name: record.name,
      categoryName: "Minuman",
      summary: "Pilihan minuman bertambah. Deskripsi ini berasal dari katalog tersimpan.",
      relatedTrend: {
        id: record.relatedTrend.id,
        title: record.relatedTrend.title,
      },
    });
  });

  it("limits long persisted descriptions without adding unsupported content", () => {
    const projected = toOpportunityListItem({
      ...record,
      description: `${"Ringkasan tersimpan ".repeat(20)}`,
    });

    expect(projected.summary.length).toBe(240);
    expect(projected.summary.endsWith("…")).toBe(true);
  });

  it("fails closed for missing display fields", () => {
    expect(() => toOpportunityListItem({ ...record, categoryName: " " }))
      .toThrow(OpportunityDisplayContractError);
  });
});

describe("Opportunity detail DTO", () => {
  it("projects only persisted Opportunity fields and the eligible Trend link", () => {
    expect(toOpportunityDetail(detailRecord)).toEqual({
      id: detailRecord.id,
      name: detailRecord.name,
      description: detailRecord.description.trim(),
      categoryName: detailRecord.categoryName,
      opportunityType: detailRecord.opportunityType,
      targetConsumerSummary: detailRecord.targetConsumerSummary,
      competitionLevel: detailRecord.competitionLevel,
      competitionSummary: detailRecord.competitionSummary,
      relatedTrend: {
        id: detailRecord.relatedTrend.id,
        title: detailRecord.relatedTrend.title,
      },
    });
  });

  it("rejects detail records without the persisted type", () => {
    expect(() => toOpportunityDetail({ ...detailRecord, opportunityType: " " }))
      .toThrow(OpportunityDisplayContractError);
  });
});
