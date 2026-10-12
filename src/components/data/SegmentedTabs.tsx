import { ButtonGroup, ButtonGroupItem } from '@/components/base/button-group/button-group';

/** Segmented switch ("Materials | Station Groups"): the button group used to switch between lists inside a panel (Master Data and the fleet page). */
export function SegmentedTabs<T extends string>({ value, onChange, items, label }: { value: T; onChange(v: T): void; items: { id: T; label: string }[]; label: string }) {
  return (
    <ButtonGroup size="sm" aria-label={label} selectedKeys={[value]} disallowEmptySelection onSelectionChange={(k) => { const id = [...k][0]; if (id) onChange(id as T); }}>
      {items.map((i) => <ButtonGroupItem key={i.id} id={i.id}>{i.label}</ButtonGroupItem>)}
    </ButtonGroup>
  );
}
