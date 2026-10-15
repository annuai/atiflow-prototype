import type { CellState, StagingArea } from './types';

export const cellKey = (row: number, col: number) => `${row}-${col}`;
export const countState = (a: StagingArea, s: CellState) => Object.values(a.cells).filter((c) => c === s).length;
export const totalCells = (a: StagingArea) => a.rows * a.cols;
/** Utilised cells = cells holding something. */
export const utilised = (a: StagingArea) => countState(a, 'filled');

/** Small deterministic PRNG so seeded areas look the same on every load. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export interface AreaSpec {
  name: string;
  rows: number;
  cols: number;
  filled: number;
  reserved: number;
  blocked: number;
}
/** Build an area with the requested number of cells in each state, spread pseudo-randomly. */
export function buildArea(id: string, spec: AreaSpec, seed: number): StagingArea {
  const rand = rng(seed);
  const keys: string[] = [];
  for (let r = 1; r <= spec.rows; r++) for (let c = 1; c <= spec.cols; c++) keys.push(cellKey(r, c));
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const cells: Record<string, CellState> = {};
  let k = 0;
  (['filled', 'reserved', 'blocked'] as const).forEach((s) => {
    for (let i = 0; i < spec[s]; i++) cells[keys[k++]] = s;
  });
  return { id, name: spec.name, rows: spec.rows, cols: spec.cols, cells };
}

/** Manage mode: only Available <-> Blocked can be changed by hand; Reserved and Filled belong to workflows. */
export function toggleBlocked(a: StagingArea, row: number, col: number): StagingArea {
  const k = cellKey(row, col);
  const cur = a.cells[k] ?? 'available';
  if (cur !== 'available' && cur !== 'blocked') return a;
  const cells = { ...a.cells };
  if (cur === 'blocked') delete cells[k];
  else cells[k] = 'blocked';
  return { ...a, cells };
}
