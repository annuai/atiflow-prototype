import type { FC } from 'react';
import { Dropdown } from '@/components/base/dropdown/dropdown';

export interface RowMenuItem {
  id: string;
  label: string;
  icon?: FC<{ className?: string }>;
  isDisabled?: boolean;
}
/**
 * The ⋮ menu at the end of a table row. Hidden until the row is hovered or focused (always visible on touch screens and while open),
 * because DataTable rows are `group`s.
 */
export function RowMenu({
  label,
  items,
  onAction,
}: {
  label: string;
  items: RowMenuItem[];
  onAction(id: string): void;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.DotsButton
        aria-label={label}
        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100 [@media(pointer:coarse)]:opacity-100"
      />
      <Dropdown.Popover className="w-48">
        <Dropdown.Menu
          onAction={(k) => onAction(String(k))}
          disabledKeys={items.filter((i) => i.isDisabled).map((i) => i.id)}
        >
          {items.map((i) => (
            <Dropdown.Item key={i.id} id={i.id} icon={i.icon} label={i.label} isDisabled={i.isDisabled} />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
