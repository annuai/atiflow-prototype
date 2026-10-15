import { useState, type ReactNode } from 'react';
import { ChevronRight, SearchLg } from '@untitledui/icons';
import { Input } from '@/components/base/input/input';
import { NoResults } from '@/components/data/EmptyState';
import { cx } from '@/utils/cx';

export interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  dot?: string;
  icon?: ReactNode;
}
/** The search box and list every module panel has (Figma: search, then one row per station / road / zone with a chevron). `controls` sit above the search. */
export function ModuleList({
  controls,
  items,
  selectedId,
  onSelect,
  searchPlaceholder,
  empty,
  noMatch,
  label,
}: {
  controls?: ReactNode;
  items: ListItem[];
  selectedId: string | null;
  onSelect(id: string): void;
  searchPlaceholder: string;
  empty: ReactNode;
  noMatch(q: string): string;
  label: string;
}) {
  const [q, setQ] = useState('');
  const shown = items.filter((i) => `${i.title} ${i.subtitle ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 p-3">
        {controls}
        <Input
          size="sm"
          icon={SearchLg}
          aria-label={searchPlaceholder}
          placeholder={searchPlaceholder}
          value={q}
          onChange={setQ}
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto border-t border-secondary" aria-label={label}>
        {shown.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onSelect(i.id)}
              className={cx(
                'flex w-full items-center justify-between gap-3 border-b border-secondary px-4 py-3 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2',
                i.id === selectedId && 'bg-brand-primary',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                {i.icon ?? (i.dot && <i className="size-2 shrink-0 rounded-full" style={{ background: i.dot }} />)}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-primary">{i.title}</span>
                  {i.subtitle && <span className="block truncate text-xs text-tertiary">{i.subtitle}</span>}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-fg-quaternary" />
            </button>
          </li>
        ))}
        {!shown.length && <li>{items.length ? <NoResults size="sm" subtext={noMatch(q)} /> : empty}</li>}
      </ul>
    </div>
  );
}
