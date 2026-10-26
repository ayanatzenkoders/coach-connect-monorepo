// Plain values every app needs. No dependencies, so mobile can import them without pulling zod into the bundle.

/** The rule for NEW passwords (sign-up and reset). Login does not apply it, so older accounts keep working. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;
export const PASSWORD_RULE_MESSAGE =
  "Password must be 8 to 128 characters with one lowercase letter, one uppercase letter and one number.";

/** Emailed one-time codes (verify email, reset password) are always this many digits. */
export const CODE_LENGTH = 6;

export const MESSAGE_MAX_LENGTH = 2000;

export const BAN_REASONS = ["Harassment of a coach", "Spam or scams", "Payment fraud", "Other"] as const;
