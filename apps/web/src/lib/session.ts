import { useSyncExternalStore } from 'react';
import { API_ROUTES } from '@coach-connect/shared/api';
import type { AuthResult, User } from '@coach-connect/shared/types';
import { apiRequest } from './api';

/**
 * Who is signed in to the panel.
 *
 * TEMPORARY STORAGE: the tokens live only in this page's memory (never localStorage, which any
 * script on the page could read). So a browser refresh signs you out. The next backend step moves
 * the login into an httpOnly cookie that scripts cannot read and that survives refresh. Pages only
 * use the functions below, so they will not change when that happens.
 */

export type StaffRole = 'SUPPORT' | 'ADMIN';

/** A signed-in staff member: the shared User, narrowed to the two staff roles. */
export type StaffUser = Omit<User, 'role'> & { role: StaffRole };

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
export function getDeviceId(): string {
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
