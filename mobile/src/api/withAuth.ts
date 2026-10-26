import { useAuthStore } from '../auth/authStore';
import { ApiError } from './client';

/** Codes meaning "this login is finished" (the user must sign in again). */
const SESSION_ENDED = new Set(['SESSION_REVOKED', 'SESSION_EXPIRED', 'ACCOUNT_BANNED', 'REFRESH_REUSED', 'INVALID_REFRESH_TOKEN']);
/** Codes meaning "just the 15-minute access token ran out": refreshing fixes it. */
const TOKEN_EXPIRED = new Set(['INVALID_TOKEN', 'MISSING_TOKEN']);

/**
 * Use this for every call that needs a logged-in user:
 *
 *    const me = await withAuth((token) => authApi.me(token));
 *
 * It adds the current access token, and handles the boring cases for the screen:
 *  - token expired      -> refresh once (shared by parallel calls), retry the call
 *  - login revoked/banned -> sign the user out, then throw so the screen can stop
 *  - no internet / other errors -> thrown unchanged, user stays signed in
 */

export async function withAuth<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
  const store = useAuthStore.getState();
  const token = store.accessToken;
  if (!token) throw new ApiError(401, 'MISSING_TOKEN', 'Please sign in again.');

  try {
    return await call(token);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;

    if (SESSION_ENDED.has(e.code)) {
      await store.expireSession(e.code === 'ACCOUNT_BANNED' ? 'banned' : 'expired');
      throw e;
    }
    if (!TOKEN_EXPIRED.has(e.code)) throw e;

    // Maybe another request already refreshed while this one was in flight: then just retry.
    const current = useAuthStore.getState().accessToken;
    let fresh: string;
    try {
      fresh = current && current !== token ? current : await store.refreshSession();
    } catch (refreshError) {
      if (refreshError instanceof ApiError && refreshError.status !== 0) {
        await store.expireSession(refreshError.code === 'ACCOUNT_BANNED' ? 'banned' : 'expired');
      }
      throw refreshError; // a network error leaves the user signed in
    }
    return call(fresh);
  }
}
