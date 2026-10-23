import type { BusinessProfileInput } from "../profile/business-validation";

export type BusinessQueryOption = { key: string; label: string; query: string };
export function businessQueryOptions(profile: BusinessProfileInput, categoryName?: string): BusinessQueryOption[] {
  const options = [{ key: "business", label: `Nama bisnis: ${profile.businessName}`, query: profile.businessName }, ...profile.products.map((p, index) => ({ key: `product:${index}`, label: `Produk: ${p.name}`, query: p.name })), ...(categoryName ? [{ key: "category", label: `Kategori: ${categoryName}`, query: categoryName }] : [])];
  return options.map(option => ({ ...option, query: option.query.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 80) }));
}
