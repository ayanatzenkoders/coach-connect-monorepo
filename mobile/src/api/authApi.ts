import { apiRequest } from './client';

/** These types mirror what the backend returns (backend/src/auth/auth.service.ts). */

export type Role = 'MEMBER' | 'COACH' | 'SUPPORT' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
}

/** Answer of login, register and refresh. */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token stops working (900 = 15 minutes). */
  expiresIn: number;
  user: User;
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'GRACE_PERIOD' | 'CANCELLED_ACTIVE' | 'EXPIRED';

/** Answer of GET /auth/me. */
export interface Me extends User {
  subscription: { status: SubscriptionStatus; expiresAt: string | null } | null;
  /** True when this person may start calls right now (coaches always can). */
  canCall: boolean;
}

interface DeviceInfo {
  /** Random id from getOrCreateDeviceId(). */
  deviceId: string;
  /** Shown later in an "active devices" list, e.g. "iPhone". Optional. */
  deviceName?: string;
}

/** Answer of "send me a verification code". */
export interface CodeSent {
  expiresInSeconds: number;
  /** The app must wait this long before asking for another code. */
  resendAfterSeconds: number;
}

export const authApi = {
  login: (input: DeviceInfo & { email: string; password: string }) =>
    apiRequest<AuthResult>('/auth/login', { method: 'POST', body: input }),

  register: (input: DeviceInfo & { email: string; password: string; name: string }) =>
    apiRequest<AuthResult>('/auth/register', { method: 'POST', body: input }),

  /** Trades the refresh token for a NEW pair. The old refresh token must then be discarded. */
  refresh: (refreshToken: string) =>
    apiRequest<AuthResult>('/auth/refresh', { method: 'POST', body: { refreshToken } }),

  logout: (accessToken: string) => apiRequest<void>('/auth/logout', { method: 'POST', accessToken }),

  /** Emails a new 6-digit code. Fails with CODE_COOLDOWN (data.retryAfterSeconds) if asked too soon. */
  sendEmailCode: (accessToken: string) => apiRequest<CodeSent>('/auth/email/send-code', { method: 'POST', accessToken }),

  /** Fails with INVALID_CODE (data.attemptsLeft), CODE_EXPIRED or CODE_LOCKED. */
  verifyEmail: (accessToken: string, code: string) =>
    apiRequest<{ emailVerified: boolean }>('/auth/email/verify', { method: 'POST', accessToken, body: { code } }),

  /** "Forgot password" step 1: email me a code. Fails with ACCOUNT_NOT_FOUND (404) when no account has this email. */
  forgotPassword: (email: string) => apiRequest<CodeSent>('/auth/password/forgot', { method: 'POST', body: { email } }),

  /** Step 2: check the emailed code. Fails with INVALID_CODE (data.attemptsLeft), CODE_EXPIRED or CODE_LOCKED. */
  verifyResetCode: (input: { email: string; code: string }) =>
    apiRequest<{ resetToken: string; expiresInSeconds: number }>('/auth/password/verify-code', { method: 'POST', body: input }),

  /** Step 3: the token from step 2 + the new password. Fails with RESET_TOKEN_INVALID if the token expired or was used. */
  resetPassword: (input: { resetToken: string; newPassword: string }) =>
    apiRequest<{ ok: boolean }>('/auth/password/reset', { method: 'POST', body: input }),

  me: (accessToken: string) => apiRequest<Me>('/auth/me', { accessToken }),
};
