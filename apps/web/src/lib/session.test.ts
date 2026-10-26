import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSession, login, logout, resetSessionForTests } from './session';

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
});
