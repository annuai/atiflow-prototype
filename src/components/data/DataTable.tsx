import { useMemo, useState, type ReactNode } from 'react';
import { useEndReached } from '@/hooks/use-end-reached';
import type { Selection, SortDescriptor } from 'react-aria-components';
import { Table } from '@/components/application/table/table';
import { cx } from '@/utils/cx';
import { sortRows } from './sortRows';

export interface Column<T> {
  id: string;
  header: string;
  cell(row: T): ReactNode;
  /** Tooltip on a help icon next to the heading. */
  hint?: string;
  /** What to sort this column by. Give it and the heading becomes a sort button (click: ascending, again: descending); leave it out for columns that cannot be sorted (menus). */
  sort?(row: T): string | number | null | undefined;
  /** Classes for the cell / the heading (width, alignment...). */
  className?: string;
  headClassName?: string;
}
interface RowSelection {
  selected: Set<string>;
  onChange(next: Set<string>): void;
  /** Rows shown checked but not changeable (e.g. already added). */
  locked?: Set<string>;
  /** Rows that cannot be selected and are shown unchecked (e.g. invalid). */
  disabled?: Set<string>;
}
interface Props<T> {
  label: string;
  rows: T[];
  rowKey(row: T): string;
  columns: Column<T>[];
  /** Makes rows clickable (keyboard accessible). */
  onRowAction?(row: T): void;
  selection?: RowSelection;
  /** The heading row stays at the top of the scrolling box while the rows scroll under it (default: on; pass `false` for a table that never scrolls). */
  stickyHeader?: boolean;
  minWidth?: number;
  /** No zebra striping and a white heading row (flat tables inside a card). */
  plain?: boolean;
  /** For very long lists: draw this many rows first and more as the list is scrolled (sorting and selection still cover every row). */
  progressive?: number;
}

/**
 * Generic list table (Untitled UI Table): striped rows, optional row action, optional checkbox selection with locked rows.
 * Each row is a `group`, so cells can reveal controls on row hover with `opacity-0 group-hover:opacity-100`.
 * Every column with a `sort` accessor sorts the rows when its heading is clicked (numbers numerically, text naturally, empty values last).
 */
export function DataTable<T>({
  label,
  rows: input,
  rowKey,
  columns,
  onRowAction,
  selection,
  stickyHeader = true,
  minWidth,
  plain,
  progressive,
}: Props<T>) {
  const [sort, setSort] = useState<SortDescriptor | undefined>();
  const rows = useMemo(
    () =>
      sortRows(
        input,
        columns,
        sort?.column ? String(sort.column) : null,
        sort?.direction === 'descending' ? 'descending' : 'ascending',
      ),
    [input, columns, sort],
  );
  const [shown, setShown] = useState({ of: input, n: progressive ?? Infinity });
  const limit = shown.of === input ? shown.n : (progressive ?? Infinity); // a new list starts from the first page again
  const visible = useMemo(() => (limit < rows.length ? rows.slice(0, limit) : rows), [rows, limit]);
  const more = limit < rows.length;
  const endRef = useEndReached<HTMLDivElement>(
    more ? () => setShown({ of: input, n: limit + (progressive ?? 0) }) : undefined,
    `${limit}:${rows.length}`,
  );
  const locked = selection?.locked ?? new Set<string>();
  const disabled = new Set([...locked, ...(selection?.disabled ?? [])]);
  const selectedKeys = selection ? new Set([...selection.selected, ...locked]) : undefined;
  const onSelectionChange = (keys: Selection) => {
    if (!selection) return;
    const next = keys === 'all' ? rows.map(rowKey) : [...keys].map(String);
    selection.onChange(new Set(next.filter((k) => !disabled.has(k))));
  };
  return (
    <>
      <Table
        aria-label={label}
        size="sm"
        wrapperClassName={stickyHeader ? 'overflow-x-visible' : undefined}
        style={minWidth ? { minWidth } : undefined}
        sortDescriptor={sort}
        onSortChange={setSort}
        {...(selection
          ? { selectionMode: 'multiple' as const, selectedKeys, onSelectionChange, disabledKeys: disabled }
          : {})}
      >
        {/* only the heading CELLS are sticky (Safari does not stick a thead, and a sticky thead behind sticky cells left a strip of its own background showing under the heading) */}
        <Table.Header className={cx(plain && 'bg-primary')}>
          {columns.map((c, i) => (
            <Table.Head
              key={c.id}
              id={c.id}
              isRowHeader={i === 0}
              allowsSorting={!!c.sort}
              label={c.header}
              tooltip={c.hint}
              className={cx(
                'px-4', // the same side padding as the cells below, so a heading sits exactly above its column's content
                stickyHeader && 'sticky top-[var(--table-sticky-top,0px)] z-10',
                plain ? 'bg-primary' : stickyHeader && 'bg-secondary',
                c.headClassName,
              )}
            />
          ))}
        </Table.Header>
        <Table.Body>
          {visible.map((r) => (
            <Table.Row
              key={rowKey(r)}
              id={rowKey(r)}
              onAction={onRowAction ? () => onRowAction(r) : undefined}
              className={cx('group h-auto', !plain && 'even:bg-secondary', onRowAction && 'cursor-pointer')}
            >
              {columns.map((c) => (
                <Table.Cell key={c.id} className={cx('px-4 py-3', c.className)}>
                  {c.cell(r)}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {more && <div ref={endRef} aria-hidden className="h-px" />}
    </>
  );
}
