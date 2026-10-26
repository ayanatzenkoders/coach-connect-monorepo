import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ConversationSummary } from '@/src/service/api/chat.api';

// Every screen in the root native stack, with its route params.
// Which ones exist at a given moment depends on the sign-in status (see navigations/RootStack.tsx).
export type RootStackParamList = {
  // Signed out
  SignIn: { passwordUpdated?: boolean } | undefined;
  Register: { email?: string } | undefined;
  ForgotPassword: undefined;
  ResetCode: { email: string; resendSeconds: number };
  NewPassword: { resetToken: string };
  // Signed in, email not verified yet
  VerifyEmail: undefined;
  // Saved login but no connection
  Offline: undefined;
  // Signed in
  Main: undefined;
  Chat: { conversation: ConversationSummary };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

// Makes `useNavigation()` / `useRoute()` typed app-wide without generics.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
