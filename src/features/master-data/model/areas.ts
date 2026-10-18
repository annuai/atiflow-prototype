import { cellKey } from './cells';
import type { CellState, StagingArea, StagingCell } from './types';

export { cellKey };
export const countState = (a: StagingArea, s: CellState) => Object.values(a.cells).filter((c) => c.state === s).length;
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
/**
 * Build an area with the requested number of cells in each state, spread pseudo-randomly. With `codes` the filled and reserved cells hold those materials (round robin from a seeded
 * order, with quantities and storing times that differ, so FIFO and LIFO give different answers).
 */
export function buildArea(id: string, spec: AreaSpec, seed: number, codes: string[] = [], now = 0): StagingArea {
  const rand = rng(seed);
  const keys: string[] = [];
  for (let r = 1; r <= spec.rows; r++) for (let c = 1; c <= spec.cols; c++) keys.push(cellKey(r, c));
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const cells: Record<string, StagingCell> = {};
  let k = 0;
  (['filled', 'reserved', 'blocked'] as const).forEach((state) => {
    for (let i = 0; i < spec[state]; i++) {
      const code = codes.length && state !== 'blocked' ? codes[Math.floor(rand() * codes.length)] : undefined;
      const age = Math.floor(rand() * 72) * 3_600_000; // up to three days old
      cells[keys[k++]] = {
        state,
        materialCode: code,
        quantity: code ? 1 + Math.floor(rand() * 24) : undefined,
        storedAt: code ? now - age : undefined,
        updatedAt: now,
        updatedBy: 'system',
      };
    }
  });
  return { id, name: spec.name, rows: spec.rows, cols: spec.cols, cells };
}
