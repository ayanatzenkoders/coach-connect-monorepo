import { useEffect, useRef } from 'react';

/** Runs `callback` every `ms` milliseconds while mounted. `null` pauses it. Always calls the newest callback. */
export function useInterval(callback: () => void, ms: number | null) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => latest.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
