import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authApi } from './src/api/authApi';
import { ApiError } from './src/api/client';
import { withAuth } from './src/api/withAuth';
import { useAuthStore } from './src/auth/authStore';
import { ToastHost } from './src/components/ToastHost';
import { MainTabs } from './src/screens/MainTabs';
import { OfflineScreen } from './src/screens/OfflineScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { NewPasswordScreen } from './src/screens/NewPasswordScreen';
import { ResetCodeScreen } from './src/screens/ResetCodeScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';

type AuthScreen = 'signIn' | 'register' | 'forgot' | 'resetCode' | 'newPassword';

const PASSWORD_UPDATED = 'Password updated. Sign in with your new password.';

const NOTICES = {
  banned: 'This account has been suspended.',
  expired: 'Your session ended. Please sign in again.',
};

/** Decides which screen to show from the sign-in status. Real navigation (tabs) comes later. */
function Root() {
  const { status, user, signedOutReason, restore, signIn, register, signOut, markEmailVerified } = useAuthStore();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('signIn');
  // Forgot-password flow: the email, the seconds before "Resend" works, and the token proving the code was right.
  const [resetEmail, setResetEmail] = useState('');
  const [resendSeconds, setResendSeconds] = useState(60);
  const [resetToken, setResetToken] = useState('');
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  // Email to prefill on Create account (when Forgot password found no account).
  const [registerEmail, setRegisterEmail] = useState('');
  // The splash stays until the app is ready AND its progress bar has finished filling.
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // Once, when the app opens: check the saved login.
  useEffect(() => {
    restore();
  }, [restore]);

  const sendCode = useCallback(() => withAuth((token) => authApi.sendEmailCode(token)), []);
  const verifyCode = useCallback(
    async (code: string) => {
      await withAuth((token) => authApi.verifyEmail(token, code));
      markEmailVerified();
    },
    [markEmailVerified],
  );

  const showSplash = !splashDone;
  return (
    <>
      <StatusBar barStyle={showSplash ? 'light-content' : 'dark-content'} />
      {showSplash ? <SplashScreen ready={status !== 'booting'} onFinish={finishSplash} /> : screen()}
    </>
  );

  function screen() {
    switch (status) {
      case 'booting':
        return null; // unreachable: the splash covers it
      case 'offline':
        return <OfflineScreen onRetry={restore} />;
      case 'signedIn':
        // A new account must prove its email before entering the app.
        return user && !user.emailVerified ? (
          <VerifyEmailScreen email={user.email} onSendCode={sendCode} onVerify={verifyCode} onBack={signOut} />
        ) : (
          <MainTabs />
        );
      case 'signedOut':
        switch (authScreen) {
          case 'register':
            return <RegisterScreen onRegister={register} onBack={() => setAuthScreen('signIn')} initialEmail={registerEmail} />;
          case 'forgot':
            return (
              <ForgotPasswordScreen
                onBack={() => setAuthScreen('signIn')}
                onCreateAccount={(email) => {
                  setRegisterEmail(email);
                  setAuthScreen('register');
                }}
                onSubmit={async (email) => {
                  const sent = await authApi.forgotPassword(email); // 404 ACCOUNT_NOT_FOUND if there is no such account
                  setResetEmail(email);
                  setResendSeconds(sent.resendAfterSeconds);
                  setAuthScreen('resetCode');
                }}
              />
            );
          case 'resetCode':
            return (
              <ResetCodeScreen
                email={resetEmail}
                initialResendSeconds={resendSeconds}
                onBack={() => setAuthScreen('forgot')}
                onResend={() => authApi.forgotPassword(resetEmail)}
                onVerify={async (code) => {
                  const result = await authApi.verifyResetCode({ email: resetEmail, code });
                  setResetToken(result.resetToken);
                  setAuthScreen('newPassword');
                }}
              />
            );
          case 'newPassword':
            return (
              <NewPasswordScreen
                onBack={() => setAuthScreen('forgot')}
                onSubmit={async (newPassword) => {
                  try {
                    await authApi.resetPassword({ resetToken, newPassword });
                  } catch (e) {
                    // The 10-minute window ran out (or the link was already used): start again.
                    if (e instanceof ApiError && e.code === 'RESET_TOKEN_INVALID') {
                      setResetToken('');
                      setAuthScreen('forgot');
                    }
                    throw e; // the screen shows the message as a toast
                  }
                  setResetToken('');
                  setPasswordUpdated(true);
                  setAuthScreen('signIn');
                }}
              />
            );
          default:
            return (
              <SignInScreen
                onSignIn={signIn}
                onCreateAccount={() => {
                  setPasswordUpdated(false);
                  setRegisterEmail('');
                  setAuthScreen('register');
                }}
                onForgotPassword={() => {
                  setPasswordUpdated(false);
                  setAuthScreen('forgot');
                }}
                notice={passwordUpdated ? PASSWORD_UPDATED : signedOutReason ? NOTICES[signedOutReason] : undefined}
                noticeTone={passwordUpdated ? 'success' : 'warning'}
              />
            );
        }
    }
  }
}

function App() {
  return (
    <SafeAreaProvider>
      <Root />
      <ToastHost />
    </SafeAreaProvider>
  );
}

export default App;
