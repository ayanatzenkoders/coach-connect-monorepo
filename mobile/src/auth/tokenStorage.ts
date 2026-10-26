import * as Keychain from 'react-native-keychain';

/**
 * Where the app keeps the login tokens and the device id.
 *
 * iOS Keychain / Android Keystore are encrypted, app-private storage. Never use
 * AsyncStorage or MMKV for tokens: they are plain files that a stolen backup could expose.
 */

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

const TOKENS_SERVICE = 'coachconnect.tokens';
const DEVICE_SERVICE = 'coachconnect.device';

// AFTER_FIRST_UNLOCK: readable while the phone is locked (needed to answer an incoming call
// from the lock screen), but only after the user unlocked it once since boot.
// THIS_DEVICE_ONLY: never copied to iCloud or a new phone's backup restore.
const options = (service: string) => ({
  service,
  accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
});

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), options(TOKENS_SERVICE));
}

/** Returns the saved tokens, or null if there are none (or they are damaged). */
export async function loadTokens(): Promise<StoredTokens | null> {
  const saved = await Keychain.getGenericPassword(options(TOKENS_SERVICE));
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved.password) as Partial<StoredTokens>;
    if (typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string') {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
  } catch {
    // fall through: damaged data is treated as "not signed in"
  }
  await clearTokens();
  return null;
}

export async function clearTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: TOKENS_SERVICE });
}

/**
 * A random id made once per install. The backend uses it to keep ONE live session per phone
 * (signing in again on the same phone replaces the old session). It is not a secret.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const saved = await Keychain.getGenericPassword(options(DEVICE_SERVICE));
  if (saved) return saved.password;
  const id = `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await Keychain.setGenericPassword('device', id, options(DEVICE_SERVICE));
  return id;
}
