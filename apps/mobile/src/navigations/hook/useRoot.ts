import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/src/store/auth.store';

/**
 * The start of the app: check the saved login once, and keep the splash up until that check is done AND its
 * progress bar has finished filling.
 */
export function useRoot() {
  const status = useAuthStore(s => s.status);
  const restore = useAuthStore(s => s.restore);
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  // Once, when the app opens: check the saved login.
  useEffect(() => {
    restore();
  }, [restore]);

  return { ready: status !== 'booting', splashDone, finishSplash };
}
