import { useState } from 'react';

/**
 * A local copy of a value that the person edits (the text of a box before it is saved) and that starts again from `value` whenever `value` or `resetKey` changes (another item was
 * opened, the stored value changed). It adjusts during rendering, the way React recommends, instead of in an effect (which would draw the old text for one frame).
 */
export function useSyncedState<T>(value: T, resetKey?: unknown): [T, (next: T) => void] {
  const [state, setState] = useState(value);
  const [from, setFrom] = useState({ value, resetKey });
  if (!Object.is(from.value, value) || !Object.is(from.resetKey, resetKey)) {
    setFrom({ value, resetKey });
    setState(value);
  }
  return [state, setState];
}

/**
 * Runs `reset` while rendering when `value` changed since the last render (another fleet was chosen: forget what depended on the old one). Like `useSyncedState`, this is the
 * render-time adjustment React recommends for state that must follow a prop; the first render does nothing.
 */
export function useOnChange<T>(value: T, reset: (value: T) => void) {
  const [seen, setSeen] = useState(value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    reset(value);
  }
}
