import { formatDobInput, isValidDob, isValidPhone } from '@/src/utils/helpers';

describe('formatDobInput: dashes appear while typing', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['1990', '1990'],
    ['19900', '1990-0'],
    ['199005', '1990-05'],
    ['1990051', '1990-05-1'],
    ['19900517', '1990-05-17'],
    ['1990-05-17', '1990-05-17'],
    ['199005179999', '1990-05-17'], // nothing past the 8th digit
    ['19a9/0b5', '1990-5'], // letters and slashes are dropped
  ])('%s -> %s', (typed, shown) => expect(formatDobInput(typed)).toBe(shown));
});

describe('isValidDob', () => {
  const today = new Date('2026-10-29T12:00:00Z');
  it('accepts real days, including a leap day and today', () => {
    expect(isValidDob('1990-05-17', today)).toBe(true);
    expect(isValidDob('2024-02-29', today)).toBe(true);
    expect(isValidDob('2026-10-29', today)).toBe(true);
  });
  it.each(['2023-02-29', '2020-02-31', '1990-13-01', '1990-00-10', '1899-12-31', '2026-10-30', '90-05-17', '1990-5-17', '', 'abcd-ef-gh'])('refuses %s', (value) => expect(isValidDob(value, today)).toBe(false));
});

describe('isValidPhone', () => {
  it.each(['+49 170 1234567', '(555) 123-4567', '0170 1234567', '+1-555-123-4567'])('accepts %s', (v) => expect(isValidPhone(v)).toBe(true));
  it.each(['', 'abc', '12-34', '+++1234567', '123456', 'call me maybe'])('refuses %s', (v) => expect(isValidPhone(v)).toBe(false));
});
