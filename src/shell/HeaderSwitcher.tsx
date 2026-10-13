import { Button as AriaButton } from 'react-aria-components';
import { ChevronDown } from '@untitledui/icons';
import { Dropdown } from '@/components/base/dropdown/dropdown';

export interface SwitcherItem { id: string; label: string; /** Small text on the right (e.g. "Coming soon"). */ hint?: string; disabled?: boolean }

/**
 * The title block at the top of the sidebar, as a dropdown when there is more than one thing to switch between. Generic: it knows nothing about workspaces, roles or routes,
 * so any list (workspaces today, sites or tenants later) can use it. With a single item it is a plain title.
 */
export function HeaderSwitcher({ title, items, value, onChange }: { title: string; items: SwitcherItem[]; value: string | null; onChange(id: string): void }) {
  if (items.length < 2) return <div className="sb-head">{title}</div>;
  return (
    <Dropdown.Root>
      <AriaButton className="sb-head sb-switch" aria-label={`${title}: switch`}>{title}<ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden /></AriaButton>
      <Dropdown.Popover placement="bottom start" className="w-64">
        <Dropdown.Menu selectionMode="single" selectedKeys={value ? [value] : []} disallowEmptySelection onAction={(k) => onChange(String(k))}>
          {items.map((i) => <Dropdown.Item key={i.id} id={i.id} label={i.label} addon={i.hint} isDisabled={i.disabled} />)}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
