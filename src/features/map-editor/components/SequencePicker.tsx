import { Select } from '@/components/base/select/select';
import { copy } from '../copy';
import type { CellSequence } from '../model/types';

/** The three choices that make an order of cells: row by row or column by column, which row (column) comes first, and which cell of it. */
export function SequencePicker({
  value,
  onChange,
  disabled,
}: {
  value: CellSequence;
  onChange(v: CellSequence): void;
  disabled?: boolean;
}) {
  const f = copy.staging.form;
  const rows = value.by === 'row';
  const pick = <T extends string>(
    label: string,
    key: T,
    items: { id: string; label: string }[],
    set: (k: string) => void,
  ) => (
    <Select
      size="sm"
      label={label}
      isDisabled={disabled}
      selectedKey={key}
      onSelectionChange={(k) => set(String(k))}
      items={items}
    >
      {(item) => <Select.Item {...item} />}
    </Select>
  );
  return (
    <div className="flex flex-col gap-3">
      {pick(
        f.fillBy,
        value.by,
        [
          { id: 'row', label: f.rowByRow },
          { id: 'column', label: f.colByCol },
        ],
        (k) => onChange({ ...value, by: k === 'column' ? 'column' : 'row' }),
      )}
      {pick(
        f.startFrom,
        value.lines,
        [
          { id: 'asc', label: rows ? f.firstRow : f.firstCol },
          { id: 'desc', label: rows ? f.lastRow : f.lastCol },
        ],
        (k) => onChange({ ...value, lines: k === 'desc' ? 'desc' : 'asc' }),
      )}
      {pick(
        rows ? f.eachRow : f.eachCol,
        value.cells,
        [
          { id: 'asc', label: f.firstCell },
          { id: 'desc', label: f.lastCell },
        ],
        (k) => onChange({ ...value, cells: k === 'desc' ? 'desc' : 'asc' }),
      )}
    </div>
  );
}
