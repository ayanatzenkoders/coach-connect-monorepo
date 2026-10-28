import { API_ROUTES } from '@/src/constants';
import type { AuthResult, CodeSent, Me } from '@coach-connect/shared/types';
import { apiRequest } from '@/src/service/setup/apiClient';

export type { AuthResult, CodeSent, Me, User } from '@coach-connect/shared/types';

interface DeviceInfo {
  /** Random id from getOrCreateDeviceId(). */
  deviceId: string;
  /** Shown later in an "active devices" list, e.g. "iPhone". Optional. */
  deviceName?: string;
}

/** Plain request functions (no React): the auth store and screens call these. */
export const authApi = {
  login: (input: DeviceInfo & { email: string; password: string }) => apiRequest<AuthResult>(API_ROUTES.auth.login, { method: 'POST', body: input }),

  register: (input: DeviceInfo & { email: string; password: string; name: string; dateOfBirth: string }) =>
    apiRequest<AuthResult>(API_ROUTES.auth.register, { method: 'POST', body: input }),

  /** A coach applies. The account exists but cannot be used until an admin approves it (the user comes back with `pendingApproval`). */
  registerCoach: (input: DeviceInfo & { email: string; password: string; name: string; dateOfBirth: string; phone: string; bio: string; specialties: string[] }) =>
    apiRequest<AuthResult>(API_ROUTES.auth.registerCoach, { method: 'POST', body: input }),

  /** Trades the refresh token for a NEW pair. The old refresh token must then be discarded. */
  refresh: (refreshToken: string) => apiRequest<AuthResult>(API_ROUTES.auth.refresh, { method: 'POST', body: { refreshToken } }),

  logout: (accessToken: string) => apiRequest<void>(API_ROUTES.auth.logout, { method: 'POST', accessToken }),

  /** Emails a new 6-digit code. Fails with CODE_COOLDOWN (data.retryAfterSeconds) if asked too soon. */
  sendEmailCode: (accessToken: string) => apiRequest<CodeSent>(API_ROUTES.auth.emailSendCode, { method: 'POST', accessToken }),

  /** Fails with INVALID_CODE (data.attemptsLeft), CODE_EXPIRED or CODE_LOCKED. */
  verifyEmail: (accessToken: string, code: string) =>
    apiRequest<{ emailVerified: boolean }>(API_ROUTES.auth.emailVerify, { method: 'POST', accessToken, body: { code } }),

  /** "Forgot password" step 1: email me a code. Fails with ACCOUNT_NOT_FOUND (404) when no account has this email. */
  forgotPassword: (email: string) => apiRequest<CodeSent>(API_ROUTES.auth.passwordForgot, { method: 'POST', body: { email } }),

  /** Step 2: check the emailed code. Fails with INVALID_CODE (data.attemptsLeft), CODE_EXPIRED or CODE_LOCKED. */
  verifyResetCode: (input: { email: string; code: string }) =>
    apiRequest<{ resetToken: string; expiresInSeconds: number }>(API_ROUTES.auth.passwordVerifyCode, { method: 'POST', body: input }),

  /** Step 3: the token from step 2 + the new password. Fails with RESET_TOKEN_INVALID if the token expired or was used. */
  resetPassword: (input: { resetToken: string; newPassword: string }) =>
    apiRequest<{ ok: boolean }>(API_ROUTES.auth.passwordReset, { method: 'POST', body: input }),

  me: (accessToken: string) => apiRequest<Me>(API_ROUTES.auth.me, { accessToken }),
};
