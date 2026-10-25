// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ snapshot: { plan: "PREMIUM", planEndsAt: "2999-01-01T00:00:00Z" } }));
vi.mock("@/components/billing/billing-state", () => ({ useBillingState: () => ({ snapshot: mocks.snapshot }) }));

import { BillingCheckoutButton } from "./billing-checkout-button";

afterEach(cleanup);

describe("billing checkout button", () => {
  it("disables the active Premium plan but leaves Pro available", () => {
    render(<>
      <BillingCheckoutButton plan="PREMIUM" productCode="PREMIUM_30">Pilih Premium</BillingCheckoutButton>
      <BillingCheckoutButton plan="PRO" productCode="PRO_30">Pilih Pro</BillingCheckoutButton>
    </>);
    expect(screen.getByRole("button", { name: "Paket aktif" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Pilih Pro" }).hasAttribute("disabled")).toBe(false);
  });
});
