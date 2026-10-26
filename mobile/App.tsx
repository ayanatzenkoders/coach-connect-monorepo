import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authApi } from './src/api/authApi';
import { withAuth } from './src/api/withAuth';
import { useAuthStore } from './src/auth/authStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { OfflineScreen } from './src/screens/OfflineScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';

const NOTICES = {
  banned: 'This account has been suspended.',
  expired: 'Your session ended. Please sign in again.',
};

/** Decides which screen to show from the sign-in status. Real navigation (tabs) comes later. */
function Root() {
  const { status, user, signedOutReason, restore, signIn, register, signOut, markEmailVerified } = useAuthStore();
  const [authScreen, setAuthScreen] = useState<'signIn' | 'register'>('signIn');
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
          <HomeScreen />
        );
      case 'signedOut':
        return authScreen === 'register' ? (
          <RegisterScreen onRegister={register} onBack={() => setAuthScreen('signIn')} />
        ) : (
          <SignInScreen
            onSignIn={signIn}
            onCreateAccount={() => setAuthScreen('register')}
            onForgotPassword={() => {}} // Forgot password: next step
            notice={signedOutReason ? NOTICES[signedOutReason] : undefined}
          />
        );
    }
  }
}

function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

export default App;
