// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  snapshot: { plan: "FREE" as const, planEndsAt: null, trialEndsAt: "2026-11-24T00:00:00Z", accessDaysRemaining: 30, scheduledPlan: null, scheduledStartsAt: null, canUseAi: false, availableCredits: 0, expiringCredits: 0, topupCredits: 0, requiresRenewal: false },
  refreshBilling: vi.fn(async () => ({})),
  refreshRoute: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refreshRoute }) }));
vi.mock("@/components/billing/billing-state", () => ({ useBillingState: () => ({ snapshot: mocks.snapshot, refresh: mocks.refreshBilling }) }));

import { BillingPaymentStatus } from "./billing-payment-status";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("billing payment return notice", () => {
  it("shows the verification message on billing and offers a manual refresh", async () => {
    render(<BillingPaymentStatus initialSummary={mocks.snapshot} showNotice />);
    expect(screen.getByRole("status").textContent).toContain("sedang diverifikasi");
    fireEvent.click(screen.getByRole("button", { name: "Perbarui status" }));
    await waitFor(() => expect(mocks.refreshBilling).toHaveBeenCalled());
    await waitFor(() => expect(mocks.refreshRoute).toHaveBeenCalled());
  });

  it("refreshes the server-rendered billing details after an event changes the balance", async () => {
    const initialSummary = { ...mocks.snapshot };
    const view = render(<BillingPaymentStatus initialSummary={initialSummary} showNotice={false} />);
    mocks.snapshot = { ...mocks.snapshot, availableCredits: 5 };
    view.rerender(<BillingPaymentStatus initialSummary={initialSummary} showNotice={false} />);
    await waitFor(() => expect(mocks.refreshRoute).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });
});
