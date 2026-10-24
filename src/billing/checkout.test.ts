import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    APP_URL: "https://example.ngrok-free.dev",
    DUITKU_MERCHANT_CODE: "D1234",
    DUITKU_API_KEY: "sandbox-test-key",
  }),
}));

import { createDuitkuPopInvoice } from "./checkout";

describe("createDuitkuPopInvoice", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses Duitku's documented sandbox inquiry endpoint and BCA virtual account method", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      paymentUrl: "https://sandbox.duitku.com/topup/topupdirectv2.aspx?ref=reference-1",
      reference: "reference-1",
      statusCode: "00",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createDuitkuPopInvoice({
      merchantOrderId: "VX-123",
      amount: 20_000,
      productDetails: "10 kredit",
      email: "user@example.com",
    })).resolves.toEqual({
      paymentUrl: "https://sandbox.duitku.com/topup/topupdirectv2.aspx?ref=reference-1",
      reference: "reference-1",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      merchantCode: "D1234",
      merchantOrderId: "VX-123",
      paymentAmount: 20_000,
      paymentMethod: "BC",
      productDetails: "10 kredit",
      email: "user@example.com",
      customerVaName: "VENTUREX",
      itemDetails: [{ name: "10 kredit", price: 20_000, quantity: 1 }],
      callbackUrl: "https://example.ngrok-free.dev/api/v1/billing/duitku/callback",
      returnUrl: "https://example.ngrok-free.dev/billing/return",
    });
  });
});
