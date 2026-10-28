import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ChatSummary } from '@/src/service/api/chat.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { useAuthStore } from '@/src/store/auth.store';
import { CHATS_QUERY_KEY, fetchChats } from './useUnreadTotal';

/**
 * The Messages tab: my chats. The list lives in the shared `['chats']` cache that the tab bar keeps live from
 * socket events (see useUnreadTotal), so a new message shows up here without this screen listening to anything.
 * It also reloads when I come back to the tab, as a safety net.
 */
export const useMessages = () => {
  const navigation = useNavigation();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  // False while a chat is open on top of the tabs.
  const focused = useIsFocused();

  const query = useQuery({
    queryKey: CHATS_QUERY_KEY,
    queryFn: fetchChats,
    enabled: focused,
    staleTime: 0, // always reload when the tab is shown again
  });

  // Reloads in the background are quiet: only complain when there is nothing to show at all (first load, pull to refresh).
  useEffect(() => {
    if (query.error && !query.data) showApiError(query.error);
  }, [query.error, query.data]);

  return {
    meId,
    items: query.data ?? [],
    loading: query.isPending,
    refresh: () => query.refetch(),
    open: (chat: ChatSummary) => navigation.navigate('Chat', { chat }),
    newGroup: () => navigation.navigate('NewGroup'),
  };
};
