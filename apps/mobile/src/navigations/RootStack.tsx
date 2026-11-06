import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { COLORS } from '@/src/constants';
import ForgotPassword from '@/src/screens/auth/forgotPassword/ForgotPassword';
import NewPassword from '@/src/screens/auth/newPassword/NewPassword';
import PendingApproval from '@/src/screens/auth/pendingApproval/PendingApproval';
import Register from '@/src/screens/auth/register/Register';
import RegisterCoach from '@/src/screens/auth/registerCoach/RegisterCoach';
import ResetCode from '@/src/screens/auth/resetCode/ResetCode';
import SignIn from '@/src/screens/auth/signIn/SignIn';
import VerifyEmail from '@/src/screens/auth/verifyEmail/VerifyEmail';
import AddMembers from '@/src/screens/home/addMembers/AddMembers';
import Chat from '@/src/screens/home/chat/Chat';
import GroupInfo from '@/src/screens/home/groupInfo/GroupInfo';
import Main from '@/src/screens/home/main/Main';
import NewGroup from '@/src/screens/home/newGroup/NewGroup';
import Call from '@/src/screens/call/Call';
import { CallLayer } from '@/src/screens/call/CallLayer';
import Offline from '@/src/screens/system/offline/Offline';
import type { RootStackParamList } from '@/src/utils/types';
import { useSessionLifecycle } from './hook/useSessionLifecycle';
import { useStage } from './hook/useStage';
import type { Stage } from './stage';

// Native stack = UIKit / Android Fragment transitions on the native thread.
// Do NOT switch to @react-navigation/stack (JS-driven, heavier).
const Stack = createNativeStackNavigator<RootStackParamList>();

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: COLORS.background },
};

/**
 * The screens that exist in each stage (see stage.ts). These are plain functions, not components: the navigator reads the
 * <Screen> elements straight from its children. When the stage changes, React Navigation swaps the whole group, so a
 * signed-out person can never reach a signed-in screen and nobody calls navigate() after signing in.
 */
function screensFor(stage: Stage) {
  switch (stage) {
    case 'offline':
      return <Stack.Screen name="Offline" component={Offline} />;
    case 'signedOut':
      return (
        <Stack.Group>
          <Stack.Screen name="SignIn" component={SignIn} />
          <Stack.Screen name="Register" component={Register} />
          <Stack.Screen name="RegisterCoach" component={RegisterCoach} />
          <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          <Stack.Screen name="ResetCode" component={ResetCode} />
          <Stack.Screen name="NewPassword" component={NewPassword} />
        </Stack.Group>
      );
    case 'verifyEmail':
      return <Stack.Screen name="VerifyEmail" component={VerifyEmail} />;
    case 'pendingApproval':
      return (
        <Stack.Screen name="PendingApproval" component={PendingApproval} />
      );
    case 'app':
      return (
        <Stack.Group>
          <Stack.Screen name="Main" component={Main} />
          <Stack.Screen name="Chat" component={Chat} />
          <Stack.Screen name="NewGroup" component={NewGroup} />
          <Stack.Screen name="GroupInfo" component={GroupInfo} />
          <Stack.Screen name="AddMembers" component={AddMembers} />
          <Stack.Screen
            name="Call"
            component={Call}
            options={{ gestureEnabled: true }}
          />
        </Stack.Group>
      );
  }
}

const RootStack: React.FC = () => {
  useSessionLifecycle(); // socket, call room and cache follow the sign-in
  const stage = useStage();

  return (
    <>
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        {screensFor(stage)}
      </Stack.Navigator>
      {/* CALLS: the push listener and the ringing overlay live next to the navigator, so they work on every screen. */}
      {stage === 'app' && <CallLayer />}
    </>
  );
};

export default RootStack;
