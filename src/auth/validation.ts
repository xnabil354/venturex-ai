import { z } from "zod";

import { USER_TYPES } from "./user-types";

export const registrationSchema = z
  .object({
    email: z.string().trim().email().max(320),
    password: z.string().min(8).max(128),
    passwordConfirmation: z.string().min(8).max(128),
  })
  .refine((input) => input.password === input.passwordConfirmation, {
    message: "Password confirmation does not match.",
    path: ["passwordConfirmation"],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const credentialsSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(128),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}


export const userTypeSelectionSchema = z.object({
  userType: z.enum([USER_TYPES.ENTREPRENEUR, USER_TYPES.UMKM_EXISTING]),
});

export const userTypeSwitchSchema = userTypeSelectionSchema.strict();

export type UserTypeSelectionInput = z.infer<typeof userTypeSelectionSchema>;
