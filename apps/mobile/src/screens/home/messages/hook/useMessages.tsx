import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { chatApi, ChatSummary } from '@/src/service/api/chat.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { withAuth } from '@/src/service/setup/withAuth';
import { getSocket } from '@/src/service/socket/socket';
import { useAuthStore } from '@/src/store/auth.store';
import { SOCKET_EVENTS } from '@coach-connect/shared/realtime';

/** The Messages tab: my chats, refreshed when the server pushes a change and when I come back to the tab. */
export const useMessages = () => {
  const navigation = useNavigation();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  // False while a chat is open on top of the tabs: no polling in the background.
  const focused = useIsFocused();

  const query = useQuery({
    queryKey: ['chats'],
    queryFn: async () => (await withAuth((token) => chatApi.chats(token))).items,
    enabled: focused,
    staleTime: 0, // always reload when the tab is shown again
  });

  // REAL-TIME: the server pushes "new message" / "someone read" for ANY of my chats (not just an open one).
  // We only mark the list as out of date; React Query reloads it right away if this tab is showing, or the next
  // time it is shown (the query is disabled while a chat is open on top). One small request per event,
  // instead of one every 5 seconds around the clock.
  const queryClient = useQueryClient();
  useEffect(() => {
    const socket = getSocket();
    const reload = () => queryClient.invalidateQueries({ queryKey: ['chats'] });
    socket.on(SOCKET_EVENTS.messageNew, reload); // new last message and a bigger unread badge
    socket.on(SOCKET_EVENTS.chatRead, reload); // unread badge goes down (my own read, from another device)
    socket.on('connect', reload); // after a gap in the connection, events may have been missed
    return () => {
      socket.off(SOCKET_EVENTS.messageNew, reload);
      socket.off(SOCKET_EVENTS.chatRead, reload);
      socket.off('connect', reload);
    };
  }, [queryClient]);

  // Quiet polling: only complain when there is nothing to show at all (first load, pull to refresh).
  useEffect(() => {
    if (query.error && !query.data) showApiError(query.error);
  }, [query.error, query.data]);

  return {
    meId,
    items: query.data ?? [],
    loading: query.isPending,
    refresh: () => query.refetch(),
    open: (chat: ChatSummary) => navigation.navigate('Chat', { chat }),
  };
};
