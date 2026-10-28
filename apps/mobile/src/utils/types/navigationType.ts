import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ChatSummary } from '@/src/service/api/chat.api';

// Every screen in the root native stack, with its route params.
// Which ones exist at a given moment depends on the sign-in status (see navigations/RootStack.tsx).
export type RootStackParamList = {
  // Signed out
  SignIn: { passwordUpdated?: boolean } | undefined;
  Register: { email?: string } | undefined;
  RegisterCoach: undefined;
  ForgotPassword: undefined;
  ResetCode: { email: string; resendSeconds: number };
  NewPassword: { resetToken: string };
  // Signed in, email not verified yet
  VerifyEmail: undefined;
  // A coach who applied and verified the email: waiting for an admin
  PendingApproval: undefined;
  // Saved login but no connection
  Offline: undefined;
  // Signed in
  Main: undefined;
  Chat: { chat: ChatSummary };
  NewGroup: undefined;
  GroupInfo: { chatId: string; title: string };
  AddMembers: { chatId: string; memberIds: string[]; memberCount: number; hasCoach: boolean };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

// Makes `useNavigation()` / `useRoute()` typed app-wide without generics.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
