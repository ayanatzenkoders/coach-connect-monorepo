import { clearTokens, getOrCreateDeviceId, loadTokens, saveTokens } from '@/src/store/secureStorage';

// A fake Keychain that keeps data in memory, one slot per "service".
const mockStore: Record<string, string> = {};
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly' },
  setGenericPassword: jest.fn(async (_u: string, password: string, o: { service: string }) => {
    mockStore[o.service] = password;
    return { service: o.service };
  }),
  getGenericPassword: jest.fn(async (o: { service: string }) =>
    o.service in mockStore ? { username: 'x', password: mockStore[o.service] } : false,
  ),
  resetGenericPassword: jest.fn(async (o: { service: string }) => {
    delete mockStore[o.service];
    return true;
  }),
}));

describe('tokenStorage', () => {
  beforeEach(() => Object.keys(mockStore).forEach((k) => delete mockStore[k]));

  it('returns null when nothing is saved', async () => {
    expect(await loadTokens()).toBeNull();
  });

  it('saves and loads tokens', async () => {
    await saveTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(await loadTokens()).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('clears tokens (sign out)', async () => {
    await saveTokens({ accessToken: 'a', refreshToken: 'r' });
    await clearTokens();
    expect(await loadTokens()).toBeNull();
  });

  it('treats damaged data as signed out and removes it', async () => {
    mockStore['coachconnect.tokens'] = '{not json';
    expect(await loadTokens()).toBeNull();
    expect('coachconnect.tokens' in mockStore).toBe(false);
  });

  it('creates the device id once and then reuses it', async () => {
    const first = await getOrCreateDeviceId();
    expect(first.length).toBeGreaterThanOrEqual(8); // backend requires 8-128 characters
    expect(await getOrCreateDeviceId()).toBe(first);
  });
});
