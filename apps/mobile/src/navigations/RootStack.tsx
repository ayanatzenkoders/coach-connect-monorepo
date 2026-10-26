import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { COLORS } from '@/src/constants';
import Chat from '@/src/screens/home/chat/Chat';
import Main from '@/src/screens/home/main/Main';
import ForgotPassword from '@/src/screens/auth/forgotPassword/ForgotPassword';
import NewPassword from '@/src/screens/auth/newPassword/NewPassword';
import Register from '@/src/screens/auth/register/Register';
import ResetCode from '@/src/screens/auth/resetCode/ResetCode';
import SignIn from '@/src/screens/auth/signIn/SignIn';
import VerifyEmail from '@/src/screens/auth/verifyEmail/VerifyEmail';
import Offline from '@/src/screens/system/offline/Offline';
import { useAuthStore } from '@/src/store/auth.store';
import type { RootStackParamList } from '@/src/utils/types';

// Native stack = UIKit / Android Fragment transitions on the native thread.
// Do NOT switch to @react-navigation/stack (JS-driven, heavier).
const Stack = createNativeStackNavigator<RootStackParamList>();

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: COLORS.background },
};

/**
 * Which screens exist depends on the sign-in status. When the status changes (sign in, sign out, email
 * verified, session ended) React Navigation swaps the whole group, so a signed-out user can never reach
 * a signed-in screen and nobody needs to call navigate() after signing in.
 *  - offline:      a saved login but no connection (the user stays signed in)
 *  - signedOut:    Sign in, Create account and the three "Forgot password" steps
 *  - email check:  a new account must prove its email first
 *  - signedIn:     the tabs, and a chat on top of them
 */
const RootStack: React.FC = () => {
  const status = useAuthStore((s) => s.status);
  const emailVerified = useAuthStore((s) => s.user?.emailVerified ?? false);

  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      {status === 'offline' ? (
        <Stack.Screen name="Offline" component={Offline} />
      ) : status === 'signedOut' ? (
        <Stack.Group>
          <Stack.Screen name="SignIn" component={SignIn} />
          <Stack.Screen name="Register" component={Register} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          <Stack.Screen name="ResetCode" component={ResetCode} />
          <Stack.Screen name="NewPassword" component={NewPassword} />
        </Stack.Group>
      ) : status === 'signedIn' && !emailVerified ? (
        <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="Main" component={Main} />
          <Stack.Screen name="Chat" component={Chat} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

export default RootStack;
