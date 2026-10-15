import { useCallback, useEffect, useRef, useState } from 'react';

export interface Resource<T> {
  data: T | undefined;
  /** a load for the current key is under way (the previous data, if any, stays in `data` during a reload) */
  loading: boolean;
  /** the message of the last failed load, '' when fine */
  error: string;
  reload(): void;
  /** replace what is shown (after an action returned fresh data) */
  set(next: T): void;
}
interface Settled<T> {
  key: string;
  tick: number;
  data?: T;
  error: string;
}

/**
 * Loads something asynchronous (a service call) when `key` changes, and keeps the answer. A late answer for an old key is dropped; data of another key is never shown. Not a cache: call
 * sites that want one use their own store. `load` may change between renders without reloading; only `key` (and `reload()`) decides.
 */
export function useResource<T>(load: () => Promise<T>, key: string): Resource<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let live = true;
    loadRef.current().then(
      (data) => live && setSettled({ key, tick, data, error: '' }),
      (e: unknown) =>
        live &&
        setSettled((s) => ({
          key,
          tick,
          data: s?.key === key ? s.data : undefined,
          error: e instanceof Error ? e.message : 'Something went wrong.',
        })),
    );
    return () => {
      live = false;
    };
  }, [key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const set = useCallback((data: T) => setSettled({ key, tick, data, error: '' }), [key, tick]);
  const current = settled?.key === key;
  return {
    data: current ? settled.data : undefined,
    loading: !current || settled.tick !== tick,
    error: current && settled.tick === tick ? settled.error : '',
    reload,
    set,
  };
}
