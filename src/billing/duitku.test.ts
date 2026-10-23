import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createDuitkuSignature, verifyDuitkuCallback } from "./duitku";

describe("Duitku signatures", () => {
  const merchantCode = "D1234";
  const apiKey = "sandbox-secret-key-for-tests";

  it("creates the create-invoice HMAC from the server-owned price", () => {
    expect(createDuitkuSignature(merchantCode, "VX-123", 84_000, apiKey)).toBe(
      createHmac("sha256", apiKey).update("D1234VX-12384000").digest("hex"),
    );
  });

  it("accepts only a callback signed for its merchant, amount, and order", () => {
    const signature = createHmac("sha256", apiKey).update("D123484000VX-123").digest("hex");
    expect(verifyDuitkuCallback({ merchantCode, amount: "84000", merchantOrderId: "VX-123", resultCode: "00", signature }, merchantCode, apiKey)).toBe(true);
    expect(verifyDuitkuCallback({ merchantCode, amount: "1", merchantOrderId: "VX-123", resultCode: "00", signature }, merchantCode, apiKey)).toBe(false);
  });
});
