import type { Built, DrawingError, RowStats, Rules, Summary } from '../core/types';

export type Request =
  | { id: number; type: 'open'; name: string; buffer: ArrayBuffer }
  | { id: number; type: 'rows'; blockRules: Rules['blocks']; unit: number }
  | { id: number; type: 'build'; rules: Rules; unit: number };
export type Reply =
  | { id: number; ok: true; result: Summary | RowStats[] | Built }
  | { id: number; ok: false; code: DrawingError['code']; message: string };

/** A request before it gets its number. */
export type Ask = Request extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;
