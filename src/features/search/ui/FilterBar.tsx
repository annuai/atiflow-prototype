import { copy } from '../copy';
import type { SearchGroup, SearchSort } from '../types';

const SORTS: SearchSort[] = ['relevance', 'recent', 'az'];
const field =
  'min-h-11 rounded-lg border border-primary bg-primary px-3 text-sm text-primary outline-focus-ring focus-visible:outline-2';
export const FIELD = field;

/** Status / fleet / zone filters (only those the current results have), sort, and "Clear filters". */
export function FilterBar({
  groups,
  params,
  sort,
  onSet,
}: {
  groups: SearchGroup[];
  params: URLSearchParams;
  sort: SearchSort;
  onSet(patch: Record<string, string | null>): void;
}) {
  const values = (key: 'status' | 'fleet' | 'zone') =>
    [...new Set(groups.flatMap((g) => g.results.map((r) => r.facets?.[key]).filter((x): x is string => !!x)))].sort();
  const active = ['status', 'fleet', 'zone'].some((k) => params.get(k));
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {(['status', 'fleet', 'zone'] as const).map((k) => {
        const list = values(k);
        if (!list.length && !params.get(k)) return null;
        return (
          <label key={k} className="flex items-center gap-2 text-sm text-tertiary">
            {copy.ui[k]}
            <select
              className={field}
              value={params.get(k) ?? ''}
              onChange={(e) => onSet({ [k]: e.target.value || null })}
            >
              <option value="">{copy.ui.any}</option>
              {list.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        );
      })}
      <label className="flex items-center gap-2 text-sm text-tertiary">
        {copy.ui.sort}
        <select
          className={field}
          value={sort}
          onChange={(e) => onSet({ sort: e.target.value === 'relevance' ? null : e.target.value })}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {s === 'relevance' ? copy.ui.relevance : s === 'recent' ? copy.ui.recentSort : copy.ui.az}
            </option>
          ))}
        </select>
      </label>
      {active && (
        <button
          type="button"
          className="min-h-11 text-sm font-semibold text-brand-secondary underline"
          onClick={() => onSet({ status: null, fleet: null, zone: null })}
        >
          {copy.ui.clearFilters}
        </button>
      )}
    </div>
  );
}
