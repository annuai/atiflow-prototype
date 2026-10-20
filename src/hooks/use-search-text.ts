import { useCallback, useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function useFilter(text: string, setText: (v: string) => void) {
  const needle = useDeferredValue(text.trim().toLowerCase());
  const matches = useCallback(
    (...fields: (string | null | undefined)[]) =>
      !needle || fields.some((f) => !!f && f.toLowerCase().includes(needle)),
    [needle],
  );
  return { text, setText, needle, matches };
}

/**
 * The state of a search box that filters a list on the same page: what is typed (`text`, for the input and for "No results for ..."), and `matches(...fields)`, which says whether a row
 * belongs in the list (everything does while nothing is typed; otherwise a row matches when any of its fields contains the words, ignoring case and outer spaces). The filtering follows
 * the text a moment later (`useDeferredValue`), so typing stays smooth in a list of thousands. For a search box inside a dialog; a page's own list uses `useUrlSearchText`.
 */
export function useSearchText(initial = '') {
  const [text, setText] = useState(initial);
  return useFilter(text, setText);
}

/**
 * The same, but the text lives in the address (`?q=...`), so a filtered list can be shared, reloaded or come back with Back. It replaces the history entry while typing, so Back does not
 * step through every letter, and keeps the other parameters. Needs a router.
 */
export function useUrlSearchText(key = 'q') {
  const [params, setParams] = useSearchParams();
  const text = params.get(key) ?? '';
  const setText = useCallback(
    (v: string) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (v) next.set(key, v);
          else next.delete(key);
          return next;
        },
        { replace: true },
      ),
    [key, setParams],
  );
  return useFilter(text, setText);
}
