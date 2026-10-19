import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';

type Nav = {
  push: (...a: unknown[]) => void;
  replace: (...a: unknown[]) => void;
  go: (delta: number) => void;
};
const pathOf = (to: unknown): string | null =>
  typeof to === 'string'
    ? to.split(/[?#]/)[0]
    : to && typeof to === 'object'
      ? ((to as { pathname?: string }).pathname ?? null)
      : null;

/**
 * Stops the app from leaving the page while `dirty`: a link, the sidebar, the top bar's Back / Forward, the browser's own Back and closing the tab. `pending` turns true when a way out was attempted;
 * `leave()` lets that very navigation through, `stay()` drops it. (The app uses a plain BrowserRouter, which has no blocker of its own, so this wraps the router's navigator while it is needed.)
 * A change of the query string or hash on the same page is not "leaving", and neither is a path `opts.allow` accepts (another view of the same work, such as the 3D view of the map being edited).
 */
export function useLeaveGuard(dirty: boolean, opts: { allow?: (path: string) => boolean } = {}) {
  const { navigator } = useContext(NavigationContext) as unknown as { navigator: Nav };
  const [pending, setPending] = useState(false);
  const proceed = useRef<(() => void) | null>(null);
  const allow = useRef(false);
  const sameWork = useRef(opts.allow);
  sameWork.current = opts.allow;

  useEffect(() => {
    if (!dirty) return;
    const orig = { push: navigator.push, replace: navigator.replace, go: navigator.go };
    const hold = (run: () => void) => {
      proceed.current = () => {
        allow.current = true;
        run();
        allow.current = false;
      };
      setPending(true);
    };
    const guarded = (kind: 'push' | 'replace') =>
      function (this: unknown, ...a: unknown[]) {
        const target = pathOf(a[0]);
        if (allow.current || target === null || target === window.location.pathname || sameWork.current?.(target))
          return orig[kind].apply(navigator, a as never);
        hold(() => orig[kind].apply(navigator, a as never));
      };
    navigator.push = guarded('push');
    navigator.replace = guarded('replace');
    navigator.go = (delta: number) => {
      if (allow.current) return orig.go.call(navigator, delta);
      hold(() => orig.go.call(navigator, delta));
    };
    // the browser's Back / Forward button: the address has already moved, so put it back and ask; the router must not hear about it
    let at = window.history.state?.idx ?? 0,
      reverting = false;
    const pop = (e: PopStateEvent) => {
      const now: number = window.history.state?.idx ?? 0;
      if (reverting) {
        reverting = false;
        e.stopImmediatePropagation();
        return;
      }
      if (allow.current) {
        at = now;
        return;
      }
      e.stopImmediatePropagation();
      const delta = now - at;
      reverting = true;
      orig.go.call(navigator, -delta);
      hold(() => {
        orig.go.call(navigator, delta);
        at = now;
      });
    };
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', pop, { capture: true });
    window.addEventListener('beforeunload', unload);
    return () => {
      navigator.push = orig.push;
      navigator.replace = orig.replace;
      navigator.go = orig.go;
      window.removeEventListener('popstate', pop, { capture: true });
      window.removeEventListener('beforeunload', unload);
    };
  }, [dirty, navigator]);

  const stay = useCallback(() => {
    proceed.current = null;
    setPending(false);
  }, []);
  const leave = useCallback(() => {
    const run = proceed.current;
    proceed.current = null;
    setPending(false);
    run?.();
  }, []);
  return { pending, stay, leave };
}
