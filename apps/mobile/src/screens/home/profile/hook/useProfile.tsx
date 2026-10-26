import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { authApi } from '@/src/service/api/auth.api';
import { ApiError } from '@/src/service/setup/apiClient';
import { withAuth } from '@/src/service/setup/withAuth';
import { useAuthStore } from '@/src/store/auth.store';

/** The Profile tab: who I am (from GET /auth/me), plus the dev buttons that exercise the token flow. */
export const useProfile = () => {
  const signOut = useAuthStore((s) => s.signOut);
  const [note, setNote] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['me'],
    queryFn: () => withAuth((token) => authApi.me(token)),
    staleTime: 0,
    retry: false,
  });

  const lastRequest =
    note ??
    (query.isError
      ? query.error instanceof ApiError
        ? `GET /auth/me: ${query.error.status} ${query.error.code}`
        : 'GET /auth/me: failed'
      : query.isSuccess
        ? 'GET /auth/me: OK'
        : 'not run yet');

  return {
    me: query.data ?? null,
    lastRequest,
    busy: query.isFetching,
    reload: () => {
      setNote(null);
      return query.refetch();
    },
    /** Pretend the 15-minute token ran out. "Reload profile" should then refresh silently and still work. */
    expireToken: () => {
      useAuthStore.setState({ accessToken: 'expired-on-purpose' });
      setNote('token spoiled; press Reload profile');
    },
    signOut,
  };
};
