import { z } from "zod";

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

const locationSchema = z
  .object({
    text: z.string().trim().min(1).max(255),
    city: optionalTextSchema(120),
    province: optionalTextSchema(120),
    countryCode: z.literal("ID").optional(),
  })
  .strict()
  .transform(({ text, city, province }) => ({
    text,
    city,
    province,
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

export const entrepreneurProfileSchema = z
  .object({
    location: locationSchema,
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
  })
  .strict();

export type EntrepreneurProfileInput = z.infer<
  typeof entrepreneurProfileSchema
>;
