import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Accepts local (assumed India) or international numbers and normalises to E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const parsed = parsePhoneNumberFromString(value, "IN");
    if (!parsed || !parsed.isValid()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number." });
      return z.NEVER;
    }
    return parsed.number as string;
  });

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.");

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(72) });
export const phoneOnlySchema = z.object({ phone: phoneSchema });
export const phoneCodeSchema = z.object({ phone: phoneSchema, code: otpCodeSchema });
export const resetPasswordSchema = z.object({ resetToken: z.string().min(10), newPassword: passwordSchema });

export const savedMovieSchema = z.object({
  externalMovieId: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(300),
  poster: z.string().url().max(1000).nullable().optional(),
  year: z.number().int().min(1800).max(2200).nullable().optional(),
  rating: z.number().min(0).max(10).nullable().optional(),
});
