import { Badge } from '@/components/base/badges/badges';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input } from '@/components/base/input/input';
import { Label } from '@/components/base/input/label';
import { Select } from '@/components/base/select/select';
import { cx } from '@/utils/cx';
import type { FieldDef, FieldValue } from './types';

const UNASSIGNED = 'Unassigned';
interface Props {
  def: FieldDef;
  label?: string;
  value: FieldValue;
  onChange(v: FieldValue): void;
  /** Disabled controls look dimmed (detail page, not editing). */
  disabled?: boolean;
  error?: string;
  fleets: string[];
  /** How a disabled value is shown: plain input, one badge or a row of badges. */
  display?: 'text' | 'badge' | 'badges';
  showTag?: boolean;
}

/** Dimmed, input-shaped box holding badges (detail page: "Type of Robot", "Hardware Add-ons"). */
const BadgeBox = ({ items }: { items: string[] }) => (
  <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg bg-primary px-3 py-2 opacity-50 shadow-xs ring-1 ring-primary ring-inset">
    {items.length ? (
      items.map((i) => (
        <Badge key={i} size="md" type="pill-color" color="gray">
          {i}
        </Badge>
      ))
    ) : (
      <span className="text-sm text-placeholder">None</span>
    )}
  </div>
);

/**
 * One form field, rendered from its FieldDef. Add dialogs, detail pages and edit dialogs use this same component, so an input looks
 * and behaves identically everywhere (label + teal required star, optional tag, error text, dimmed when disabled).
 */
export function FormField({
  def,
  label = def.label,
  value,
  onChange,
  disabled,
  error,
  fleets,
  display = 'text',
  showTag,
}: Props) {
  const text = Array.isArray(value) ? value.join(', ') : value;
  let control;
  if (disabled && display !== 'text')
    control = <BadgeBox items={Array.isArray(value) ? value : value ? [value] : []} />;
  else if (def.control === 'select' || def.control === 'fleet') {
    const opts = def.control === 'fleet' ? [UNASSIGNED, ...fleets] : (def.options ?? []);
    control = (
      <Select
        aria-label={label}
        isDisabled={disabled}
        selectedKey={def.control === 'fleet' && !value ? UNASSIGNED : String(value)}
        items={opts.map((o) => ({ id: o, label: o }))}
        onSelectionChange={(k) => onChange(def.control === 'fleet' && k === UNASSIGNED ? '' : String(k))}
      >
        {(item) => <Select.Item {...item} />}
      </Select>
    );
  } else if (def.control === 'checks') {
    const sel = Array.isArray(value) ? value : [];
    control = (
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {(def.options ?? []).map((o) => (
          <Checkbox
            key={o}
            size="sm"
            label={o}
            isDisabled={disabled}
            isSelected={sel.includes(o)}
            onChange={(on) => onChange(on ? [...sel, o] : sel.filter((x) => x !== o))}
          />
        ))}
      </div>
    );
  } else {
    control = (
      <Input
        aria-label={label}
        type={def.control === 'secret' && !disabled ? 'password' : 'text'}
        placeholder={def.placeholder}
        isDisabled={disabled}
        isInvalid={!!error}
        value={text}
        onChange={onChange}
      />
    );
  }
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5')} data-field={def.key}>
      <div className="flex items-center justify-between gap-2">
        <Label isRequired={!disabled && def.required} className={disabled ? 'text-tertiary' : undefined}>
          {label}
        </Label>
        {showTag && def.tag && (
          <Badge size="sm" type="pill-color" color="brand">
            {def.tag}
          </Badge>
        )}
      </div>
      {control}
      {error && (
        <p className="text-sm text-error-primary" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
