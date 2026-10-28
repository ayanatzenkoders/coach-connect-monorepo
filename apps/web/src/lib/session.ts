import { useSyncExternalStore } from 'react';
import { API_ROUTES } from '@coach-connect/shared/api';
import type { AuthResult, User } from '@coach-connect/shared/types';
import { ApiError, apiRequest } from './api';

/**
 * Who is signed in to the panel.
 *
 * STAYING SIGNED IN: the access token lasts 15 minutes, so `authedRequest` below renews it with the refresh token
 * the moment the backend answers 401 (once, shared by every request in flight), then repeats the request. The panel
 * only signs you out when the refresh itself is refused (session revoked, banned, expired after days of nothing).
 *
 * TEMPORARY STORAGE: the tokens live only in this page's memory (never localStorage, which any
 * script on the page could read). So a browser refresh signs you out. The next backend step moves
 * the login into an httpOnly cookie that scripts cannot read and that survives refresh. Pages only
 * use the functions below, so they will not change when that happens.
 */

type StaffRole = 'SUPPORT' | 'ADMIN';

/** A signed-in staff member: the shared User, narrowed to the two staff roles. */
type StaffUser = Omit<User, 'role'> & { role: StaffRole };

type LoginResult = Omit<AuthResult, 'user'> & { user: StaffUser };

interface Session {
  user: StaffUser;
  accessToken: string;
  refreshToken: string;
}

let current: Session | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** A random id for this browser; the backend keeps one live session per device id. Not a secret. */
function getDeviceId(): string {
  try {
    const saved = localStorage.getItem('cc_admin_device');
    if (saved) return saved;
    const created = `web-${crypto.randomUUID()}`;
    localStorage.setItem('cc_admin_device', created);
    return created;
  } catch {
    return `web-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; // storage blocked: still works, just not stable
  }
}

export async function login(email: string, password: string): Promise<StaffUser> {
  const result = await apiRequest<LoginResult>(API_ROUTES.admin.login, {
    method: 'POST',
    body: { email, password, deviceId: getDeviceId(), deviceName: 'Admin web' },
  });
  current = { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
  emit();
  return result.user;
}

export async function logout(): Promise<void> {
  const token = current?.accessToken;
  current = null; // sign out on screen first, even if the server call fails
  emit();
  if (token) await apiRequest(API_ROUTES.auth.logout, { method: 'POST', accessToken: token }).catch(() => undefined);
}

/** One renewal at a time: the backend rotates the refresh token, so two parallel renewals would fight each other. */
let renewing: Promise<void> | null = null;

async function renew(): Promise<void> {
  const session = current;
  if (!session) throw new ApiError(401, 'NOT_SIGNED_IN', 'Please sign in.');
  renewing ??= apiRequest<LoginResult>(API_ROUTES.auth.refresh, { method: 'POST', body: { refreshToken: session.refreshToken } })
    .then((result) => {
      if (current !== session) return; // signed out (or in again) while renewing: do not bring the old session back
      current = { user: session.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
      emit();
    })
    .finally(() => {
      renewing = null;
    });
  return renewing;
}

/**
 * A request as the signed-in person. If the 15-minute token ran out (401), renew it and repeat the request once.
 * If the renewal is refused too, sign out: the person goes back to the login page.
 */
export async function authedRequest<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const token = current?.accessToken;
  if (!token) throw new ApiError(401, 'NOT_SIGNED_IN', 'Please sign in.');
  try {
    return await apiRequest<T>(path, { ...options, accessToken: token });
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || e.code === 'NOT_SIGNED_IN') throw e;
    try {
      await renew();
    } catch (renewError) {
      if (renewError instanceof ApiError && renewError.status !== 0) void logout(); // refused: really signed out. Offline: stay, try again later
      throw e;
    }
    return apiRequest<T>(path, { ...options, accessToken: current?.accessToken });
  }
}

export function getSession(): Session | null {
  return current;
}

/** React hook: re-renders the component when someone signs in or out. */
export function useSession(): Session | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSession,
    () => null, // on the server / first paint nobody is signed in
  );
}

/** Test helper: forget everything without calling the server. */
export function resetSessionForTests() {
  current = null;
  emit();
}
