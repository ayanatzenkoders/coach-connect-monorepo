import { useNavigation } from '@react-navigation/native';
import { authApi } from '@/src/service/api/auth.api';

interface Params {
  email: string;
  /** Seconds until "Resend" works (the server said how long when it sent the first code). */
  resendSeconds: number;
}

/** Forgot password, step 2: check the emailed code, then open "choose a new password". */
export const useResetCode = ({ email, resendSeconds }: Params) => {
  const navigation = useNavigation();

  return {
    email,
    resendSeconds,
    /** Ask for a new code. */
    resend: () => authApi.forgotPassword(email),
    /** Check the code. Throws an ApiError when it is wrong (the code entry shows it as a toast). */
    verify: async (code: string) => {
      const result = await authApi.verifyResetCode({ email, code });
      navigation.navigate('NewPassword', { resetToken: result.resetToken });
    },
    goBack: () => navigation.goBack(),
  };
};
