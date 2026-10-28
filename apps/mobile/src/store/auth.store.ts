import { Platform } from 'react-native';
import { create } from 'zustand';
import { authApi, AuthResult, User } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { clearTokens, getOrCreateDeviceId, loadTokens, saveTokens } from '@/src/store/secureStorage';

/**
 * Where the app is in the sign-in story. Screens only look at `status`:
 *  - booting:   the app just opened and we are checking the saved login (show the splash)
 *  - signedOut: show Sign in / Create account
 *  - signedIn:  show the main app
 *  - offline:   we have a saved login but could not reach the server (do NOT sign the user out)
 */
type AuthStatus = 'booting' | 'signedOut' | 'signedIn' | 'offline';

/** Why the user landed on the sign-in screen, so it can show a message. */
type SignedOutReason = 'banned' | 'expired' | null;

interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** Kept in memory for API calls; the saved copy lives in the Keychain. */
  accessToken: string | null;
  signedOutReason: SignedOutReason;
  /**
   * True from the moment the user taps Sign out until the phone has forgotten the login. The server closes the
   * live socket during that gap; the socket code reads this flag so it does not mistake the user's own
   * sign-out for "your session was ended".
   */
  signingOut: boolean;

  /** Run once when the app opens. */
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Trade the saved refresh token for a new pair and return the new access token.
   * If many requests need this at the same moment they share ONE refresh call
   * (a second refresh with the same old token would look like token theft to the server).
   */
  refreshSession: () => Promise<string>;
  /** The server confirmed the email code: let the user into the app. */
  markEmailVerified: () => void;
  /** The server says this login is over (revoked / banned): forget it and show Sign in. */
  expireSession: (reason: SignedOutReason) => Promise<void>;
}

let refreshInFlight: Promise<string> | null = null;

const deviceName = () => (Platform.OS === 'ios' ? 'iPhone' : 'Android phone');

export const useAuthStore = create<AuthState>()((set, get) => {
  /** Remember a fresh login: Keychain first, then memory. */
  async function accept(result: AuthResult) {
    await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    set({ status: 'signedIn', user: result.user, accessToken: result.accessToken, signedOutReason: null });
  }

  /** The saved login is no longer valid: forget it and go to the sign-in screen. */
  async function endSession(reason: SignedOutReason) {
    await clearTokens();
    set({ status: 'signedOut', user: null, accessToken: null, signedOutReason: reason, signingOut: false });
  }

  /** Decide what an API failure during restore means. */
  async function handleRestoreError(e: unknown) {
    if (e instanceof ApiError) {
      if (e.status === 0) return set({ status: 'offline' }); // keep the tokens, try again later
      if (e.code === 'ACCOUNT_BANNED') return endSession('banned');
    }
    return endSession('expired');
  }

  return {
    status: 'booting',
    user: null,
    accessToken: null,
    signedOutReason: null,
    signingOut: false,

    async restore() {
      let tokens;
      try {
        tokens = await loadTokens();
      } catch {
        // The secure storage itself failed. Never leave the user stuck on the splash screen.
        return set({ status: 'signedOut' });
      }
      if (!tokens) return set({ status: 'signedOut' });

      try {
        const me = await authApi.me(tokens.accessToken);
        return set({ status: 'signedIn', user: me, accessToken: tokens.accessToken, signedOutReason: null });
      } catch (e) {
        // An expired access token is normal after the app was closed for a while: refresh it.
        const expired = e instanceof ApiError && (e.code === 'INVALID_TOKEN' || e.code === 'MISSING_TOKEN');
        if (!expired) return handleRestoreError(e);
      }

      try {
        await get().refreshSession();
      } catch (e) {
        await handleRestoreError(e);
      }
    },

    async signIn(email, password) {
      const deviceId = await getOrCreateDeviceId();
      // If this throws (wrong password, no network), nothing is saved and the screen shows the error.
      await accept(await authApi.login({ email, password, deviceId, deviceName: deviceName() }));
    },

    async register(name, email, password) {
      const deviceId = await getOrCreateDeviceId();
      await accept(await authApi.register({ name, email, password, deviceId, deviceName: deviceName() }));
    },

    async signOut() {
      const { accessToken } = get();
      set({ signingOut: true });
      // Tell the server (best effort), but always sign out on the phone, even with no internet.
      if (accessToken) await authApi.logout(accessToken).catch(() => undefined);
      await endSession(null);
    },

    refreshSession() {
      refreshInFlight ??= (async () => {
        const tokens = await loadTokens();
        if (!tokens) throw new ApiError(401, 'MISSING_TOKEN', 'Please sign in again.');
        const result = await authApi.refresh(tokens.refreshToken);
        await accept(result);
        return result.accessToken;
      })().finally(() => {
        refreshInFlight = null;
      });
      return refreshInFlight;
    },

    markEmailVerified: () => {
      const user = get().user;
      if (user) set({ user: { ...user, emailVerified: true } });
    },

    expireSession: (reason) => endSession(reason),
  };
});
