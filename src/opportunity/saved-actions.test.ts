import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  setSaved: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./saved-service", () => ({
  SavedOpportunityService: class MockSavedOpportunityService {
    setSaved(id: string, saved: boolean) {
      return mocks.setSaved(id, saved);
    }
  },
}));

import { setOpportunitySavedAction } from "./saved-actions";
import type { SavedOpportunityActionState } from "./saved-dto";

const opportunityId = "60000000-0000-4000-8000-000000000001";
const initialState: SavedOpportunityActionState = {
  status: "IDLE",
  saved: false,
  message: null,
};

function formData(id: string, intent: string): FormData {
  const data = new FormData();
  data.set("opportunityId", id);
  data.set("intent", intent);
  return data;
}

describe("setOpportunitySavedAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the opportunity and refreshes both affected routes", async () => {
    mocks.setSaved.mockResolvedValue(true);

    await expect(setOpportunitySavedAction(initialState, formData(opportunityId, "save")))
      .resolves.toEqual({
        status: "SUCCESS",
        saved: true,
        message: "Opportunity tersimpan.",
      });
    expect(mocks.setSaved).toHaveBeenCalledWith(opportunityId, true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/opportunities/${opportunityId}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/saved");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/saved-opportunities");
  });

  it("unsaves only through the service action", async () => {
    mocks.setSaved.mockResolvedValue(false);

    await expect(setOpportunitySavedAction({ ...initialState, saved: true }, formData(opportunityId, "unsave")))
      .resolves.toMatchObject({ status: "SUCCESS", saved: false });
    expect(mocks.setSaved).toHaveBeenCalledWith(opportunityId, false);
  });

  it.each([["invalid", "save"], [opportunityId, "delete"]])(
    "rejects invalid ID or intent without calling the service",
    async (id, intent) => {
      await expect(setOpportunitySavedAction(initialState, formData(id, intent)))
        .resolves.toMatchObject({ status: "ERROR", saved: false });
      expect(mocks.setSaved).not.toHaveBeenCalled();
    },
  );

  it("does not reveal whether an ineligible opportunity was saved", async () => {
    mocks.setSaved.mockResolvedValue(null);

    await expect(setOpportunitySavedAction(initialState, formData(opportunityId, "save")))
      .resolves.toMatchObject({ status: "ERROR", saved: false });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a safe error state when persistence fails", async () => {
    mocks.setSaved.mockRejectedValue(new Error("database internals"));

    const result = await setOpportunitySavedAction(initialState, formData(opportunityId, "save"));
    expect(result).toMatchObject({ status: "ERROR", saved: false });
    expect(result.message).not.toContain("database internals");
  });
});
