import { createHmac, timingSafeEqual } from "node:crypto";

export type DuitkuCallback = {
  readonly merchantCode: string;
  readonly amount: string;
  readonly merchantOrderId: string;
  readonly resultCode: string;
  readonly reference?: string | undefined;
  readonly paymentCode?: string | undefined;
  readonly signature: string;
};

function hmac(input: string, apiKey: string): string {
  return createHmac("sha256", apiKey).update(input, "utf8").digest("hex");
}

function equalSignature(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createDuitkuSignature(merchantCode: string, merchantOrderId: string, paymentAmount: number, apiKey: string): string {
  return hmac(`${merchantCode}${merchantOrderId}${paymentAmount}`, apiKey);
}

export function verifyDuitkuCallback(callback: DuitkuCallback, merchantCode: string, apiKey: string): boolean {
  if (callback.merchantCode !== merchantCode || !/^\d+$/u.test(callback.amount) || !callback.merchantOrderId || !/^[a-f0-9]{64}$/iu.test(callback.signature)) return false;
  return equalSignature(callback.signature.toLowerCase(), hmac(`${callback.merchantCode}${callback.amount}${callback.merchantOrderId}`, apiKey));
}

export function isDuitkuPaid(resultCode: string): boolean {
  return resultCode === "00";
}
