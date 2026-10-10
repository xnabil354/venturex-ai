"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui";
import type { OpportunitySaveState, SavedOpportunityActionState } from "@/opportunity/saved-dto";
import { setOpportunitySavedAction } from "@/opportunity/saved-actions";

export function SavedOpportunityControl({
  initialState,
  opportunityId,
}: {
  readonly initialState: OpportunitySaveState;
  readonly opportunityId: string;
}) {
  if (initialState.status === "ERROR") {
    return (
      <section aria-label="Status simpanan Opportunity" className="grid justify-items-start gap-8">
        <p className="text-body-sm text-stone-gray" role="alert">
          Status simpanan belum dapat dimuat.
        </p>
        <Button onClick={() => window.location.reload()} type="button" variant="secondary">
          Coba lagi
        </Button>
      </section>
    );
  }

  return (
    <AvailableSavedOpportunityControl initialSaved={initialState.saved} opportunityId={opportunityId} />
  );
}

function AvailableSavedOpportunityControl({
  initialSaved,
  opportunityId,
}: {
  readonly initialSaved: boolean;
  readonly opportunityId: string;
}) {
  const initialActionState: SavedOpportunityActionState = {
    status: "IDLE",
    saved: initialSaved,
    message: null,
  };
  const [state, formAction, isPending] = useActionState(
    setOpportunitySavedAction,
    initialActionState,
  );

  return (
    <section aria-label="Status simpanan Opportunity" className="grid justify-items-start gap-8">
      <form action={formAction} aria-busy={isPending} className="flex flex-wrap items-center gap-12">
        <input name="opportunityId" type="hidden" value={opportunityId} />
        <Button
          disabled={isPending}
          name="intent"
          type="submit"
          value={state.saved ? "unsave" : "save"}
          variant={state.saved ? "secondary" : "primary"}
        >
          {isPending
            ? state.saved ? "Menghapus simpanan…" : "Menyimpan…"
            : state.saved ? "Hapus dari simpanan" : "Simpan opportunity"}
        </Button>
      </form>
      {state.status === "SUCCESS" && state.message ? (
        <p className="text-body-sm text-stone-gray" role="status">{state.message}</p>
      ) : null}
      {state.status === "ERROR" && state.message ? (
        <p className="text-body-sm text-stone-gray" role="alert">{state.message}</p>
      ) : null}
    </section>
  );
}
