import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { showApiError } from '@/src/service/setup/handleApiError';
import { useAuthStore } from '@/src/store/auth.store';
import { showToast } from '@/src/store/toast.store';

/**
 * "Your application is waiting for approval". The server refuses everything else for this account, so the only things
 * to do here are: look again (approval makes the root navigator swap to the app by itself) and sign out.
 */
export const usePendingApproval = () => {
  const name = useAuthStore((s) => s.user?.name ?? '');
  const email = useAuthStore((s) => s.user?.email ?? '');
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const signOut = useAuthStore((s) => s.signOut);
  const [checking, setChecking] = useState(false);

  /** `quiet` = the automatic check when the app comes back: no toast, no error. */
  async function check(quiet = false) {
    if (checking) return;
    setChecking(true);
    try {
      await refreshUser();
      if (!quiet && useAuthStore.getState().user?.pendingApproval) showToast('Not approved yet. We will email you as soon as it is.', 'info');
    } catch (e) {
      if (!quiet) showApiError(e);
    } finally {
      setChecking(false);
    }
  }

  // Opening the app after reading the approval email should just work: look again whenever the app comes to the front.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check(true);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { name, email, checking, check: () => check(false), signOut };
};
