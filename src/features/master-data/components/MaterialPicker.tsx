import { useMemo, type ReactNode } from 'react';
import { useEndReached } from '@/hooks/use-end-reached';
import { Badge } from '@/components/base/badges/badges';
import { DataTable, type Column } from '@/components/data/DataTable';
import { copy } from '../copy';
import type { RowStatus } from '../import/review';

export interface PickerRow {
  code: string;
  name: string;
  group: string;
  status: RowStatus;
}
const TONE = { available: 'gray', added: 'success', duplicate: 'warning', invalid: 'error' } as const;

interface Props {
  rows: PickerRow[];
  selected: Set<string>;
  onChange(next: Set<string>): void;
  /** Show the Status column (add-more and file review; the first API import has none). */
  showStatus?: boolean;
  /** Asks for more rows when the list is scrolled to its end (server-paged lists). */
  onEnd?(): void;
  /** Shown under the rows (loading more, errors). */
  footer?: ReactNode;
}

/**
 * ONE selectable material list for the three places that pick materials: API import, "add more from API" and the file review step.
 * Rows that are already added are locked and checked; invalid / duplicate rows cannot be selected.
 */
export function MaterialPicker({ rows, selected, onChange, showStatus, onEnd, footer }: Props) {
  const { locked, disabled } = useMemo(
    () => ({
      locked: new Set(rows.filter((r) => r.status === 'added').map((r) => r.code)),
      disabled: new Set(rows.filter((r) => r.status === 'invalid' || r.status === 'duplicate').map((r) => r.code)),
    }),
    [rows],
  );
  const endRef = useEndReached<HTMLDivElement>(onEnd, rows.length);
  const columns: Column<PickerRow>[] = [
    {
      id: 'material',
      sort: (r) => r.name,
      header: copy.picker.material,
      className: 'px-2.5 whitespace-nowrap',
      cell: (r) => <span className="font-medium text-primary">{r.name || '—'}</span>,
    },
    {
      id: 'code',
      sort: (r) => r.code,
      header: copy.picker.code,
      className: 'px-2.5',
      cell: (r) => <span className="text-primary">{r.code || '—'}</span>,
    },
    {
      id: 'group',
      sort: (r) => r.group,
      header: copy.picker.group,
      className: 'px-2.5',
      cell: (r) => r.group || copy.materials.noGroup,
    },
    ...(showStatus
      ? [
          {
            id: 'status',
            sort: (r: PickerRow) => r.status,
            header: copy.picker.status,
            className: 'px-2.5',
            cell: (r: PickerRow) => (
              <Badge size="sm" type="pill-color" color={TONE[r.status]}>
                {copy.picker[`status_${r.status}` as const]}
              </Badge>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="max-h-[min(340px,38vh)] overflow-auto rounded-xl border border-secondary">
      <DataTable
        label={copy.picker.material}
        rows={rows}
        rowKey={(r) => r.code || r.name}
        columns={columns}
        selection={{ selected, onChange, locked, disabled }}
        stickyHeader
        progressive={onEnd ? undefined : 40}
      />
      {onEnd && <div ref={endRef} aria-hidden className="h-px" />}
      {footer}
    </div>
  );
}
