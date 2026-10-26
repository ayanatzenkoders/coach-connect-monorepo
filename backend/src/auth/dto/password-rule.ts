/**
 * The password rule for NEW passwords (sign-up and reset): 8 to 128 characters with at least one
 * lowercase letter, one uppercase letter and one number. (Login does not apply it: it only checks
 * what was stored, so older accounts keep working.)
 *
 * The mobile app shows the same four rules as a live checklist (mobile/src/auth/passwordRules.ts).
 * Keep the two in step.
 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

export const PASSWORD_RULE_MESSAGE =
  'Password must be 8 to 128 characters with one lowercase letter, one uppercase letter and one number.';
