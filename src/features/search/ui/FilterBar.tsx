import { Button } from '@/components/base/buttons/button';
import { Select } from '@/components/base/select/select';
import { copy } from '../copy';
import type { SearchGroup, SearchSort } from '../types';

const SORTS: SearchSort[] = ['relevance', 'recent', 'az'];
const ANY = '__any';

/** Status / fleet / zone filters (only those the current results have), sort, and "Clear filters": Untitled UI Select and Button. */
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
  const sortLabel = (s: SearchSort) =>
    s === 'relevance' ? copy.ui.relevance : s === 'recent' ? copy.ui.recentSort : copy.ui.az;
  return (
    <div className="flex shrink-0 flex-wrap items-end gap-3">
      {(['status', 'fleet', 'zone'] as const).map((k) => {
        const list = values(k);
        const current = params.get(k);
        if (!list.length && !current) return null;
        const items = [{ id: ANY, label: copy.ui.any }, ...list.map((v) => ({ id: v, label: v }))];
        return (
          <Select
            key={k}
            size="sm"
            label={copy.ui[k]}
            aria-label={copy.ui[k]}
            className="w-[calc(50%-0.375rem)] sm:w-40"
            selectedKey={current ?? ANY}
            onSelectionChange={(id) => onSet({ [k]: id === ANY ? null : String(id) })}
            items={items}
          >
            {(item) => <Select.Item {...item} />}
          </Select>
        );
      })}
      <Select
        size="sm"
        label={copy.ui.sort}
        aria-label={copy.ui.sort}
        className="w-[calc(50%-0.375rem)] sm:w-40"
        selectedKey={sort}
        onSelectionChange={(id) => onSet({ sort: id === 'relevance' ? null : String(id) })}
        items={SORTS.map((s) => ({ id: s, label: sortLabel(s) }))}
      >
        {(item) => <Select.Item {...item} />}
      </Select>
      {active && (
        <Button size="sm" color="link-color" onPress={() => onSet({ status: null, fleet: null, zone: null })}>
          {copy.ui.clearFilters}
        </Button>
      )}
    </div>
  );
}
