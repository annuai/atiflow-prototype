import { FormField } from '@/components/form/FormField';
import type { FieldDef } from '@/components/form/types';

/** Stack of fields for a small dialog form (material, group). Disabled keys render dimmed (e.g. the code while editing). */
export function FieldStack({
  fields,
  values,
  errors,
  onChange,
  disabled = [],
}: {
  fields: FieldDef[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange(key: string, value: string): void;
  disabled?: string[];
}) {
  return (
    <div className="flex flex-col gap-5 pt-2">
      {fields.map((f) => (
        <FormField
          key={f.key}
          def={f}
          value={values[f.key] ?? ''}
          error={errors[f.key]}
          disabled={disabled.includes(f.key)}
          fleets={[]}
          onChange={(v) => onChange(f.key, String(v))}
        />
      ))}
    </div>
  );
}
