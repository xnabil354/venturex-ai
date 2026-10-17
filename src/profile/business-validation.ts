import { z } from "zod";

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const MAX_REFERENCE_IDS = 100;

function optionalTextSchema(maximum: number) {
  return z
    .union([z.string().trim().max(maximum), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));
}

function normalizeProductName(value: string): string {
  return value.trim().normalize("NFC").replace(/\s+/gu, " ");
}

function productComparisonKey(name: string): string {
  return name.toLowerCase();
}

const referenceIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(MAX_REFERENCE_IDS)
  .transform((ids) => [...new Set(ids)].sort());

const locationSchema = z
  .object({
    text: z.string().trim().min(1).max(255),
    city: optionalTextSchema(120),
    province: optionalTextSchema(120),
    district: z.string().trim().max(120).nullable().optional(),
    subdistrict: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

const averagePriceSchema = z
  .object({
    min: z.number().int().min(0).max(MAX_SAFE_INTEGER),
    max: z.number().int().min(0).max(MAX_SAFE_INTEGER),
  })
  .strict()
  .refine((value) => value.max >= value.min, {
    message: "Harga maksimum harus lebih besar atau sama dengan minimum.",
    path: ["max"],
  });

const productSchema = z
  .object({
    name: z.string().transform(normalizeProductName).pipe(z.string().min(1).max(180)),
    categoryId: z
      .union([z.string().uuid(), z.null()])
      .optional()
      .transform((value) => value ?? null),
    price: z
      .union([z.number().int().min(0).max(MAX_SAFE_INTEGER), z.null()])
      .optional()
      .transform((value) => value ?? null),
  })
  .strict();

export const businessProfileSchema = z
  .object({
    businessName: z.string().trim().min(1).max(180),
    businessCategoryId: z.string().uuid(),
    location: locationSchema,
    averagePrice: averagePriceSchema,
    products: z.array(productSchema).min(1).max(20),
    customerSegmentIds: referenceIdsSchema,
    salesChannelIds: referenceIdsSchema,
    businessDescription: optionalTextSchema(1000),
    notes: optionalTextSchema(2000),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Map<string, number>();
    for (const [index, product] of value.products.entries()) {
      const key = productComparisonKey(product.name);
      const previousIndex = seen.get(key);
      if (previousIndex !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Nama produk tidak boleh duplikat setelah normalisasi.",
          path: ["products", index, "name"],
        });
        context.addIssue({
          code: "custom",
          message: "Nama produk tidak boleh duplikat setelah normalisasi.",
          path: ["products", previousIndex, "name"],
        });
      } else {
        seen.set(key, index);
      }
    }
  });

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export { normalizeProductName, productComparisonKey };
