import { clockTime, listTime, longDate } from '@/src/utils/helpers/time';

// Local times on purpose: the helpers format in the phone's own time zone.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const NOW = at(2026, 10, 26, 18, 0); // a Monday

describe('time helpers', () => {
  it('writes clock times the way the design does', () => {
    expect(clockTime(at(2026, 10, 26, 17, 48))).toBe('5:48 PM');
    expect(clockTime(at(2026, 10, 26, 0, 5))).toBe('12:05 AM');
    expect(clockTime(at(2026, 10, 26, 12, 0))).toBe('12:00 PM');
  });

  it('shows the time today, Yesterday, a weekday this week, otherwise the date', () => {
    expect(listTime(at(2026, 10, 26, 9, 30).toISOString(), NOW)).toBe('9:30 AM');
    expect(listTime(at(2026, 10, 25, 23, 59).toISOString(), NOW)).toBe('Yesterday');
    expect(listTime(at(2026, 10, 22).toISOString(), NOW)).toBe('Thu');
    expect(listTime(at(2026, 10, 14).toISOString(), NOW)).toBe('Oct 14');
  });

  it('writes a full date for the Profile: "Nov 27, 2026"', () => {
    expect(longDate(at(2026, 11, 27, 12).toISOString())).toBe('Nov 27, 2026');
    expect(longDate(at(2027, 1, 3, 12).toISOString())).toBe('Jan 3, 2027');
  });

  it('gives an empty text, never "Invalid Date", for a missing or broken date', () => {
    expect(longDate(null)).toBe('');
    expect(longDate(undefined)).toBe('');
    expect(longDate('')).toBe('');
    expect(longDate('not a date')).toBe('');
  });
});
