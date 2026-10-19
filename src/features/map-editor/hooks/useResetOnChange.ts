import { useState } from 'react';

/** Runs `reset` while rendering the first time `key` differs from the last render (the way React lets a page drop state that belonged to what was shown before). */
export function useResetOnChange(key: string | undefined, reset: () => void) {
  const [shown, setShown] = useState(key);
  if (shown !== key) {
    setShown(key);
    reset();
  }
}
