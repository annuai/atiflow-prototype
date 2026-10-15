import { useEffect, useState } from 'react';

/** True on touch-first devices (`pointer: coarse`): drives touch-only UI such as the walk stick. */
export function useCoarse() {
  const q = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;
  const [v, setV] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const f = () => setV(q.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, [q]);
  return v;
}
