import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn((destination: string): never => { throw new Error(`REDIRECT:${destination}`); }));
vi.mock("next/navigation", () => ({ redirect }));

import BillingReturnPage from "./page";

describe("legacy billing return", () => {
  it("sends older Duitku invoices directly to the billing status notice", () => {
    expect(() => BillingReturnPage()).toThrow("REDIRECT:/billing?payment=verifying");
  });
});
