import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { COLORS } from '@/src/constants';
import Chat from '@/src/screens/home/chat/Chat';
import AddMembers from '@/src/screens/home/addMembers/AddMembers';
import GroupInfo from '@/src/screens/home/groupInfo/GroupInfo';
import NewGroup from '@/src/screens/home/newGroup/NewGroup';
import Main from '@/src/screens/home/main/Main';
import ForgotPassword from '@/src/screens/auth/forgotPassword/ForgotPassword';
import NewPassword from '@/src/screens/auth/newPassword/NewPassword';
import PendingApproval from '@/src/screens/auth/pendingApproval/PendingApproval';
import Register from '@/src/screens/auth/register/Register';
import RegisterCoach from '@/src/screens/auth/registerCoach/RegisterCoach';
import ResetCode from '@/src/screens/auth/resetCode/ResetCode';
import SignIn from '@/src/screens/auth/signIn/SignIn';
import VerifyEmail from '@/src/screens/auth/verifyEmail/VerifyEmail';
import Offline from '@/src/screens/system/offline/Offline';
import { connectSocket, disconnectSocket } from '@/src/service/socket/socket';
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
 *  - pending:      a coach who applied waits here until an admin approves
 *  - signedIn:     the tabs, and a chat on top of them
 */
const RootStack: React.FC = () => {
  const status = useAuthStore((s) => s.status);
  const emailVerified = useAuthStore((s) => s.user?.emailVerified ?? false);
  // A coach an admin has not approved yet: the server refuses everything but "who am I", so show a waiting screen.
  const pending = useAuthStore((s) => s.user?.pendingApproval ?? false);

  // REAL-TIME: the live connection exists exactly while the user is signed in. Signing out (or a ban that
  // ends the session) changes `status`, which closes the socket here, so nothing is pushed to a signed-out phone.
  useEffect(() => {
    if (status !== 'signedIn' || pending) {
      disconnectSocket();
      return;
    }
    connectSocket();
    // iOS closes sockets of apps that sit in the background. When the app comes back, reconnect
    // (connect() does nothing if the socket is still open). Screens then catch up on what they missed.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && connectSocket());
    return () => sub.remove();
  }, [status, pending]);

  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      {status === 'offline' ? (
        <Stack.Screen name="Offline" component={Offline} />
      ) : status === 'signedOut' ? (
        <Stack.Group>
          <Stack.Screen name="SignIn" component={SignIn} />
          <Stack.Screen name="Register" component={Register} />
          <Stack.Screen name="RegisterCoach" component={RegisterCoach} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          <Stack.Screen name="ResetCode" component={ResetCode} />
          <Stack.Screen name="NewPassword" component={NewPassword} />
        </Stack.Group>
      ) : status === 'signedIn' && !emailVerified ? (
        <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      ) : pending ? (
        <Stack.Screen name="PendingApproval" component={PendingApproval} />
      ) : (
        <Stack.Group>
          <Stack.Screen name="Main" component={Main} />
          <Stack.Screen name="Chat" component={Chat} />
          <Stack.Screen name="NewGroup" component={NewGroup} />
          <Stack.Screen name="GroupInfo" component={GroupInfo} />
          <Stack.Screen name="AddMembers" component={AddMembers} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

export default RootStack;
