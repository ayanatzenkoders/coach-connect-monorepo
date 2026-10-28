import { isStrongPassword, PASSWORD_RULES } from '@/src/utils/helpers/passwordRules';

describe('password rules (must match the backend)', () => {
  it.each(['Password123!', 'Abcdefg1', 'Brand-new-pass-9', 'aA1aaaaa'])('accepts %s', (p) => {
    expect(isStrongPassword(p)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['Abcde1f', '7 characters'],
    ['alllowercase1', 'no uppercase'],
    ['ALLUPPERCASE1', 'no lowercase'],
    ['NoNumbersHere', 'no number'],
    ['a'.repeat(129) + 'A1', 'longer than 128'],
  ])('refuses %s (%s)', (p) => {
    expect(isStrongPassword(p)).toBe(false);
  });

  it('lists exactly the four rules', () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual(['length', 'lowercase', 'uppercase', 'number']);
  });

  it('marks each rule independently', () => {
    const met = (pw: string) => PASSWORD_RULES.filter((r) => r.test(pw)).map((r) => r.id);
    expect(met('abc')).toEqual(['lowercase']);
    expect(met('ABC1')).toEqual(['uppercase', 'number']);
  });
});
