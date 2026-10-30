import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { barHeights, barSummary, dayLabel, getStats } from './dashboard';
import { login, resetSessionForTests } from './session';

describe('barHeights', () => {
  it('scales to the tallest bar, and an empty day has no bar', () => {
    expect(barHeights([0, 5, 10])).toEqual([0, 50, 100]);
  });
  it('a day with people never looks empty (at least a sliver)', () => {
    expect(barHeights([1, 100])).toEqual([4, 100]);
  });
  it('no sign-ups at all is flat, not a division by zero', () => {
    expect(barHeights([0, 0, 0])).toEqual([0, 0, 0]);
    expect(barHeights([])).toEqual([]);
  });
});

describe('labels', () => {
  it('writes a calendar day without shifting it by time zone', () => {
    expect(dayLabel('2026-10-29')).toBe('29 Oct');
    expect(dayLabel('2026-01-01')).toBe('1 Jan');
    expect(dayLabel('garbage')).toBe('garbage');
  });
  it('the bar sentence uses singular and plural', () => {
    expect(barSummary('2026-10-29', 1)).toBe('29 Oct: 1 sign-up');
    expect(barSummary('2026-10-29', 0)).toBe('29 Oct: 0 sign-ups');
    expect(barSummary('2026-10-29', 3)).toBe('29 Oct: 3 sign-ups');
  });
});

describe('getStats', () => {
  beforeEach(() => resetSessionForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('asks the stats route as the signed-in staff member', async () => {
    const staff = { id: 's1', email: 'admin@coachconnect.dev', name: 'Noor', role: 'ADMIN', emailVerified: true };
    const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    const fetchMock = vi.fn().mockReturnValueOnce(ok({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 900, user: staff })).mockReturnValueOnce(ok({ users: {} }));
    vi.stubGlobal('fetch', fetchMock);
    await login('admin@coachconnect.dev', 'pw');
    await getStats();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('/api/admin/stats');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });
});
