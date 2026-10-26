import { authApi } from '@/src/service/api/auth.api';
import { withAuth } from '@/src/service/setup/withAuth';
import { useAuthStore } from '@/src/store/auth.store';

/** "Check your email" after sign-up: a new account must prove its email before entering the app. */
export const useVerifyEmail = () => {
  const email = useAuthStore((s) => s.user?.email ?? '');
  const signOut = useAuthStore((s) => s.signOut);
  const markEmailVerified = useAuthStore((s) => s.markEmailVerified);

  return {
    email,
    /** Ask the server to email a code (sign-up already sent one; the server then answers "wait"). */
    sendCode: () => withAuth((token) => authApi.sendEmailCode(token)),
    /** Check the typed code. Success lets the user in: the root navigator swaps to the app. */
    verify: async (code: string) => {
      await withAuth((token) => authApi.verifyEmail(token, code));
      markEmailVerified();
    },
    /** Back arrow: the account already exists, so this signs out. */
    onBack: signOut,
  };
};
