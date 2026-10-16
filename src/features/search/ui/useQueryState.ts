import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { EntityType, SearchSort } from '../types';

/** The search page's state, all in the address: the text, the type tab, the filters and the sort (so Back and sharing work). */
export function useQueryState() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const type = (params.get('type') as EntityType | null) ?? null;
  const sort = (params.get('sort') as SearchSort | null) ?? 'relevance';
  const set = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        for (const [k, v] of Object.entries(patch)) {
          if (v) n.set(k, v);
          else n.delete(k);
        }
        return n;
      },
      { replace: true },
    );
  const filters = useMemo(
    () =>
      Object.fromEntries(
        (['status', 'fleet', 'zone'] as const).flatMap((k) => (params.get(k) ? [[k, params.get(k)!]] : [])),
      ),
    [params],
  );
  return { params, q, type, sort, set, filters };
}
