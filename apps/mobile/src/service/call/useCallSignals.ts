import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { SOCKET_EVENTS } from '@coach-connect/shared/realtime';
import type { CallIncomingPayload, CallUpdatedPayload } from '@coach-connect/shared/realtime';
import { endedMessage } from '@/src/service/call/callUi';
import { leaveRoom } from '@/src/service/call/callEngine';
import { getSocket } from '@/src/service/socket/socket';
import { useAuthStore } from '@/src/store/auth.store';
import { useCallStore } from '@/src/store/call.store';
import { showToast } from '@/src/store/toast.store';

/**
 * Listens to the server's call pushes. Mounted ONCE (by CallLayer) while signed in.
 *  - call:incoming -> somebody is calling me: show the ringing overlay
 *  - call:updated  -> a call in one of my chats changed. Keep the three things that show calls up to date:
 *                     the ringing overlay, the call I am in, and the "Call in progress" banner of that chat
 */
export function useCallSignals() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const meId = useAuthStore((s) => s.user?.id ?? '');

  useEffect(() => {
    const socket = getSocket();
    const store = () => useCallStore.getState();

    const onIncoming = ({ call }: CallIncomingPayload) => {
      if (call.startedById === meId) return; // my own call, on another phone of mine
      if (store().active) return; // already in a call: the server marks me BUSY for new ones, this is just a safety net
      store().setIncoming(call);
    };

    const onUpdated = ({ call }: CallUpdatedPayload) => {
      const over = call.state === 'ENDED';
      // 1. The "Call in progress" banner of that chat.
      queryClient.setQueryData(['call', call.chatId], { call: over ? null : call });

      // 2. The ringing overlay: close it when the call is over, or I am no longer being rung (answered on another phone...).
      const mine = call.participants.find((p) => p.userId === meId);
      const incoming = store().incoming;
      if (incoming?.id === call.id && (over || mine?.status !== 'INVITED')) {
        store().setIncoming(null);
        if (over && call.endReason !== 'COMPLETED') showToast(endedMessage(call), 'info');
      }

      // 3. The call I am in: keep it fresh, and if it is over (or I was removed), close it on this phone too.
      const active = store().active;
      if (active?.id === call.id) {
        const removed = mine?.joinedAt && mine.leftAt;
        if (over || removed) {
          store().setActive(null);
          leaveRoom();
          showToast(removed && !over ? 'You left the call.' : 'Call ended.', 'info');
        } else {
          store().setActive(call);
        }
      }
    };

    // After a lost connection we may have missed pushes: forget what the banners think and ask again.
    const onReconnect = () => queryClient.invalidateQueries({ queryKey: ['call'] });

    socket.on(SOCKET_EVENTS.callIncoming, onIncoming);
    socket.on(SOCKET_EVENTS.callUpdated, onUpdated);
    socket.on('connect', onReconnect);
    return () => {
      socket.off(SOCKET_EVENTS.callIncoming, onIncoming);
      socket.off(SOCKET_EVENTS.callUpdated, onUpdated);
      socket.off('connect', onReconnect);
    };
  }, [queryClient, navigation, meId]);
}
