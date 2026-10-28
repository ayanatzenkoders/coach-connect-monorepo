import { useEffect, useState } from 'react';
import { useConnectionStore } from '@/src/store/connection.store';

/** How long the connection must stay down before the banner appears. A quick reconnect (app coming back to the foreground) should not flash it. */
export const CONNECTION_BANNER_DELAY_MS = 2000;

/** True when the "connection lost" banner should be on screen: not connected for more than a moment. It goes away the instant the connection is back. */
export function useConnectionBanner(): boolean {
  const status = useConnectionStore((s) => s.status);
  const down = status === 'connecting' || status === 'disconnected';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!down) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), CONNECTION_BANNER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [down]);

  // "connecting" and "disconnected" alternate while Socket.IO retries; treating both as "down" keeps the banner steady instead of flickering.
  return down && visible;
}
