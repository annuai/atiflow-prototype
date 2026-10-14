import { useEffect } from 'react';
import { useListData } from 'react-stately';
import { TagSelect } from '@/components/base/select/tag-select';
import type { SelectItemType } from '@/components/base/select/select-shared';

export interface TagOption { id: string; label: string; /** shown on the tag instead of an avatar */ icon?: SelectItemType['icon'] }
interface Props {
  label: string; options: TagOption[];
  /** The selected option ids (controlled). */
  value: string[]; onChange(ids: string[]): void;
  placeholder?: string; hint?: string; error?: string; required?: boolean; disabled?: boolean;
}

/**
 * A search box whose picks become tags with a close button (Untitled UI `TagSelect`), controlled by a plain list of ids: the form keeps `value`, this keeps the
 * widget in step. Use it for any "pick several from many" field, so a long list never crowds the form.
 */
export function TagMultiSelect({ label, options, value, onChange, placeholder = 'Search', hint, error, required, disabled }: Props) {
  const selected = useListData<SelectItemType>({ initialItems: options.filter((o) => value.includes(o.id)) });
  // the form changed the value (another user opened, fields reset): bring the tags in step; picks and removals made here already updated `value` through onChange
  useEffect(() => {
    const have = selected.items.map((i) => String(i.id));
    have.filter((id) => !value.includes(id)).forEach((id) => selected.remove(id));
    options.filter((o) => value.includes(o.id) && !have.includes(o.id)).forEach((o) => selected.append(o));
    options.forEach((o) => { const cur = selected.getItem(o.id); if (cur && (cur.label !== o.label || cur.icon !== o.icon)) selected.update(o.id, o); });          // names that arrive later (a map that was still loading)
  }, [value.join('|'), options.map((o) => o.id + o.label).join('|')]);          // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <TagSelect label={label} size="md" placeholder={placeholder} items={options} selectedItems={selected} isRequired={required} isDisabled={disabled} isInvalid={!!error} hint={error ?? hint}
      onItemInserted={(key) => { const id = String(key); if (!value.includes(id)) onChange([...value, id]); }} onItemCleared={(key) => onChange(value.filter((v) => v !== String(key)))}>
      {(item) => <TagSelect.Item id={item.id} label={item.label}>{item.label}</TagSelect.Item>}
    </TagSelect>
  );
}
