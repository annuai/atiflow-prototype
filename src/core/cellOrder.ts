/** An order of the cells of a grid: line by line (a line is a row or a column), lines and cells first-to-last or last-to-first. */
export interface CellSequence {
  by: 'row' | 'column';
  lines: 'asc' | 'desc';
  cells: 'asc' | 'desc';
}
/** The order cells are used in unless the area says otherwise: row by row, first row and first cell first. */
export const DEFAULT_SEQ: CellSequence = { by: 'row', lines: 'asc', cells: 'asc' };
/** The keys ("row-col", 1-based) of all the cells in the order of a sequence. */
export function sequenceKeys(rows: number, cols: number, seq: CellSequence = DEFAULT_SEQ): string[] {
  const lines = seq.by === 'row' ? rows : cols,
    per = seq.by === 'row' ? cols : rows;
  const out: string[] = [];
  for (let i = 0; i < lines; i++)
    for (let j = 0; j < per; j++) {
      const line = (seq.lines === 'asc' ? i : lines - 1 - i) + 1,
        cell = (seq.cells === 'asc' ? j : per - 1 - j) + 1;
      out.push(seq.by === 'row' ? `${line}-${cell}` : `${cell}-${line}`);
    }
  return out;
}
