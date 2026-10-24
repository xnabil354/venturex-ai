import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ settleCallback: vi.fn() }));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    DUITKU_MERCHANT_CODE: "D1234",
    DUITKU_API_KEY: "sandbox-test-key",
  }),
}));
vi.mock("@/billing/service", () => ({
  BillingService: class {
    settleCallback(...args: unknown[]) { return mocks.settleCallback(...args); }
  },
}));

import { POST } from "./route";

function callbackRequest(): Request {
  const merchantCode = "D1234";
  const amount = "146000";
  const merchantOrderId = "VX-virtual-account-order";
  const signature = createHmac("sha256", "sandbox-test-key")
    .update(`${merchantCode}${amount}${merchantOrderId}`)
    .digest("hex");
  const body = new URLSearchParams({
    merchantCode,
    amount,
    merchantOrderId,
    productDetail: "Pro 30 hari",
    additionalParam: "",
    resultCode: "00",
    paymentCode: "BC",
    merchantUserId: "",
    reference: "DUITKU-REFERENCE-1",
    signature,
    publisherOrderId: "PUBLISHER-ORDER-1",
    settlementDate: "2026-10-24",
    vaNumber: "1234567890123456",
    sourceAccount: "",
  });
  return new Request("https://example.test/api/v1/billing/duitku/callback", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("Duitku callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settleCallback.mockResolvedValue("ACK");
  });

  it("accepts a signed Virtual Account callback with documented provider extension fields", async () => {
    const response = await POST(callbackRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    expect(mocks.settleCallback).toHaveBeenCalledWith({
      merchantOrderId: "VX-virtual-account-order",
      amount: "146000",
      resultCode: "00",
      reference: "DUITKU-REFERENCE-1",
      paymentMethod: "BC",
      signatureValid: true,
    });
  });

  it("rejects duplicate signed fields before settlement", async () => {
    const request = callbackRequest();
    const body = await request.text();
    const response = await POST(new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `${body}&amount=146000`,
    }));

    expect(response.status).toBe(400);
    expect(mocks.settleCallback).not.toHaveBeenCalled();
  });
});
