import { authApi } from '../src/api/authApi';
import { ApiError } from '../src/api/client';
import { useAuthStore } from '../src/auth/authStore';
import { clearTokens, loadTokens, saveTokens } from '../src/auth/tokenStorage';

jest.mock('../src/api/authApi', () => ({
  authApi: { login: jest.fn(), register: jest.fn(), refresh: jest.fn(), logout: jest.fn(), me: jest.fn() },
}));
jest.mock('../src/auth/tokenStorage', () => ({
  loadTokens: jest.fn(),
  saveTokens: jest.fn().mockResolvedValue(undefined),
  clearTokens: jest.fn().mockResolvedValue(undefined),
  getOrCreateDeviceId: jest.fn().mockResolvedValue('device-12345678'),
}));

const api = authApi as jest.Mocked<typeof authApi>;
const user = { id: 'u1', email: 'sara@coachconnect.dev', name: 'Sara', role: 'MEMBER' as const, emailVerified: true };
const result = { accessToken: 'new-a', refreshToken: 'new-r', expiresIn: 900, user };
const saved = { accessToken: 'old-a', refreshToken: 'old-r' };
const apiError = (status: number, code: string) => new ApiError(status, code, 'x');
const state = () => useAuthStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ status: 'booting', user: null, accessToken: null, signedOutReason: null });
});

describe('restore (app opens)', () => {
  it('goes to signedOut when nothing is saved', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(null);
    await state().restore();
    expect(state().status).toBe('signedOut');
    expect(api.me).not.toHaveBeenCalled();
  });

  it('goes to signedOut (not stuck on the splash) when secure storage fails', async () => {
    (loadTokens as jest.Mock).mockRejectedValue(new Error('Internal error when a required entitlement isn\'t present.'));
    await state().restore();
    expect(state().status).toBe('signedOut');
  });

  it('stays signed in when the saved access token still works', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(saved);
    api.me.mockResolvedValue({ ...user, subscription: null, canCall: false });
    await state().restore();
    expect(state().status).toBe('signedIn');
    expect(state().user?.email).toBe('sara@coachconnect.dev');
    expect(api.refresh).not.toHaveBeenCalled();
  });

  it('refreshes silently when the access token has expired', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(saved);
    api.me.mockRejectedValue(apiError(401, 'INVALID_TOKEN'));
    api.refresh.mockResolvedValue(result);
    await state().restore();
    expect(api.refresh).toHaveBeenCalledWith('old-r');
    expect(saveTokens).toHaveBeenCalledWith({ accessToken: 'new-a', refreshToken: 'new-r' });
    expect(state()).toMatchObject({ status: 'signedIn', accessToken: 'new-a' });
  });

  it('signs out (expired) when the session was revoked', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(saved);
    api.me.mockRejectedValue(apiError(401, 'SESSION_REVOKED'));
    await state().restore();
    expect(clearTokens).toHaveBeenCalled();
    expect(state()).toMatchObject({ status: 'signedOut', signedOutReason: 'expired' });
  });

  it('signs out with reason "banned" for a banned account', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(saved);
    api.me.mockRejectedValue(apiError(403, 'ACCOUNT_BANNED'));
    await state().restore();
    expect(state()).toMatchObject({ status: 'signedOut', signedOutReason: 'banned' });
  });

  it('signs out when the refresh token is no longer accepted', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(saved);
    api.me.mockRejectedValue(apiError(401, 'INVALID_TOKEN'));
    api.refresh.mockRejectedValue(apiError(401, 'REFRESH_REUSED'));
    await state().restore();
    expect(clearTokens).toHaveBeenCalled();
    expect(state().status).toBe('signedOut');
  });

  it('does NOT sign out when the server cannot be reached', async () => {
    (loadTokens as jest.Mock).mockResolvedValue(saved);
    api.me.mockRejectedValue(apiError(0, 'NETWORK_ERROR'));
    await state().restore();
    expect(state().status).toBe('offline');
    expect(clearTokens).not.toHaveBeenCalled();
  });
});

describe('signIn / register / signOut', () => {
  it('signIn saves tokens and becomes signedIn', async () => {
    api.login.mockResolvedValue(result);
    await state().signIn('sara@coachconnect.dev', 'pw');
    expect(api.login).toHaveBeenCalledWith(expect.objectContaining({ email: 'sara@coachconnect.dev', deviceId: 'device-12345678' }));
    expect(saveTokens).toHaveBeenCalledWith({ accessToken: 'new-a', refreshToken: 'new-r' });
    expect(state()).toMatchObject({ status: 'signedIn', user });
  });

  it('a failed signIn throws, saves nothing and stays signedOut', async () => {
    useAuthStore.setState({ status: 'signedOut' });
    api.login.mockRejectedValue(apiError(401, 'INVALID_CREDENTIALS'));
    await expect(state().signIn('a@b.co', 'bad')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(saveTokens).not.toHaveBeenCalled();
    expect(state().status).toBe('signedOut');
  });

  it('register creates the account and signs in', async () => {
    api.register.mockResolvedValue(result);
    await state().register('Sara', 'sara@coachconnect.dev', 'pw');
    expect(api.register).toHaveBeenCalledWith(expect.objectContaining({ name: 'Sara' }));
    expect(state().status).toBe('signedIn');
  });

  it('signOut tells the server and clears the phone', async () => {
    useAuthStore.setState({ status: 'signedIn', user, accessToken: 'a' });
    api.logout.mockResolvedValue(undefined);
    await state().signOut();
    expect(api.logout).toHaveBeenCalledWith('a');
    expect(clearTokens).toHaveBeenCalled();
    expect(state()).toMatchObject({ status: 'signedOut', user: null, accessToken: null });
  });

  it('signOut still works with no internet', async () => {
    useAuthStore.setState({ status: 'signedIn', user, accessToken: 'a' });
    api.logout.mockRejectedValue(apiError(0, 'NETWORK_ERROR'));
    await state().signOut();
    expect(clearTokens).toHaveBeenCalled();
    expect(state().status).toBe('signedOut');
  });
});
