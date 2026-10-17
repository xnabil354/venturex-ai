import { z } from "zod";
import { OTHER_FNB_CATEGORY_ID } from "../reference/constants";

export const EXPERIENCE_LEVELS = {
  BEGINNER: "BEGINNER",
  SOME_EXPERIENCE: "SOME_EXPERIENCE",
  EXPERIENCED: "EXPERIENCED",
} as const;

export type ExperienceLevel =
  (typeof EXPERIENCE_LEVELS)[keyof typeof EXPERIENCE_LEVELS];

export const TIME_COMMITMENTS = {
  LIMITED: "LIMITED",
  PART_TIME: "PART_TIME",
  FULL_TIME: "FULL_TIME",
} as const;

export type TimeCommitment =
  (typeof TIME_COMMITMENTS)[keyof typeof TIME_COMMITMENTS];

const referenceIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .transform((ids) => [...new Set(ids)].sort());

function optionalTextSchema(maximum: number) {
  return z
    .union([z.string().trim().max(maximum), z.null()])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));
}

const optionalLongTextSchema = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const requiredRegionNameSchema = z.string().trim().min(1).max(120);

const locationSchema = z
  .object({
    text: z.string().trim().min(1).max(255),
    city: requiredRegionNameSchema,
    province: requiredRegionNameSchema,
    district: requiredRegionNameSchema,
    subdistrict: requiredRegionNameSchema,
    countryCode: z.literal("ID").optional(),
  })
  .strict()
  .transform(({ text, city, province, district, subdistrict }) => ({
    text,
    city,
    province,
    district,
    subdistrict,
    countryCode: "ID" as const,
  }));

const editableLocationSchema = z
  .object({
    text: z.string().trim().min(1).max(255),
    city: optionalTextSchema(120),
    province: optionalTextSchema(120),
    district: optionalTextSchema(120),
    subdistrict: optionalTextSchema(120),
    countryCode: z.literal("ID").optional(),
  })
  .strict()
  .transform(({ text, city, province, district, subdistrict }) => ({
    text,
    city,
    province,
    district,
    subdistrict,
    countryCode: "ID" as const,
  }));

const budgetSchema = z
  .object({
    min: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    max: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .refine((budget) => budget.max >= budget.min, {
    message: "Budget maksimum harus lebih besar atau sama dengan minimum.",
    path: ["max"],
  });

const entrepreneurProfileFields = {
  budget: budgetSchema,
  experienceLevel: z.enum([
    EXPERIENCE_LEVELS.BEGINNER,
    EXPERIENCE_LEVELS.SOME_EXPERIENCE,
    EXPERIENCE_LEVELS.EXPERIENCED,
  ]),
  timeCommitment: z.enum([
    TIME_COMMITMENTS.LIMITED,
    TIME_COMMITMENTS.PART_TIME,
    TIME_COMMITMENTS.FULL_TIME,
  ]),
  interestCategoryIds: referenceIdsSchema,
  customerSegmentIds: referenceIdsSchema,
  salesChannelIds: referenceIdsSchema,
  preferredProductType: optionalTextSchema(100),
  businessObjective: optionalLongTextSchema,
  notes: optionalLongTextSchema,
};

function validateOtherCategory(
  profile: {
    readonly interestCategoryIds: readonly string[];
    readonly preferredProductType: string | null;
  },
  context: z.RefinementCtx,
): void {
  if (
    profile.interestCategoryIds.includes(OTHER_FNB_CATEGORY_ID) &&
    !profile.preferredProductType
  ) {
    context.addIssue({
      code: "custom",
      message: "Tuliskan jenis usaha lainnya.",
      path: ["preferredProductType"],
    });
  }
}

export const entrepreneurProfileSchema = z
  .object({ location: locationSchema, ...entrepreneurProfileFields })
  .strict()
  .superRefine(validateOtherCategory);

export const entrepreneurProfileEditSchema = z
  .object({ location: editableLocationSchema, ...entrepreneurProfileFields })
  .strict()
  .superRefine(validateOtherCategory);

export type EntrepreneurProfileInput = z.infer<
  typeof entrepreneurProfileSchema
>;

export type EntrepreneurProfileEditValues = z.infer<
  typeof entrepreneurProfileEditSchema
>;
