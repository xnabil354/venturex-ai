import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  createPendingPayment: vi.fn(),
  createInvoice: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/billing/service", () => ({
  BillingService: class { createPendingPayment(...args: unknown[]) { return mocks.createPendingPayment(...args); } },
}));
vi.mock("@/billing/checkout", () => ({ createDuitkuPopInvoice: mocks.createInvoice }));

import { POST } from "./route";

const user = { id: "90000000-0000-4000-8000-000000000001", email: "member@example.com", userType: "ENTREPRENEUR", onboardingStatus: "COMPLETED" } as const;

function request(productCode = "PREMIUM_30") {
  return new Request("http://localhost:3000/api/v1/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Host: "localhost:3000" },
    body: JSON.stringify({ productCode }),
  });
}

describe("Billing checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue(user);
    mocks.createPendingPayment.mockResolvedValue({ paymentId: "payment-id", merchantOrderId: "VX-1", amount: 84_000 });
    mocks.createInvoice.mockResolvedValue({ paymentUrl: "https://sandbox.duitku.com/pay/VX-1" });
  });

  it("accepts a server catalog code and returns the provider checkout URL", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.createPendingPayment).toHaveBeenCalledWith(user.id, "PREMIUM_30");
  });

  it("does not misreport an internal payment write failure as an invalid product", async () => {
    mocks.user.mockResolvedValue({ ...user, id: "90000000-0000-4000-8000-000000000002" });
    mocks.createPendingPayment.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("CHECKOUT_UNAVAILABLE");
  });
});
