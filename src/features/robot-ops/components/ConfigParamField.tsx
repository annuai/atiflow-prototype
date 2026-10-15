import { Input } from '@/components/base/input/input';
import { Select } from '@/components/base/select/select';
import { Toggle } from '@/components/base/toggle/toggle';
import { Label } from '@/components/base/input/label';
import type { ConfigParam, ConfigValue } from '../model/types';

/** One configuration parameter as a control: a number box, a switch or a choice. Disabled (dimmed) until the configuration is being edited. */
export function ConfigParamField({
  param,
  value,
  error,
  disabled,
  onChange,
}: {
  param: ConfigParam;
  value: ConfigValue;
  error?: string;
  disabled: boolean;
  onChange(v: ConfigValue): void;
}) {
  const label = param.kind === 'number' && param.unit ? `${param.label} (${param.unit})` : param.label;
  if (param.kind === 'toggle')
    return (
      <Toggle
        size="md"
        label={label}
        hint={param.help}
        isDisabled={disabled}
        isSelected={value === true}
        onChange={onChange}
      />
    );
  if (param.kind === 'choice')
    return (
      <div className="flex flex-col gap-1.5">
        <Label tooltip={param.help}>{label}</Label>
        <Select
          aria-label={label}
          isDisabled={disabled}
          selectedKey={String(value)}
          items={param.options.map((o) => ({ id: o, label: o }))}
          onSelectionChange={(k) => onChange(String(k))}
        >
          {(item) => <Select.Item {...item} />}
        </Select>
      </div>
    );
  return (
    <Input
      label={label}
      tooltip={param.help ?? param.key}
      inputMode="decimal"
      value={String(value)}
      isDisabled={disabled}
      isInvalid={!!error}
      hint={error}
      onChange={(t) => onChange(t)}
    />
  );
}
