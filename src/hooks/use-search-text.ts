import { useCallback, useDeferredValue, useState } from 'react';

/**
 * The state of a search box that filters a list on the same page: what is typed (`text`, for the input and for "No results for ..."), and `matches(...fields)`, which says whether a row
 * belongs in the list (everything does while nothing is typed; otherwise a row matches when any of its fields contains the words, ignoring case and outer spaces). The filtering follows
 * the text a moment later (`useDeferredValue`), so typing stays smooth in a list of thousands.
 */
export function useSearchText(initial = '') {
  const [text, setText] = useState(initial);
  const needle = useDeferredValue(text.trim().toLowerCase());
  const matches = useCallback(
    (...fields: (string | null | undefined)[]) =>
      !needle || fields.some((f) => !!f && f.toLowerCase().includes(needle)),
    [needle],
  );
  return { text, setText, needle, matches };
}
