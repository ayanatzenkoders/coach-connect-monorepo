import { StackActions, useNavigation } from '@react-navigation/native';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SOCKET_EVENTS } from '@coach-connect/shared/realtime';
import type { ChatDeletedPayload, ChatReadPayload, ChatUpdatedPayload, MessageNewPayload } from '@coach-connect/shared/realtime';
import { chatApi, ChatSummary } from '@/src/service/api/chat.api';
import { withAuth } from '@/src/service/setup/withAuth';
import { getSocket } from '@/src/service/socket/socket';
import { useActiveChatStore } from '@/src/store/activeChat.store';
import { useAuthStore } from '@/src/store/auth.store';
import { showToast } from '@/src/store/toast.store';
import { applyMessageNew, applyMyRead, removeChat, totalUnread } from '../chatsCache';

/** The one cache entry holding "my chats". The Messages tab and the tab bar badge both read it. */
export const CHATS_QUERY_KEY = ['chats'] as const;
export const fetchChats = async () => (await withAuth((token) => chatApi.chats(token))).items;

/** Change the cached chat list with `apply`; if it cannot be patched safely (returns null, or nothing is cached yet), reload it instead. */
export function patchChatsCache(queryClient: QueryClient, apply: (chats: ChatSummary[]) => ChatSummary[] | null) {
  const current = queryClient.getQueryData<ChatSummary[]>(CHATS_QUERY_KEY);
  const next = current ? apply(current) : null;
  if (next) queryClient.setQueryData(CHATS_QUERY_KEY, next);
  else queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });
}

/**
 * Number of unread messages over all chats, for the badge on the Messages tab. Used ONCE, by the tab bar screen
 * (Main), which stays mounted while a chat is open and on every tab, so this keeps the list live everywhere:
 *  - message:new  -> patch the cached list (preview, unread count, order) without any request
 *  - chat:read    -> only my own reads matter here (another device of mine, or this app)
 *  - chat:created -> someone made a group with me in it: reload the list so it appears
 *  - chat:updated -> people were added to one of my groups: reload the list and that group's info
 *  - chat:deleted -> the creator deleted a group: drop it from the list; if I am inside it, go back to the tab bar
 *  - socket (re)connect, app back in the foreground -> reload, in case events were missed
 */
export function useUnreadTotal(): number {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const meId = useAuthStore((s) => s.user?.id ?? '');

  const query = useQuery({
    queryKey: CHATS_QUERY_KEY,
    queryFn: fetchChats,
    staleTime: 30_000, // live events keep it fresh; this only avoids a reload on every remount
    select: totalUnread,
  });

  useEffect(() => {
    const socket = getSocket();
    const onNew = (payload: MessageNewPayload) =>
      patchChatsCache(queryClient, (chats) => applyMessageNew(chats, payload, meId, useActiveChatStore.getState().chatId));
    const onRead = (payload: ChatReadPayload) => {
      if (payload.userId === meId) patchChatsCache(queryClient, (chats) => applyMyRead(chats, payload.chatId, payload.lastReadSequenceNumber));
    };
    const onUpdated = ({ chatId }: ChatUpdatedPayload) => {
      queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    };
    const onDeleted = ({ chatId }: ChatDeletedPayload) => {
      const known = queryClient.getQueryData<ChatSummary[]>(CHATS_QUERY_KEY)?.some((c) => c.id === chatId);
      patchChatsCache(queryClient, (chats) => removeChat(chats, chatId));
      queryClient.removeQueries({ queryKey: ['chat', chatId] });
      // The creator already left and cleaned up after their own delete (the chat is no longer cached): nothing more to say.
      if (!known) return;
      // Looking at the deleted group (its chat or its info): leave it, there is nothing left to show.
      if (useActiveChatStore.getState().chatId === chatId) {
        navigation.dispatch(StackActions.popToTop());
        showToast('This group was deleted.', 'info');
      }
    };
    const reload = () => queryClient.invalidateQueries({ queryKey: CHATS_QUERY_KEY });

    socket.on(SOCKET_EVENTS.messageNew, onNew);
    socket.on(SOCKET_EVENTS.chatRead, onRead);
    socket.on(SOCKET_EVENTS.chatCreated, reload); // a new chat the cache has never heard of: reload to get it
    socket.on(SOCKET_EVENTS.chatUpdated, onUpdated);
    socket.on(SOCKET_EVENTS.chatDeleted, onDeleted);
    socket.on('connect', reload);
    const appState = AppState.addEventListener('change', (state) => state === 'active' && reload());
    return () => {
      socket.off(SOCKET_EVENTS.messageNew, onNew);
      socket.off(SOCKET_EVENTS.chatRead, onRead);
      socket.off(SOCKET_EVENTS.chatCreated, reload);
      socket.off(SOCKET_EVENTS.chatUpdated, onUpdated);
      socket.off(SOCKET_EVENTS.chatDeleted, onDeleted);
      socket.off('connect', reload);
      appState.remove();
    };
  }, [queryClient, navigation, meId]);

  return query.data ?? 0;
}
