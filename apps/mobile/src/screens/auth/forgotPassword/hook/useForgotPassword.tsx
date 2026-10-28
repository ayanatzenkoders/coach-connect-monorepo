import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { authApi } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { showApiError } from '@/src/service/setup/handleApiError';
import { isValidEmail } from '@/src/utils/helpers';

/** Forgot password, step 1: ask for the email, request the code, open the "enter the code" screen. */
export const useForgotPassword = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  /** Set when the server says this email has no account. */
  const [notFound, setNotFound] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const sent = await authApi.forgotPassword(email.trim()); // 404 ACCOUNT_NOT_FOUND if there is no such account
      navigation.navigate('ResetCode', { email: email.trim(), resendSeconds: sent.resendAfterSeconds });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'ACCOUNT_NOT_FOUND') setNotFound(email.trim());
      showApiError(e); // the server's message, as a toast
    } finally {
      setBusy(false);
    }
  }

  return {
    email,
    error,
    notFound,
    busy,
    onChangeEmail: (value: string) => {
      setEmail(value);
      setError(undefined);
      setNotFound(null);
    },
    submit,
    goBack: () => navigation.goBack(),
    /** The email has no account: offer to create one (the email typed here is carried over). */
    createAccount: (withEmail: string) => navigation.navigate('Register', { email: withEmail }),
  };
};
