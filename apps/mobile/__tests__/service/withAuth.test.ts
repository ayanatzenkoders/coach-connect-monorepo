import { authApi } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { withAuth } from '@/src/service/setup/withAuth';
import { useAuthStore } from '@/src/store/auth.store';
import { loadTokens } from '@/src/store/secureStorage';

jest.mock('@/src/service/api/auth.api', () => ({
  authApi: { login: jest.fn(), register: jest.fn(), refresh: jest.fn(), logout: jest.fn(), me: jest.fn() },
}));
jest.mock('@/src/store/secureStorage', () => ({
  loadTokens: jest.fn(),
  saveTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
  getOrCreateDeviceId: jest.fn().mockResolvedValue('device-12345678'),
}));

const api = authApi as jest.Mocked<typeof authApi>;
const user = { id: 'u1', email: 's@x.co', name: 'Sara', role: 'MEMBER' as const, emailVerified: true };
const refreshed = { accessToken: 'fresh', refreshToken: 'fresh-r', expiresIn: 900, user };
const err = (status: number, code: string) => new ApiError(status, code, 'x');
const state = () => useAuthStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'signedIn', user, accessToken: 'old', signedOutReason: null });
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'old', refreshToken: 'old-r' });
});

describe('withAuth', () => {
  it('runs the call with the current token', async () => {
    const call = jest.fn().mockResolvedValue('ok');
    await expect(withAuth(call)).resolves.toBe('ok');
    expect(call).toHaveBeenCalledWith('old');
  });

  it('refreshes once and retries when the access token expired', async () => {
    api.refresh.mockResolvedValue(refreshed);
    const call = jest.fn().mockRejectedValueOnce(err(401, 'INVALID_TOKEN')).mockResolvedValue('ok');
    await expect(withAuth(call)).resolves.toBe('ok');
    expect(call).toHaveBeenNthCalledWith(1, 'old');
    expect(call).toHaveBeenNthCalledWith(2, 'fresh');
    expect(state().accessToken).toBe('fresh');
  });

  it('shares ONE refresh between calls that fail at the same time', async () => {
    api.refresh.mockImplementation(() => new Promise((r) => setTimeout(() => r(refreshed), 10)));
    const make = () => jest.fn().mockRejectedValueOnce(err(401, 'INVALID_TOKEN')).mockResolvedValue('ok');
    const results = await Promise.all([withAuth(make()), withAuth(make()), withAuth(make())]);
    expect(results).toEqual(['ok', 'ok', 'ok']);
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });

  it('signs out when the refresh token is refused', async () => {
    api.refresh.mockRejectedValue(err(401, 'REFRESH_REUSED'));
    const call = jest.fn().mockRejectedValue(err(401, 'INVALID_TOKEN'));
    await expect(withAuth(call)).rejects.toMatchObject({ code: 'REFRESH_REUSED' });
    expect(state()).toMatchObject({ status: 'signedOut', signedOutReason: 'expired' });
  });

  it('signs out at once when the session was revoked (no refresh attempt)', async () => {
    const call = jest.fn().mockRejectedValue(err(401, 'SESSION_REVOKED'));
    await expect(withAuth(call)).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
    expect(api.refresh).not.toHaveBeenCalled();
    expect(state()).toMatchObject({ status: 'signedOut', signedOutReason: 'expired' });
  });

  it('signs out with reason "banned" when the account was banned', async () => {
    const call = jest.fn().mockRejectedValue(err(403, 'ACCOUNT_BANNED'));
    await expect(withAuth(call)).rejects.toBeInstanceOf(ApiError);
    expect(state()).toMatchObject({ status: 'signedOut', signedOutReason: 'banned' });
  });

  it('keeps the user signed in on network errors and other errors', async () => {
    await expect(withAuth(jest.fn().mockRejectedValue(err(0, 'NETWORK_ERROR')))).rejects.toMatchObject({ status: 0 });
    await expect(withAuth(jest.fn().mockRejectedValue(err(403, 'FORBIDDEN_ROLE')))).rejects.toMatchObject({ code: 'FORBIDDEN_ROLE' });
    expect(state().status).toBe('signedIn');
  });

  it('keeps the user signed in if the refresh fails because of the network', async () => {
    api.refresh.mockRejectedValue(err(0, 'NETWORK_ERROR'));
    await expect(withAuth(jest.fn().mockRejectedValue(err(401, 'INVALID_TOKEN')))).rejects.toMatchObject({ status: 0 });
    expect(state().status).toBe('signedIn');
  });

  it('throws MISSING_TOKEN when nobody is signed in', async () => {
    useAuthStore.setState({ accessToken: null });
    await expect(withAuth(jest.fn())).rejects.toMatchObject({ code: 'MISSING_TOKEN' });
  });
});
