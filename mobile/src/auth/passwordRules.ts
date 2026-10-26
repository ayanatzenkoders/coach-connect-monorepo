/**
 * The rule for a NEW password (sign-up and reset). Must match the backend
 * (backend/src/auth/dto/password-rule.ts): 8-128 characters, one lowercase letter,
 * one uppercase letter, one number. The server checks it again; this is for instant feedback.
 */
export interface PasswordRule {
  id: 'length' | 'lowercase' | 'uppercase' | 'number';
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 && p.length <= 128 },
  { id: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
];

export const isStrongPassword = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));
