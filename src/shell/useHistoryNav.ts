import { useEffect, useSyncExternalStore } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

/** Highest history position reached so far: positions above the current one are what "Forward" can still reach. Survives page changes (it lives outside the component). */
const reached = (() => {
  let furthest = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => furthest,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    /** a push cuts off everything after it; a back / forward (POP) does not */
    track(type: string, idx: number) {
      const next = type === 'PUSH' ? idx : Math.max(furthest, idx);
      if (next === furthest) return;
      furthest = next;
      listeners.forEach((l) => l());
    },
  };
})();

/**
 * Back / Forward for the top bar, on top of the router's own history (so it behaves exactly like the browser buttons).
 * react-router stores each entry's position in `history.state.idx`.
 */
export function useHistoryNav() {
  const navigate = useNavigate();
  const type = useNavigationType();
  const { key } = useLocation(); // re-evaluate on every navigation
  const idx: number = window.history.state?.idx ?? 0;
  useEffect(() => reached.track(type, idx), [type, idx, key]);
  const furthest = useSyncExternalStore(reached.subscribe, reached.get);
  return {
    canBack: idx > 0,
    canForward: idx < Math.max(furthest, idx),
    back: () => navigate(-1),
    forward: () => navigate(1),
  };
}
