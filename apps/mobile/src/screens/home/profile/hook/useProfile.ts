import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from 'react-native';
import { authApi, type Me } from '@/src/service/api/auth.api';
import { coachApi } from '@/src/service/api/coach.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { withAuth } from '@/src/service/setup/withAuth';
import { useAuthStore } from '@/src/store/auth.store';
import { showToast } from '@/src/store/toast.store';

/**
 * The Profile tab: who I am. Name, email and role are known the moment the screen opens (they came with the
 * sign-in); the subscription details arrive from GET /auth/me a moment later.
 */
export const useProfile = () => {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  // True only while the user is pulling down to refresh. Never "something is loading": that makes lists jump (see People).
  const [pulling, setPulling] = useState(false);

  const queryClient = useQueryClient();
  const [savingAvailability, setSavingAvailability] = useState(false);

  const query = useQuery({
    queryKey: ['me'],
    queryFn: () => withAuth((token) => authApi.me(token)),
    staleTime: 0, // reload when the tab is opened; the cached answer is shown meanwhile
    retry: false,
  });

  const me = query.data ?? null;

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  /**
   * "Available now" on or off (coaches only). The switch moves at once (the cached `me` is updated first), the server
   * saves it, and if that fails the switch jumps back and the reason is shown. People lists reload so members see it.
   */
  async function setAvailable(available: boolean) {
    if (savingAvailability) return;
    const before = queryClient.getQueryData<Me>(['me']);
    queryClient.setQueryData<Me>(['me'], (current) => (current ? { ...current, isAvailable: available } : current));
    setSavingAvailability(true);
    try {
      await withAuth((token) => coachApi.setAvailability(token, available));
      queryClient.invalidateQueries({ queryKey: ['people'] });
    } catch (e) {
      queryClient.setQueryData(['me'], before);
      showApiError(e);
    } finally {
      setSavingAvailability(false);
    }
  }

  return {
    me,
    /** Coaches only: is "Available now" on? (false until the server has answered) */
    available: me?.isAvailable ?? false,
    savingAvailability,
    setAvailable,
    name: me?.name ?? user?.name ?? '',
    email: me?.email ?? user?.email ?? '',
    role: me?.role ?? user?.role ?? 'MEMBER',
    emailVerified: me?.emailVerified ?? user?.emailVerified ?? false,
    /** The membership details are still on their way. */
    loading: query.isPending,
    /** The details could not be loaded and there is nothing cached to show. */
    failed: query.isError && !me,
    pulling,
    refresh,
    /** Ask first: signing out is easy to tap by mistake and means typing the password again. */
    confirmSignOut: () =>
      Alert.alert('Sign out?', 'You will need to sign in again to use Coach Connect.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
      ]),
    /** Development only: pretend the 15-minute token ran out. Pull to refresh should then renew it silently and still work. */
    expireToken: () => {
      useAuthStore.setState({ accessToken: 'expired-on-purpose' });
      showToast('Token spoiled. Pull down to reload: it should renew silently.', 'info');
    },
  };
};
