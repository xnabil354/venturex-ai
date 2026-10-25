// @vitest-environment jsdom

import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BillingProvider, useBillingState, useCreditGate } from "./billing-state";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

class MockEventSource extends EventTarget {
  static current: MockEventSource | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor() { super(); MockEventSource.current = this; }
  close() {}
}

const initial = {
  plan: "PREMIUM" as const,
  planEndsAt: null,
  scheduledPlan: null,
  scheduledStartsAt: null,
  canUseAi: true,
  requiresRenewal: false,
  availableCredits: 5,
  expiringCredits: 5,
  topupCredits: 0,
};

function CreditView() {
  const billing = useBillingState();
  const gate = useCreditGate("DETAILED_ANALYSIS");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  return <>
    <span data-testid="balance">{billing?.stale ? "stale" : billing?.snapshot?.availableCredits}</span>
    <span data-testid="allowed">{allowed === null ? "unknown" : String(allowed)}</span>
    <button onClick={() => { void gate.check().then(setAllowed); }} type="button">Periksa kredit</button>
    {gate.notice}
  </>;
}

beforeEach(() => vi.stubGlobal("EventSource", MockEventSource));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); MockEventSource.current = null; });

describe("billing event state", () => {
  it("redirects an open protected page when an expiry update arrives", async () => {
    navigation.replace.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { ...initial, canUseAi: false, requiresRenewal: true, usageCosts: [] } }), { status: 200 })));
    render(<BillingProvider initialSummary={initial} redirectOnExpiredPlan><CreditView /></BillingProvider>);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/billing"));
  });

  it("refreshes the authoritative balance when the server emits a change", async () => {
    let availableCredits = 5;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: { ...initial, availableCredits, usageCosts: [{ usage: "DETAILED_ANALYSIS", credits: 3 }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<BillingProvider initialSummary={initial}><CreditView /></BillingProvider>);
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    availableCredits = 2;
    act(() => MockEventSource.current?.dispatchEvent(new Event("changed")));
    await waitFor(() => expect(screen.getByTestId("balance").textContent).toBe("2"));
    expect(screen.getByRole("alert").textContent).toContain("Kredit tidak cukup");

    act(() => MockEventSource.current?.dispatchEvent(new Event("unavailable")));
    expect(screen.getByTestId("balance").textContent).toBe("stale");
    act(() => MockEventSource.current?.dispatchEvent(new Event("ready")));
    await waitFor(() => expect(screen.getByTestId("balance").textContent).toBe("2"));
  });

  it("blocks an action before submission when the current tariff exceeds the balance", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: { ...initial, availableCredits: 2, usageCosts: [{ usage: "DETAILED_ANALYSIS", credits: 3 }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    render(<BillingProvider initialSummary={initial}><CreditView /></BillingProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Periksa kredit" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("3 kredit"));
    expect(screen.getByRole("alert").textContent).toContain("2 kredit");
    expect(screen.getByTestId("allowed").textContent).toBe("false");
  });

  it("permits a zero-credit tariff when the account still has AI access", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { ...initial, availableCredits: 0, usageCosts: [{ usage: "DETAILED_ANALYSIS", credits: 0 }] } }), { status: 200 })));
    render(<BillingProvider initialSummary={initial}><CreditView /></BillingProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Periksa kredit" }));
    await waitFor(() => expect(screen.getByTestId("allowed").textContent).toBe("true"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
