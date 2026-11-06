import { useEffect } from 'react';
import { AppState } from 'react-native';
import { leaveRoom } from '@/src/service/call/callEngine';
import { queryClient } from '@/src/service/setup/queryClient';
import { connectSocket, disconnectSocket } from '@/src/service/socket/socket';
import { useAuthStore } from '@/src/store/auth.store';
import { useCallStore } from '@/src/store/call.store';

/**
 * Everything that must start and stop together with the sign-in. Mounted once, by RootStack.
 *  - The live connection (socket) exists exactly while the person is signed in and allowed in. Signing out, or a ban that
 *    ends the session, closes it, so nothing is pushed to a signed-out phone.
 *  - A call (LiveKit room, call state) never outlives the login.
 *  - On sign-out the React Query cache is emptied: the next person to sign in on this phone must not see the last person's
 *    chats, profile or people list, not even for a moment.
 */
export function useSessionLifecycle() {
  const status = useAuthStore(s => s.status);
  const pending = useAuthStore(s => s.user?.pendingApproval ?? false);

  useEffect(() => {
    if (status !== 'signedIn' || pending) {
      disconnectSocket();
      // Signed out (or banned) in the middle of a call: close the room and forget the call.
      leaveRoom();
      useCallStore.getState().reset();
      // Only for a real sign-out (also a ban or a finished session). `offline` keeps the data for when the network is back.
      if (status === 'signedOut') queryClient.clear();
      return;
    }
    connectSocket();
    // iOS closes sockets of apps that sit in the background. When the app comes back, reconnect
    // (connect() does nothing if the socket is still open). Screens then catch up on what they missed.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') connectSocket();
    });
    return () => sub.remove();
  }, [status, pending]);
}
