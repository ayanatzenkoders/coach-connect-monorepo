import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { chatApi, ConversationSummary } from '@/src/service/api/chat.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { withAuth } from '@/src/service/setup/withAuth';
import { useAuthStore } from '@/src/store/auth.store';

/** How often the list refreshes while the Messages tab is on screen. */
export const MESSAGES_POLL_MS = 5000;

/** The Messages tab: my conversations, kept fresh while visible and refreshed the moment I come back to it. */
export const useMessages = () => {
  const navigation = useNavigation();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  // False while a chat is open on top of the tabs: no polling in the background.
  const focused = useIsFocused();

  const query = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => (await withAuth((token) => chatApi.conversations(token))).items,
    enabled: focused,
    staleTime: 0,
    refetchInterval: focused ? MESSAGES_POLL_MS : false,
  });

  // Quiet polling: only complain when there is nothing to show at all (first load, pull to refresh).
  useEffect(() => {
    if (query.error && !query.data) showApiError(query.error);
  }, [query.error, query.data]);

  return {
    meId,
    items: query.data ?? [],
    loading: query.isPending,
    refresh: () => query.refetch(),
    open: (conversation: ConversationSummary) => navigation.navigate('Chat', { conversation }),
  };
};
