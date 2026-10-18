import type { CellLogEntry, CellSnapshot, CellState, Retrieval, StagingArea, StagingCell } from './types';

/** Pure rules of the cells of a staging area: what a cell may hold, the allowed changes, the FIFO / LIFO order, and the upgrade of data saved before cells held materials. No React, no storage. */
export const LOG_LIMIT = 500;
export const cellKey = (row: number, col: number) => `${row}-${col}`;
export const parseKey = (key: string): [number, number] => {
  const [r, c] = key.split('-').map(Number);
  return [r, c];
};
const byPosition = (a: string, b: string) => {
  const [ar, ac] = parseKey(a),
    [br, bc] = parseKey(b);
  return ar - br || ac - bc;
};
export const stateOf = (c?: StagingCell): CellState => c?.state ?? 'available';
export const snapshotOf = (c?: StagingCell): CellSnapshot =>
  c ? { state: c.state, materialCode: c.materialCode, quantity: c.quantity } : { state: 'available' };

/** What a person asks for in the editor. Reserved is not an edit: only a request reserves, a person can only release. */
export type CellEdit =
  | { state: 'available' }
  | { state: 'filled'; materialCode: string; quantity?: number }
  | { state: 'blocked'; reason?: string };
export type CellError = 'material-required' | 'unknown-material' | 'not-assigned' | 'bad-quantity' | 'reserved';
export interface EditContext {
  /** every code in Master Data */
  known: ReadonlySet<string>;
  /** the codes this area's fleet may hold (null = do not check) */
  allowed?: ReadonlySet<string> | null;
}
export type Applied =
  { ok: true; cells: Record<string, StagingCell>; log: CellLogEntry[] } | { ok: false; error: CellError; key: string };

export const validQuantity = (q: number | undefined) => q === undefined || (Number.isInteger(q) && q >= 1);

/** What is wrong with an edit before any cell is looked at (null = nothing). */
function checkEdit(edit: CellEdit, ctx: EditContext): CellError | null {
  if (edit.state !== 'filled') return null;
  if (!edit.materialCode) return 'material-required';
  if (!ctx.known.has(edit.materialCode)) return 'unknown-material';
  if (ctx.allowed && !ctx.allowed.has(edit.materialCode)) return 'not-assigned';
  return validQuantity(edit.quantity) ? null : 'bad-quantity';
}

/**
 * Apply one edit to some cells. All or nothing: the first problem is returned and nothing changes. Cells that already look like the edit are left alone (no log entry).
 * A reserved cell cannot be edited (release it first). Putting material in keeps `storedAt` while the material stays the same (quantity edits do not restart FIFO / LIFO).
 */
export function applyEdit(
  cells: Record<string, StagingCell>,
  keys: string[],
  edit: CellEdit,
  by: string,
  now: number,
  ctx: EditContext,
): Applied {
  const problem = checkEdit(edit, ctx);
  if (problem) return { ok: false, error: problem, key: keys[0] ?? '' };
  const next = { ...cells };
  const log: CellLogEntry[] = [];
  for (const key of keys) {
    const cur = cells[key];
    if (cur?.state === 'reserved') return { ok: false, error: 'reserved', key };
    let made: StagingCell | undefined;
    if (edit.state === 'filled')
      made = {
        state: 'filled',
        materialCode: edit.materialCode,
        quantity: edit.quantity,
        storedAt: cur?.state === 'filled' && cur.materialCode === edit.materialCode ? (cur.storedAt ?? now) : now,
        updatedAt: now,
        updatedBy: by,
      };
    else if (edit.state === 'blocked')
      made = { state: 'blocked', reason: edit.reason?.trim() || undefined, updatedAt: now, updatedBy: by };
    const before = snapshotOf(cur),
      after = snapshotOf(made);
    const same =
      before.state === after.state &&
      before.materialCode === after.materialCode &&
      before.quantity === after.quantity &&
      (edit.state !== 'blocked' || (cur?.reason ?? undefined) === made?.reason);
    if (same) continue;
    if (made) next[key] = made;
    else delete next[key];
    log.push({ at: now, by, key, from: before, to: after });
  }
  return { ok: true, cells: next, log };
}

/** A person lets go of a reservation (a request that is stuck or gone). */
export function releaseCells(cells: Record<string, StagingCell>, keys: string[], by: string, now: number): Applied {
  const next = { ...cells };
  const log: CellLogEntry[] = [];
  for (const key of keys) {
    const cur = cells[key];
    if (cur?.state !== 'reserved') continue;
    delete next[key];
    log.push({ at: now, by, key, from: snapshotOf(cur), to: { state: 'available' }, ref: cur.reservedFor });
  }
  return { ok: true, cells: next, log };
}

/** New entries first, capped. */
export const pushLog = (old: CellLogEntry[] | undefined, add: CellLogEntry[]) =>
  [...add, ...(old ?? [])].slice(0, LOG_LIMIT);

// ---- reading cells

export const cellsHolding = (a: Pick<StagingArea, 'cells'>, code: string, states: CellState[] = ['filled']) =>
  Object.entries(a.cells)
    .filter(([, c]) => c.materialCode === code && states.includes(c.state))
    .map(([k]) => k)
    .sort(byPosition);
/** Pieces of each material that can be taken (filled cells; a cell without a quantity counts as 1). */
export function stockOf(a: Pick<StagingArea, 'cells'>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of Object.values(a.cells))
    if (c.state === 'filled' && c.materialCode) out[c.materialCode] = (out[c.materialCode] ?? 0) + (c.quantity ?? 1);
  return out;
}
/** Codes that sit in cells but are no longer in Master Data. */
export const unknownCodes = (a: Pick<StagingArea, 'cells'>, known: ReadonlySet<string>) => [
  ...new Set(
    Object.values(a.cells).flatMap((c) => (c.materialCode && !known.has(c.materialCode) ? [c.materialCode] : [])),
  ),
];

// ---- FIFO / LIFO

export const retrievalOf = (a: Pick<StagingArea, 'retrieval'>): Retrieval => a.retrieval ?? 'fifo';
/**
 * The cells holding a material in the order the area gives them out: FIFO = stored longest ago first, LIFO = stored most recently first; cells stored at the same moment (or with no time
 * at all: older data) go in row, then column order. The area's setting always decides: nobody picks a cell by hand.
 */
export function pickOrder(a: Pick<StagingArea, 'cells' | 'retrieval'>, code: string): string[] {
  const dir = retrievalOf(a) === 'fifo' ? 1 : -1;
  return cellsHolding(a, code).sort(
    (x, y) => dir * ((a.cells[x].storedAt ?? 0) - (a.cells[y].storedAt ?? 0)) || byPosition(x, y),
  );
}
/** The cells (in pick order) that together cover `qty` pieces, or null when the area does not have that many. A cell is taken whole. */
export function chooseCells(a: Pick<StagingArea, 'cells' | 'retrieval'>, code: string, qty: number): string[] | null {
  const picked: string[] = [];
  let have = 0;
  for (const k of pickOrder(a, code)) {
    if (have >= qty) break;
    picked.push(k);
    have += a.cells[k].quantity ?? 1;
  }
  return have >= qty ? picked : null;
}
/** Free cells in the order they are used when material is put away: row by row. */
export function freeCells(a: Pick<StagingArea, 'cells' | 'rows' | 'cols'>): string[] {
  const out: string[] = [];
  for (let r = 1; r <= a.rows; r++)
    for (let c = 1; c <= a.cols; c++) if (!a.cells[cellKey(r, c)]) out.push(cellKey(r, c));
  return out;
}

// ---- upgrade of saved data

type Saved = Record<string, StagingCell | CellState>;
/** Data saved before cells held materials stored just a state per cell: it becomes a cell without a material (shown as "Material not set"). */
export function normaliseCells(raw: Saved | undefined): Record<string, StagingCell> {
  const out: Record<string, StagingCell> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (typeof v === 'string') {
      if (v !== 'available') out[k] = { state: v, updatedAt: 0, updatedBy: 'system' };
    } else if (v && v.state !== ('available' as string)) out[k] = v;
  }
  return out;
}
export const normaliseAreas = (areas: (Omit<StagingArea, 'cells'> & { cells: Saved })[]): StagingArea[] =>
  areas.map((a) => ({ ...a, cells: normaliseCells(a.cells) }));
