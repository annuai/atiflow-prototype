import { Unzip, UnzipInflate } from 'fflate';
import { hasNpyHeader, parseNpyHeader } from './npy';
import { ImportError } from './types';

/**
 * A lidar grid read WITHOUT ever holding it whole. Real maps are huge (a 580 x 430 m site at 2 cm is 615 million cells, 99% empty), far more than a browser can inflate into memory, so the
 * `.npz` is inflated as a stream and each chunk is folded straight into a much smaller picture: every `factor` x `factor` block of cells keeps its strongest level (so thin walls survive).
 * Memory stays at the size of the small picture however big the grid is.
 */
export interface PooledGrid {
  /** Rows and columns of the ORIGINAL array (axis 0, axis 1). */
  rows: number;
  cols: number;
  /** Cells per side of one pooled cell (1, 2, 4, 8...). */
  factor: number;
  /** Pooled rows and columns. */
  poolRows: number;
  poolCols: number;
  /** The strongest level of each block, row by row (`poolRows` x `poolCols`). */
  levels: Uint8Array;
  /** The highest level anywhere. */
  max: number;
}

/** Most cells the pooled picture may have (about 16 million: a clear plan of a very large site, light enough for the cleaning and the 3D estimate). */
export const MAX_POOLED_CELLS = 16 * 1024 * 1024;
/** A grid beyond this many cells (2^31) is refused: not a map, or a file made to waste time. */
const MAX_GRID_CELLS = 2 ** 31;

/** The smallest power of two that makes a rows x cols grid fit in `maxCells` after pooling. */
export function poolFactor(rows: number, cols: number, maxCells = MAX_POOLED_CELLS): number {
  let f = 1;
  while (Math.ceil(rows / f) * Math.ceil(cols / f) > maxCells) f *= 2;
  return f;
}

/** Folds one chunk of cells into the pooled picture. `at` = the chunk's first cell as (row, col) in the original array; returns where the next chunk starts. */
function fold(g: PooledGrid, shift: number, chunk: Uint8Array, row: number, col: number): [number, number] {
  let i = 0;
  const n = chunk.length;
  while (i < n && row < g.rows) {
    const run = Math.min(n - i, g.cols - col);
    const base = (row >> shift) * g.poolCols;
    if (shift === 0) g.levels.set(chunk.subarray(i, i + run), base + col);
    else
      for (let k = 0; k < run; k++) {
        const v = chunk[i + k];
        if (v) {
          const o = base + ((col + k) >> shift);
          if (v > g.levels[o]) g.levels[o] = v;
        }
      }
    i += run;
    col += run;
    if (col >= g.cols) {
      col = 0;
      row++;
    }
  }
  return [row, col];
}

/**
 * Streams the first array of an `.npz` (a zip of `.npy` files) into a pooled picture. Returns null when the array is not a two dimensional table of bytes (the caller then reads it the
 * ordinary way). `maxCells` is only lowered by tests.
 */
export function poolNpz(npz: Uint8Array, maxCells = MAX_POOLED_CELLS): PooledGrid | null {
  let grid: PooledGrid | null = null;
  let shift = 0;
  let head: Uint8Array = new Uint8Array(0);
  let row = 0,
    col = 0;
  let found = false,
    unsupported = false,
    failure: unknown = null;

  const onChunk = (chunk: Uint8Array) => {
    if (unsupported || failure) return;
    if (!grid) {
      // the header may arrive in pieces: keep what came until it is whole
      const joined = new Uint8Array(head.length + chunk.length);
      joined.set(head);
      joined.set(chunk, head.length);
      head = joined;
      if (!hasNpyHeader(head)) return;
      const h = parseNpyHeader(head);
      if (h.descr !== '|u1' || h.shape.length !== 2) {
        unsupported = true;
        return;
      }
      const [rows, cols] = h.shape;
      if (rows * cols > MAX_GRID_CELLS) throw new ImportError('npy.tooBig', 'The map grid is too large to open');
      const factor = poolFactor(rows, cols, maxCells);
      shift = Math.log2(factor);
      const poolRows = Math.ceil(rows / factor),
        poolCols = Math.ceil(cols / factor);
      grid = { rows, cols, factor, poolRows, poolCols, levels: new Uint8Array(poolRows * poolCols), max: 0 };
      const rest = head.subarray(h.start);
      head = new Uint8Array(0);
      if (rest.length) [row, col] = fold(grid, shift, rest, row, col);
      return;
    }
    [row, col] = fold(grid, shift, chunk, row, col);
  };

  try {
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (f) => {
      if (found || !f.name.endsWith('.npy')) return;
      found = true;
      f.ondata = (err, chunk) => {
        if (err) failure = err;
        else
          try {
            onChunk(chunk);
          } catch (e) {
            failure = e;
          }
      };
      f.start();
    };
    unzip.push(npz, true);
  } catch (e) {
    failure = failure ?? e;
  }
  if (failure instanceof ImportError) throw failure;
  if (failure) throw new ImportError('grid.invalid', 'The map grid could not be read');
  if (unsupported || !found) return null;
  if (!grid) throw new ImportError('grid.invalid', 'The map grid could not be read');
  const done: PooledGrid = grid;
  if (row < done.rows) throw new ImportError('npy.invalid', 'The array is shorter than its header says');
  for (let i = 0; i < done.levels.length; i++) if (done.levels[i] > done.max) done.max = done.levels[i];
  return done;
}
