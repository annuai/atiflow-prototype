import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A choice that lives in the address (`?tab=unread`): the tabs and filters of a page, so a link or a reload comes back to the same view. A value that is not in `allowed` (an old or edited
 * link) is the `fallback`, and the fallback is not written (the plain address is the default view). Replaces the history entry, so Back leaves the page instead of stepping through tabs;
 * other parameters of the address are kept.
 */
export function useQueryParam<T extends string>(key: string, fallback: T, allowed?: readonly T[]) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = (raw !== null && (!allowed || allowed.includes(raw as T)) ? raw : fallback) as T;
  const set = useCallback(
    (v: T) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (v === fallback) next.delete(key);
          else next.set(key, v);
          return next;
        },
        { replace: true },
      ),
    [key, fallback, setParams],
  );
  return [value, set] as const;
}
