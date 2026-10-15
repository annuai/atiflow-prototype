import { useMemo } from 'react';
import { classifyRows } from '../import/review';
import type { IncomingMaterial } from '../model/types';
import { useMasterData } from '../model/store';
import { MaterialPicker } from './MaterialPicker';

interface Props {
  rows: IncomingMaterial[];
  selected: Set<string>;
  onSelect(next: Set<string>): void;
}
/** Parsed file rows with their status; only importable rows can be (de)selected. */
export function ReviewStep({ rows, selected, onSelect }: Props) {
  const existing = useMasterData((s) => s.materials);
  const review = useMemo(
    () =>
      classifyRows(
        rows,
        existing.map((m) => m.code),
      ),
    [rows, existing],
  );
  return (
    <div className="pt-2">
      <MaterialPicker
        rows={review.map((r) => ({ code: r.code, name: r.name, group: r.groupName ?? '', status: r.status }))}
        selected={selected}
        onChange={onSelect}
        showStatus
      />
    </div>
  );
}
