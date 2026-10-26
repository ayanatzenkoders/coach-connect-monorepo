import { ApiError, apiRequest } from '../src/api/client';

const reply = (status: number, body?: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  } as Response);

describe('apiRequest', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('returns the parsed JSON on success', async () => {
    fetchMock.mockReturnValue(reply(200, { status: 'ok' }));
    await expect(apiRequest('/health')).resolves.toEqual({ status: 'ok' });
  });

  it('sends a JSON body and the Authorization header', async () => {
    fetchMock.mockReturnValue(reply(200, {}));
    await apiRequest('/auth/login', { method: 'POST', body: { a: 1 }, accessToken: 'tok' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/auth/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('turns a backend error into an ApiError with its code', async () => {
    fetchMock.mockReturnValue(reply(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }));
    const err = await apiRequest('/auth/login', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
  });

  it('shows the first message of a validation error list', async () => {
    fetchMock.mockReturnValue(reply(400, { statusCode: 400, message: ['email must be an email', 'x'] }));
    const err = await apiRequest('/auth/register', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toMatchObject({ status: 400, code: 'UNKNOWN_ERROR', message: 'email must be an email' });
  });

  it('reports NETWORK_ERROR (status 0) when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const err = await apiRequest('/health').catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('handles an empty 204 answer', async () => {
    fetchMock.mockReturnValue(reply(204));
    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});
