/** A quick "does this look like an email" check for instant feedback; the server validates again. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string) => EMAIL_PATTERN.test(email.trim());

/**
 * The date-of-birth box: keep only digits and add the dashes as the person types ("19900517" -> "1990-05-17"),
 * so nobody has to type them and the keyboard can stay numeric.
 */
export function formatDobInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** A real calendar day "YYYY-MM-DD", not in the future, not before 1900. Same rule as the server (any age is fine). */
export function isValidDob(value: string, today: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(value)) return false; // rejects 2020-02-31
  return value >= '1900-01-01' && value <= today.toISOString().slice(0, 10);
}

/** Digits, spaces, dashes, brackets and an optional leading +, at least 7 digits. The server checks again. */
export const isValidPhone = (value: string): boolean => /^\+?[0-9 ()-]{7,20}$/.test(value.trim()) && (value.match(/\d/g) ?? []).length >= 7;
