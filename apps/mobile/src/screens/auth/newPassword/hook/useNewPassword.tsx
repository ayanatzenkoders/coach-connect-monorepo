import { CommonActions, useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { authApi } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { showApiError } from '@/src/service/setup/handleApiError';
import { isStrongPassword } from '@/src/utils/helpers';

interface Params {
  /** The short-lived token from step 2 that proves the emailed code was right. */
  resetToken: string;
}

/** Forgot password, step 3: save the new password, then go back to Sign in with a "Password updated" message. */
export const useNewPassword = ({ resetToken }: Params) => {
  const navigation = useNavigation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isStrongPassword(password)) {
      setError('Your password does not meet all the requirements below.');
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword({ resetToken, newPassword: password });
      // Start the sign-in stack fresh, so "back" cannot return to the finished reset steps.
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'SignIn', params: { passwordUpdated: true } }] }));
    } catch (e) {
      // The 10-minute window ran out (or the token was already used): start again from step 1.
      if (e instanceof ApiError && e.code === 'RESET_TOKEN_INVALID') navigation.navigate('ForgotPassword');
      showApiError(e);
    } finally {
      setBusy(false);
    }
  }

  return {
    password,
    error,
    busy,
    onChangePassword: (value: string) => {
      setPassword(value);
      setError(undefined);
    },
    submit,
    goBack: () => navigation.goBack(),
  };
};
