import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authedRequest, getSession, login, logout, resetSessionForTests } from './session';

const user = { id: 'u1', email: 'admin@coachconnect.dev', name: 'Noor Haddad', role: 'ADMIN', emailVerified: true };
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

beforeEach(() => resetSessionForTests());
afterEach(() => vi.unstubAllGlobals());

describe('session', () => {
  it('login posts to the admin endpoint with a device id and keeps the session in memory', async () => {
    const fetchMock = vi.fn().mockReturnValue(ok({ accessToken: 'a', refreshToken: 'r', expiresIn: 900, user }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(login('admin@coachconnect.dev', 'pw')).resolves.toMatchObject({ name: 'Noor Haddad' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/admin/auth/login');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ email: 'admin@coachconnect.dev', password: 'pw' });
    expect(body.deviceId.length).toBeGreaterThanOrEqual(8); // the backend requires 8-128 characters
    expect(getSession()?.accessToken).toBe('a');
  });

  it('a failed login leaves nobody signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(Promise.resolve(new Response(JSON.stringify({ code: 'INVALID_CREDENTIALS', message: 'no' }), { status: 401 }))));
    await expect(login('a@b.co', 'bad')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(getSession()).toBeNull();
  });

  it('logout clears the session even when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(ok({ accessToken: 'a', refreshToken: 'r', expiresIn: 900, user })).mockRejectedValueOnce(new TypeError('offline')));
    await login('admin@coachconnect.dev', 'pw');
    await logout();
    expect(getSession()).toBeNull();
  });

  describe('staying signed in (authedRequest)', () => {
    const answer = (status: number, body: unknown) => () => Promise.resolve(new Response(JSON.stringify(body), { status }));
    const signedIn = async (fetchMock: ReturnType<typeof vi.fn>) => {
      fetchMock.mockImplementationOnce(answer(200, { accessToken: 'a1', refreshToken: 'r1', expiresIn: 900, user }));
      vi.stubGlobal('fetch', fetchMock);
      await login('admin@coachconnect.dev', 'pw');
    };

    it('sends the access token', async () => {
      const f = vi.fn();
      await signedIn(f);
      f.mockImplementationOnce(answer(200, { ok: true }));
      await expect(authedRequest('/admin/users')).resolves.toEqual({ ok: true });
      expect(f.mock.calls[1]![1].headers.Authorization).toBe('Bearer a1');
    });

    it('when the 15-minute token ran out it renews it, repeats the request and stays signed in', async () => {
      const f = vi.fn();
      await signedIn(f);
      f.mockImplementationOnce(answer(401, { code: 'INVALID_TOKEN', message: 'Session expired.' }))
        .mockImplementationOnce(answer(200, { accessToken: 'a2', refreshToken: 'r2', expiresIn: 900, user }))
        .mockImplementationOnce(answer(200, { ok: true }));
      await expect(authedRequest('/admin/users')).resolves.toEqual({ ok: true });
      expect(JSON.parse(f.mock.calls[2]![1].body)).toEqual({ refreshToken: 'r1' });
      expect(f.mock.calls[3]![1].headers.Authorization).toBe('Bearer a2');
      expect(getSession()).toMatchObject({ accessToken: 'a2', refreshToken: 'r2' });
    });

    it('several requests failing together renew only once', async () => {
      const f = vi.fn();
      await signedIn(f);
      let renewals = 0;
      f.mockImplementation((url: string, init: { headers: Record<string, string> }) => {
        if (url.endsWith('/auth/refresh')) {
          renewals++;
          return answer(200, { accessToken: 'a2', refreshToken: 'r2', expiresIn: 900, user })();
        }
        return init.headers.Authorization === 'Bearer a2' ? answer(200, { ok: true })() : answer(401, { code: 'INVALID_TOKEN', message: 'x' })();
      });
      await Promise.all([authedRequest('/a'), authedRequest('/b'), authedRequest('/c')]);
      expect(renewals).toBe(1);
    });

    it('if the renewal is refused too, it signs out', async () => {
      const f = vi.fn();
      await signedIn(f);
      f.mockImplementation(answer(401, { code: 'SESSION_EXPIRED', message: 'Session expired. Please sign in again.' }));
      await expect(authedRequest('/admin/users')).rejects.toMatchObject({ status: 401 });
      await Promise.resolve();
      expect(getSession()).toBeNull();
    });

    it('if the server cannot be reached while renewing, it stays signed in (offline is not a logout)', async () => {
      const f = vi.fn();
      await signedIn(f);
      f.mockImplementationOnce(answer(401, { code: 'INVALID_TOKEN', message: 'x' })).mockRejectedValueOnce(new TypeError('offline'));
      await expect(authedRequest('/admin/users')).rejects.toMatchObject({ status: 401 });
      expect(getSession()).not.toBeNull();
    });

    it('other errors (403, 500) are passed on and do not sign anyone out', async () => {
      const f = vi.fn();
      await signedIn(f);
      f.mockImplementationOnce(answer(403, { code: 'FORBIDDEN_ROLE', message: 'no' }));
      await expect(authedRequest('/admin/users')).rejects.toMatchObject({ status: 403 });
      expect(getSession()).not.toBeNull();
    });
  });
});
