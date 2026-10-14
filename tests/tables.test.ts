import { describe, expect, it } from 'vitest';
import { sortRows } from '../src/components/data/sortRows';

type Row = { id: string; name: string; n: number | null };
const rows: Row[] = [{ id: 'a', name: 'AMR-10', n: 5 }, { id: 'b', name: 'AMR-2', n: null }, { id: 'c', name: 'amr-1', n: 12 }, { id: 'd', name: '', n: 1 }];
const cols = [{ id: 'name', sort: (r: Row) => r.name }, { id: 'n', sort: (r: Row) => r.n }, { id: 'menu' }];
const ids = (r: Row[]) => r.map((x) => x.id).join('');

describe('table sorting', () => {
  it('text sorts naturally and ignoring case, numbers numerically, in both directions', () => {
    expect(ids(sortRows(rows, cols, 'name', 'ascending'))).toBe('cbad'); expect(ids(sortRows(rows, cols, 'name', 'descending'))).toBe('abcd');
    expect(ids(sortRows(rows, cols, 'n', 'ascending'))).toBe('dacb'); expect(ids(sortRows(rows, cols, 'n', 'descending'))).toBe('cadb');
  });
  it('empty values stay last whichever way it sorts; a column without a sort accessor, or no column, leaves the order alone; the input is not changed', () => {
    expect(sortRows(rows, cols, 'n', 'descending').at(-1)!.id).toBe('b'); expect(sortRows(rows, cols, 'menu', 'ascending')).toBe(rows); expect(sortRows(rows, cols, null, 'ascending')).toBe(rows); expect(ids(rows)).toBe('abcd');
  });
});
