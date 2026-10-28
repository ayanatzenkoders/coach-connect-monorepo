import { z } from "zod";
import { COACH_BIO_MAX, COACH_BIO_MIN, COACH_MAX_SPECIALTIES, COACH_SPECIALTIES } from "../constants";
import { CodeSchema, DateOfBirthSchema, DeviceIdSchema, EmailSchema, PhoneSchema } from "./common";
import { NewPasswordSchema } from "./password";

// strictObject: unknown fields are rejected (400), so a client cannot slip in e.g. { role: "ADMIN" }.

export const RegisterInputSchema = z.strictObject({
  email: EmailSchema,
  password: NewPasswordSchema,
  name: z.string().min(1).max(80),
  dateOfBirth: DateOfBirthSchema,
  deviceId: DeviceIdSchema,
  deviceName: z.string().max(100).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

/**
 * A coach applies from the app: the same fields as a member plus the details an admin needs to decide.
 * The phone number is only ever shown to admins. The account cannot be used until an admin approves it.
 */
export const RegisterCoachInputSchema = RegisterInputSchema.extend({
  phone: PhoneSchema,
  bio: z.string().trim().min(COACH_BIO_MIN, `Tell us a little more (at least ${COACH_BIO_MIN} characters)`).max(COACH_BIO_MAX),
  specialties: z
    .array(z.enum(COACH_SPECIALTIES))
    .min(1, "Pick at least one specialty")
    .max(COACH_MAX_SPECIALTIES, `Pick up to ${COACH_MAX_SPECIALTIES} specialties`)
    .refine((list) => new Set(list).size === list.length, "Each specialty only once"),
});
export type RegisterCoachInput = z.infer<typeof RegisterCoachInputSchema>;

export const LoginInputSchema = z.strictObject({
  email: EmailSchema,
  password: z.string().min(1).max(128),
  deviceId: DeviceIdSchema,
  deviceName: z.string().max(100).optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RefreshInputSchema = z.strictObject({
  refreshToken: z.string().min(1).max(256),
});
export type RefreshInput = z.infer<typeof RefreshInputSchema>;

export const VerifyEmailInputSchema = z.strictObject({ code: CodeSchema });
export type VerifyEmailInput = z.infer<typeof VerifyEmailInputSchema>;

export const ForgotPasswordInputSchema = z.strictObject({ email: EmailSchema });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const VerifyResetCodeInputSchema = z.strictObject({ email: EmailSchema, code: CodeSchema });
export type VerifyResetCodeInput = z.infer<typeof VerifyResetCodeInputSchema>;

export const ResetPasswordInputSchema = z.strictObject({
  /** The short-lived token returned by verify-code. It proves the emailed code was correct. */
  resetToken: z.string().min(1).max(2000),
  newPassword: NewPasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
