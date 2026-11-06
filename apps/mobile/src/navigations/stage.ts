import type { AuthStatus } from '@/src/store/auth.store';

/**
 * Which group of screens exists right now. Pure on purpose: no React, so every combination is unit-tested.
 *  - offline:         a saved login but no connection (the person stays signed in)
 *  - signedOut:       Sign in, Create account, the "Forgot password" steps
 *  - verifyEmail:     signed in, the 6-digit email code is still to be typed
 *  - pendingApproval: a coach whose email is verified waits for an admin
 *  - app:             the tabs, chats, calls
 */
export type Stage =
  | 'offline'
  | 'signedOut'
  | 'verifyEmail'
  | 'pendingApproval'
  | 'app';

export function getStage(
  status: AuthStatus,
  emailVerified: boolean,
  pendingApproval: boolean,
): Stage {
  if (status === 'offline') return 'offline';
  // 'booting' never reaches the navigator (the splash covers it). If it ever did, showing Sign in is the safe answer:
  // an unknown person must never be shown the app.
  if (status !== 'signedIn') return 'signedOut';
  if (!emailVerified) return 'verifyEmail';
  return pendingApproval ? 'pendingApproval' : 'app';
}
