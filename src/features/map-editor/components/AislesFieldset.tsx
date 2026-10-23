import { Plus, Trash01 } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { NumberInput } from '@/components/form/NumberInput';
import type { Aisle } from '../model/types';
import { copy } from './approach/copy';

/** The aisles of a staging area: empty strips between two rows (the Deployment Manager's aisle rows). Each has the number of the row it comes after (0 = before the first row) and a width. */
export function AislesFieldset({
  aisles,
  rows,
  disabled,
  error,
  onChange,
}: {
  aisles: Aisle[];
  rows: number;
  disabled: boolean;
  error?: string;
  onChange(next: Aisle[]): void;
}) {
  const t = copy.aisles;
  const sorted = (list: Aisle[]) => [...list].sort((x, y) => x.after - y.after);
  const set = (i: number, patch: Partial<Aisle>) =>
    onChange(sorted(aisles.map((x, j) => (j === i ? { ...x, ...patch } : x))));
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold text-primary">{t.title}</legend>
      <p className="text-xs text-tertiary">{t.hint}</p>
      {aisles.length === 0 && <p className="text-sm text-tertiary">{t.none}</p>}
      {aisles.map((x, i) => (
        <div key={i} className="flex items-end gap-2">
          <NumberInput
            className="flex-1"
            label={t.after}
            integer
            value={x.after}
            disabled={disabled}
            onCommit={(after) => set(i, { after })}
          />
          <NumberInput
            className="flex-1"
            label={t.width}
            value={x.length}
            disabled={disabled}
            onCommit={(length) => set(i, { length })}
          />
          <Button
            size="md"
            color="tertiary"
            aria-label={t.remove}
            iconLeading={Trash01}
            isDisabled={disabled}
            onPress={() => onChange(aisles.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {error && <p className="text-xs text-error-primary">{error}</p>}
      <Button
        size="sm"
        color="secondary"
        iconLeading={Plus}
        isDisabled={disabled}
        onPress={() =>
          onChange(
            sorted([...aisles, { after: Math.min(rows, Math.max(0, ...aisles.map((x) => x.after))), length: 1 }]),
          )
        }
      >
        {t.add}
      </Button>
    </fieldset>
  );
}
