import { PASSWORD_MAX, PASSWORD_MIN } from '@/src/constants';

/**
 * The rule for a NEW password (sign-up and reset): 8-128 characters, one lowercase letter, one
 * uppercase letter, one number. The server checks the same rule (PASSWORD_PATTERN in
 * packages/shared); this is the instant feedback behind the checklist under the field.
 */
export interface PasswordRule {
  id: 'length' | 'lowercase' | 'uppercase' | 'number';
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN} characters`, test: (p) => p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX },
  { id: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number', test: (p) => /\d/.test(p) },
];

export const isStrongPassword = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));
