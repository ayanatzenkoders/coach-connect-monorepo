import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { showApiError } from '@/src/service/setup/handleApiError';
import { useAuthStore } from '@/src/store/auth.store';
import { isValidEmail } from '@/src/utils/helpers';

const NOTICES = {
  banned: 'This account has been suspended.',
  expired: 'Your session ended. Please sign in again.',
};
export const PASSWORD_UPDATED = 'Password updated. Sign in with your new password.';

interface Params {
  /** True when the user just finished "Forgot password". */
  passwordUpdated?: boolean;
}

/** All the logic of the Sign in screen: the form, the checks, the server call and the links to other screens. */
export const useSignIn = (params?: Params) => {
  const navigation = useNavigation();
  const signIn = useAuthStore((s) => s.signIn);
  const signedOutReason = useAuthStore((s) => s.signedOutReason);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);

  const onChangeEmail = (value: string) => {
    setEmail(value);
    setErrors((e) => ({ ...e, email: undefined })); // typing clears old errors
  };
  const onChangePassword = (value: string) => {
    setPassword(value);
    setErrors((e) => ({ ...e, password: undefined }));
  };

  async function submit() {
    // Check the easy things on the phone first; the server still checks everything again.
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (password.length === 0) next.password = 'Enter your password.';
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      await signIn(email.trim(), password); // success: the root navigator swaps to the signed-in screens
    } catch (e) {
      showApiError(e); // errors from the server appear as a toast
    } finally {
      setBusy(false);
    }
  }

  // Leaving this screen forgets the "password updated" message.
  const leave = (screen: 'Register' | 'ForgotPassword') => {
    if (params?.passwordUpdated) navigation.setParams({ passwordUpdated: false });
    navigation.navigate(screen);
  };

  const notice = params?.passwordUpdated
    ? { text: PASSWORD_UPDATED, tone: 'success' as const }
    : signedOutReason
      ? { text: NOTICES[signedOutReason], tone: 'warning' as const }
      : undefined;

  return {
    email,
    password,
    errors,
    busy,
    notice,
    onChangeEmail,
    onChangePassword,
    submit,
    goRegister: () => leave('Register'),
    goForgotPassword: () => leave('ForgotPassword'),
  };
};
