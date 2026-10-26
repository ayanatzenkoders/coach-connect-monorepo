import { z } from "zod";
import { CodeSchema, DeviceIdSchema, EmailSchema } from "./common";
import { NewPasswordSchema } from "./password";

// strictObject: unknown fields are rejected (400), so a client cannot slip in e.g. { role: "ADMIN" }.

export const RegisterInputSchema = z.strictObject({
  email: EmailSchema,
  password: NewPasswordSchema,
  name: z.string().min(1).max(80),
  deviceId: DeviceIdSchema,
  deviceName: z.string().max(100).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

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
