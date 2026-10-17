import { Tabs } from '@/components/application/tabs/tabs';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { copy } from '../copy';
import type { EntityType, SearchGroup } from '../types';

const ALL = '__all';
/** The type tabs of the results page (Untitled UI Tabs, button style): All and each type that has results, with its count. */
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
  const wide = useBreakpoint('md'); // the tab's own count badge shows from md up; on a phone the count goes into the label
  const tabs = [
    { id: ALL, label: copy.ui.all, n: total },
    ...allowed
      .filter((t) => groups.some((g) => g.type === t))
      .map((t) => ({ id: t as string, label: copy.types[t], n: groups.find((g) => g.type === t)?.total ?? 0 })),
  ].map((t) => (wide ? { id: t.id, label: t.label, badge: t.n } : { id: t.id, label: `${t.label} (${t.n})` }));
  return (
    <Tabs
      selectedKey={type ?? ALL}
      onSelectionChange={(k) => onPick(k === ALL ? null : (String(k) as EntityType))}
      className="shrink-0"
    >
      <Tabs.List type="button-brand" size="md" aria-label={copy.ui.types} items={tabs} className="flex-wrap" />
    </Tabs>
  );
}
