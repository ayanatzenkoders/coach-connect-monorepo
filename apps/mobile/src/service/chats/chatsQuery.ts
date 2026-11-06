import type { QueryClient } from '@tanstack/react-query';
import { chatApi, ChatSummary } from '@/src/service/api/chat.api';
import { withAuth } from '@/src/service/setup/withAuth';

/**
 * The shared cache entry for "my chats", and the one safe way to change it. The Messages tab, the tab bar badge, the open chat
 * and Group info all use these, which is why they live here and not inside one screen.
 * (The pure list-editing helpers are next door in chatsCache.ts.)
 */

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
