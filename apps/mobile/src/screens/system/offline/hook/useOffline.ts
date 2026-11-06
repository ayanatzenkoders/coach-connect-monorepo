import { useState } from 'react';
import { useAuthStore } from '@/src/store/auth.store';

/** We have a saved login but cannot reach the server: "Try again" checks the saved login once more. */
export const useOffline = () => {
  const restore = useAuthStore((s) => s.restore);
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      await restore();
    } finally {
      setBusy(false);
    }
  }

  return { busy, retry };
};
