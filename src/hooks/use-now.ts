import { useEffect, useState } from 'react';

/** The current time (epoch ms), refreshed every `everyMs` (a minute by default), for text such as "calibrated 3 days ago" that must not go stale on a page left open. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}
