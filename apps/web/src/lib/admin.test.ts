import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '@coach-connect/shared/types';
import { login, resetSessionForTests } from './session';
import { approveCoach, banUser, canApprove, canBan, birthDate, canManage, describeTags, listUsers, patchUser, shortDate, unbanUser, usersQueryString } from './admin';

const reply = (status: number, body?: unknown) => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => resetSessionForTests());

const user = (over: Partial<AdminUser> = {}): AdminUser => ({ id: 'u1', email: 'a@x.com', name: 'Ana', role: 'MEMBER', bannedAt: null, isApproved: null, emailVerified: true, phone: null, dateOfBirth: null, coach: null, createdAt: '2026-10-26T10:00:00.000Z', ...over });

describe('usersQueryString', () => {
  it('is empty with no filters, and leaves out empty ones', () => {
    expect(usersQueryString({ q: '', role: '', status: '' })).toBe('');
    expect(usersQueryString({ q: '   ', role: '', status: '' })).toBe('');
  });
  it('writes the filters and the cursor, URL-encoded', () => {
    expect(usersQueryString({ q: ' ana & co ', role: 'COACH', status: 'pending' }, 'abc')).toBe('?q=ana+%26+co&role=COACH&status=pending&cursor=abc');
  });
});

describe('requests', () => {
  // Signs in first (the requests go out as the signed-in person), then checks the request after the login.
  const call = async (fn: () => Promise<unknown>, answer: unknown = {}) => {
    const staff = { id: 's1', email: 'admin@coachconnect.dev', name: 'Noor', role: 'ADMIN', emailVerified: true };
    const fetchMock = vi.fn().mockReturnValueOnce(reply(200, { accessToken: 'tok', refreshToken: 'ref', expiresIn: 900, user: staff })).mockReturnValue(reply(200, answer));
    vi.stubGlobal('fetch', fetchMock);
    await login('admin@coachconnect.dev', 'pw');
    await fn();
    return { url: fetchMock.mock.calls[1]![0] as string, init: fetchMock.mock.calls[1]![1] };
  };

  it('lists users with the staff token', async () => {
    const { url, init } = await call(() => listUsers({ q: 'ana', role: '', status: 'banned' }, 'c1'), { items: [], nextCursor: null });
    expect(url).toBe('/api/admin/users?q=ana&status=banned&cursor=c1');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('approves with POST to the coach route', async () => {
    const a = await call(() => approveCoach('abc'));
    expect([a.url, a.init.method]).toEqual(['/api/admin/coaches/abc/approve', 'POST']);
  });

  it('bans with the reason, adds a trimmed note only when there is one; unbans with POST', async () => {
    const a = await call(() => banUser('abc', 'Spam or scams', '  report R-1 '));
    expect(a.url).toBe('/api/admin/users/abc/ban');
    expect(JSON.parse(a.init.body)).toEqual({ reason: 'Spam or scams', note: 'report R-1' });
    const b = await call(() => banUser('abc', 'Other', '   '));
    expect(JSON.parse(b.init.body)).toEqual({ reason: 'Other' });
    const c = await call(() => unbanUser('abc'));
    expect([c.url, c.init.method]).toEqual(['/api/admin/users/abc/unban', 'POST']);
  });
});

describe('describeTags', () => {
  it('a ban comes first, and an unapproved or unverified coach keeps those tags too', () => {
    expect(describeTags(user({ role: 'COACH', isApproved: true, bannedAt: '2026-10-27T00:00:00.000Z' }))).toEqual([{ label: 'Banned', tone: 'bad' }]);
    expect(describeTags(user({ role: 'COACH', isApproved: false, emailVerified: false, bannedAt: '2026-10-27T00:00:00.000Z' })).map((t) => t.label)).toEqual(['Banned', 'Pending approval', 'Unverified']);
  });
  it('coaches are Approved or Pending approval; everyone else is Active', () => {
    expect(describeTags(user({ role: 'COACH', isApproved: true }))).toEqual([{ label: 'Approved', tone: 'good' }]);
    expect(describeTags(user({ role: 'COACH', isApproved: false }))).toEqual([{ label: 'Pending approval', tone: 'warn' }]);
    expect(describeTags(user({ role: 'MEMBER' }))).toEqual([{ label: 'Active', tone: 'neutral' }]);
    expect(describeTags(user({ role: 'ADMIN' }))).toEqual([{ label: 'Active', tone: 'neutral' }]);
  });
  it('anyone who has not typed their email code is tagged Unverified', () => {
    expect(describeTags(user({ role: 'MEMBER', emailVerified: false }))).toEqual([{ label: 'Unverified', tone: 'warn' }]);
    expect(describeTags(user({ role: 'COACH', isApproved: true, emailVerified: false }))).toEqual([{ label: 'Unverified', tone: 'warn' }]);
  });
});

describe('birthDate', () => {
  it('writes the calendar day without shifting it by time zone', () => {
    expect(birthDate('1985-03-09')).toBe('9 Mar 1985');
    expect(birthDate('2000-01-01')).toBe('1 Jan 2000');
  });
  it('says "Not given" for older accounts', () => {
    expect(birthDate(null)).toBe('Not given');
    expect(birthDate('garbage')).toBe('Not given');
  });
});

describe('who can do what', () => {
  it('only members and coaches can be banned', () => {
    expect(['MEMBER', 'COACH', 'SUPPORT', 'ADMIN'].map((role) => canBan({ role } as AdminUser))).toEqual([true, true, false, false]);
  });
  it('only a coach who is waiting for approval gets an Approve button (an approved coach only has Ban)', () => {
    expect(canApprove(user({ role: 'COACH', isApproved: false }))).toBe(true);
    expect(canApprove(user({ role: 'COACH', isApproved: true }))).toBe(false); // no "remove approval"
    expect(canApprove(user({ role: 'COACH', isApproved: false, bannedAt: '2026-10-27T00:00:00.000Z' }))).toBe(false); // banned: unban first
    expect(canApprove(user({ role: 'MEMBER' }))).toBe(false);
    expect(canApprove(user({ role: 'ADMIN' }))).toBe(false);
  });
  it('only an Admin can change anything', () => {
    expect(canManage('ADMIN')).toBe(true);
    expect(canManage('SUPPORT')).toBe(false);
    expect(canManage(undefined)).toBe(false);
  });
});

describe('helpers', () => {
  it('shortDate never prints "Invalid Date"', () => {
    expect(shortDate('2026-10-26T10:00:00.000Z')).toMatch(/26 Oct 2026/);
    expect(shortDate(null)).toBe('-');
    expect(shortDate('nonsense')).toBe('-');
  });
  it('patchUser changes only the chosen row and does not touch the original list', () => {
    const list = [user({ id: 'a' }), user({ id: 'b' })];
    const next = patchUser(list, 'b', { bannedAt: 'x' });
    expect(next[1]!.bannedAt).toBe('x');
    expect(next[0]).toBe(list[0]);
    expect(list[1]!.bannedAt).toBeNull();
  });
});
