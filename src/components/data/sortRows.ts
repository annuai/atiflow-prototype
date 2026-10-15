/** Sorting for DataTable (pure, so it is tested): numbers numerically, text naturally ('AMR-2' before 'AMR-10'), empty values always last, stable otherwise. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
type Key = string | number | null | undefined;
const empty = (v: Key) => v === null || v === undefined || v === '';
const compare = (a: Key, b: Key) =>
  typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));

export function sortRows<T>(
  rows: T[],
  columns: { id: string; sort?(row: T): Key }[],
  columnId: string | null,
  direction: 'ascending' | 'descending',
): T[] {
  const col = columns.find((c) => c.id === columnId);
  if (!col?.sort) return rows;
  const by = col.sort,
    dir = direction === 'descending' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = by(a),
      y = by(b);
    if (empty(x) || empty(y)) return empty(x) === empty(y) ? 0 : empty(x) ? 1 : -1;
    return compare(x, y) * dir;
  });
}
