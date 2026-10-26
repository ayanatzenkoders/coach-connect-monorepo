import { useCallback, useEffect, useState } from 'react';

/**
 * A seconds countdown for "Resend in 0:42". Call `start(60)` to (re)start it; it ticks down once
 * a second and stops at 0. Each tick re-arms a one-second timer, so nothing runs when it is at 0.
 */
export function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // useCallback keeps `start` the same function between renders, so effects can depend on it safely.
  const start = useCallback((seconds: number) => setSecondsLeft(Math.max(0, Math.round(seconds))), []);

  return { secondsLeft, start };
}
