import { useEffect, useRef } from 'react';

/**
 * Calls `onEnd` whenever the returned element scrolls into (or near) view, again after each change of `watch` while it is still in view.
 * Put the element after a list to load or reveal more rows as the person scrolls. Works inside any scrolling ancestor.
 */
export function useEndReached<T extends Element>(onEnd: (() => void) | undefined, watch: unknown, marginPx = 400) {
  const ref = useRef<T>(null);
  const cb = useRef(onEnd);
  useEffect(() => {
    cb.current = onEnd;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !cb.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && cb.current?.(), {
      rootMargin: `0px 0px ${marginPx}px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [watch, marginPx, !!onEnd]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}
