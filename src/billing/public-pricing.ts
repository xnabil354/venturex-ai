import "server-only";

import { BillingService, type BillingProductOffer } from "./service";

export type PublicPricingSnapshot = Readonly<{
  premium: Readonly<{ amount: number; credits: number }>;
  pro: Readonly<{ amount: number; credits: number }>;
}>;

function getOffer(
  offers: ReadonlyArray<BillingProductOffer>,
  code: "PREMIUM_30" | "PRO_30",
) {
  const offer = offers.find((item) => item.code === code);
  if (!offer) throw new Error("Katalog pembayaran belum lengkap.");
  return offer;
}

/** Returns only the public catalogue fields; payment and account data stay server-side. */
export async function getPublicPricingSnapshot(): Promise<PublicPricingSnapshot> {
  const billing = new BillingService();
  const offers = await billing.listProductOffers();
  const premium = getOffer(offers, "PREMIUM_30");
  const pro = getOffer(offers, "PRO_30");

  return {
    premium: { amount: premium.amount, credits: premium.credits },
    pro: { amount: pro.amount, credits: pro.credits },
  };
}
