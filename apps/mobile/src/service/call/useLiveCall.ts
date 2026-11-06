import { useQuery } from '@tanstack/react-query';
import { callApi } from '@/src/service/api/call.api';
import { withAuth } from '@/src/service/setup/withAuth';
import { isLive } from '@/src/service/call/callUi';

/** The call that is live in this chat right now (or null). Kept fresh by useCallSignals through the ['call', chatId] cache entry. */
export function useLiveCall(chatId: string) {
  const query = useQuery({
    queryKey: ['call', chatId],
    queryFn: () => withAuth((token) => callApi.inChat(token, chatId)),
    staleTime: 15_000,
    retry: false,
  });
  const call = query.data?.call;
  return isLive(call) ? call : null;
}
