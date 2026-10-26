import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './api';

const reply = (status: number, body?: unknown) =>
  Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest', () => {
  it('returns parsed JSON and calls the /api address', async () => {
    const fetchMock = vi.fn().mockReturnValue(reply(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/health')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/health');
  });

  it('sends a JSON body and the bearer token', async () => {
    const fetchMock = vi.fn().mockReturnValue(reply(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/x', { method: 'POST', body: { a: 1 }, accessToken: 'tok' });
    const init = fetchMock.mock.calls[0]![1];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('turns backend errors into ApiError with the backend code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(reply(401, { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' })));
    const err = await apiRequest('/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
  });

  it('uses the first message of a validation error list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(reply(400, { message: ['email must be an email', 'other'] })));
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 400, message: 'email must be an email' });
  });

  it('reports NETWORK_ERROR when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(apiRequest('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
