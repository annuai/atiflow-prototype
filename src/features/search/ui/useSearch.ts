import { useEffect, useRef, useState } from 'react';
import { useMapData } from '@/features/workflow-builder';
import { useAuth } from '@/features/auth';
import { track } from '../analytics';
import { buildSearchContext } from '../context';
import { registerEntities } from '../entities';
import { searchAll } from '../service';
import type { SearchQuery, SearchResultPage } from '../types';

export interface SearchState {
  page: SearchResultPage | null;
  loading: boolean;
  error: boolean;
}
/**
 * Runs a search as the person types: waits `delay` ms after the last change, drops answers that arrive late (a newer search started), and keeps the old results on screen while the new ones load.
 * It also loads the map (stations and zones are searched from it) and searches again once it is there.
 */
export function useSearch(
  query: SearchQuery,
  delay = 150,
  enabled = true,
  report = false,
): SearchState & { retry(): void } {
  registerEntities();
  const user = useAuth((s) => s.user);
  const map = useMapData();
  const [state, setState] = useState<SearchState>({ page: null, loading: false, error: false });
  const run = useRef(0);
  const [again, setAgain] = useState(0);
  const key = JSON.stringify(query);
  useEffect(() => {
    if (!enabled || !user) return;
    const my = ++run.current;
    const t = window.setTimeout(async () => {
      const ctx = buildSearchContext();
      if (!ctx) return;
      setState((s) => ({ ...s, loading: true, error: false }));
      try {
        const page = await searchAll(JSON.parse(key) as SearchQuery, ctx);
        if (my !== run.current) return; // a newer search has started
        setState({ page, loading: false, error: false });
        const text = (JSON.parse(key) as SearchQuery).text.trim();
        if (report && text.length >= 2) {
          track({ name: 'search', q: text, total: page.total, tookMs: page.tookMs });
          if (!page.total) track({ name: 'zero_result', q: text });
        }
      } catch {
        if (my === run.current) setState((s) => ({ ...s, loading: false, error: true }));
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [key, delay, enabled, user, map, again, report]);
  return { ...state, retry: () => setAgain((n) => n + 1) };
}
