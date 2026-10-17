import { Radio, RadioGroup } from 'react-aria-components';
import { Label } from '@/components/base/input/label';
import { cx } from '@/utils/cx';
import { ROUTING_VERSIONS } from '../model/routing';

/** The map version choice (v2 / v4 / v5), the same in the Generate and Import dialogs. */
export function RoutingVersionPicker({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label isRequired>{label}</Label>
      <RadioGroup aria-label={label} value={value} onChange={onChange} className="flex flex-col gap-3">
        {ROUTING_VERSIONS.map((r) => (
          <Radio
            key={r.id}
            value={r.id}
            className={({ isSelected, isFocusVisible }) =>
              cx(
                'flex cursor-pointer items-start gap-3 rounded-xl border bg-primary p-4 outline-focus-ring transition',
                isSelected ? 'border-brand ring-2 ring-brand' : 'border-secondary hover:bg-primary_hover',
                isFocusVisible && 'outline-2 outline-offset-2',
              )
            }
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-primary text-fg-secondary shadow-xs">
              <r.icon className="size-4" />
            </span>
            <span className="text-sm">
              <span className="block text-secondary">
                <b className="font-semibold text-primary">{r.label}</b> {r.name}
              </span>
              <span className="block text-tertiary">{r.note}</span>
            </span>
          </Radio>
        ))}
      </RadioGroup>
      {hint && <p className="text-xs text-tertiary">{hint}</p>}
      {error && (
        <p className="text-sm text-error-primary" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
