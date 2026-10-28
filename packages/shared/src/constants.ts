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

/**
 * Group chats (and the group calls they will lead to): 6 people at most, with ONE coach at most.
 * The size matches the call rule "1 caller + 1 coach + up to 4 members".
 */
export const GROUP_MIN_MEMBERS = 3;
export const GROUP_MAX_MEMBERS = 6;
export const GROUP_TITLE_MAX = 60;
export const GROUP_DESCRIPTION_MAX = 300;

export const BAN_REASONS = ["Harassment of a coach", "Spam or scams", "Payment fraud", "Other"] as const;

/**
 * Coaches sign up from the app and wait for an admin. The specialties they can pick (the tags members filter by),
 * so the directory never fills up with spelling variants of the same topic.
 */
export const COACH_SPECIALTIES = [
  "Burnout",
  "Career transitions",
  "Difficult conversations",
  "Interview prep",
  "Leadership",
  "New managers",
  "Promotion cases",
  "Remote work",
  "Salary talks",
  "Work-life balance",
] as const;
export const COACH_MAX_SPECIALTIES = 5;
export const COACH_BIO_MIN = 20;
export const COACH_BIO_MAX = 600;
