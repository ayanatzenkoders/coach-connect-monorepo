import { QueryClient } from '@tanstack/react-query';

/**
 * The ONE React Query client of the app. It lives here, not inside App.tsx, so code outside React can reach it:
 * on sign-out `useSessionLifecycle` empties it, so the next person to sign in on this phone never sees the
 * previous person's chats, profile or people list.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid refetch storms on mobile: data stays fresh for 30 s and a failed request retries once.
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});
