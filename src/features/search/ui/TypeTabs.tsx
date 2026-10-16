import { copy } from '../copy';
import type { EntityType, SearchGroup } from '../types';

/** The type tabs of the results page: All and each type that has results, with its count. */
export function TypeTabs({
  groups,
  total,
  type,
  allowed,
  onPick,
}: {
  groups: SearchGroup[];
  total: number;
  type: EntityType | null;
  allowed: EntityType[];
  onPick(t: EntityType | null): void;
}) {
  const tabs = [
    { id: null, label: copy.ui.all, n: total },
    ...allowed
      .filter((t) => groups.some((g) => g.type === t))
      .map((t) => ({ id: t, label: copy.types[t], n: groups.find((g) => g.type === t)?.total ?? 0 })),
  ];
  return (
    <div role="tablist" aria-label={copy.ui.types} className="flex shrink-0 flex-wrap gap-2">
      {tabs.map((t) => (
        <button
          key={t.id ?? 'all'}
          type="button"
          role="tab"
          aria-selected={type === t.id}
          onClick={() => onPick(t.id)}
          className={`min-h-11 cursor-pointer rounded-full border px-4 text-sm font-semibold ${type === t.id ? 'border-brand bg-brand-primary text-brand-secondary' : 'border-primary text-secondary hover:bg-primary_hover'}`}
        >
          {t.label} ({t.n})
        </button>
      ))}
    </div>
  );
}
