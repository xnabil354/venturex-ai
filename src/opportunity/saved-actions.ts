"use server";

import { revalidatePath } from "next/cache";

import { opportunityIdSchema } from "./domain";
import type { SavedOpportunityActionState } from "./saved-dto";
import { SavedOpportunityService } from "./saved-service";

export async function setOpportunitySavedAction(
  previousState: SavedOpportunityActionState,
  formData: FormData,
): Promise<SavedOpportunityActionState> {
  const opportunityId = formData.get("opportunityId");
  const intent = formData.get("intent");
  if (
    typeof opportunityId !== "string" ||
    !opportunityIdSchema.safeParse(opportunityId).success ||
    (intent !== "save" && intent !== "unsave")
  ) {
    return {
      status: "ERROR",
      saved: previousState.saved,
      message: "Perubahan simpanan belum dapat diterapkan.",
    };
  }

  try {
    const saved = await new SavedOpportunityService().setSaved(opportunityId, intent === "save");
    if (saved === null) {
      return {
        status: "ERROR",
        saved: previousState.saved,
        message: "Opportunity ini tidak tersedia untuk jenis akun Anda.",
      };
    }

    revalidatePath(`/opportunities/${opportunityId}`);
    revalidatePath("/saved-opportunities");
    return {
      status: "SUCCESS",
      saved,
      message: saved ? "Opportunity tersimpan." : "Opportunity dihapus dari simpanan.",
    };
  } catch {
    return {
      status: "ERROR",
      saved: previousState.saved,
      message: "Perubahan simpanan belum dapat disimpan. Coba lagi.",
    };
  }
}
