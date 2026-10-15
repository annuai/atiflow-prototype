/**
 * Undo and redo of the draft (pure): `record` keeps the data as it was before a change; `undo` / `redo` swap the current data with the last kept one. Changes with the same `key` that come
 * quickly one after the other (dragging a station sends one change per mouse move) count as ONE step. Kept in memory only, per open draft, 100 steps.
 */
export interface History<T> {
  past: T[];
  future: T[];
  key?: string;
  at: number;
}
export const MAX_STEPS = 100,
  COALESCE_MS = 700;
export const emptyHistory = <T>(): History<T> => ({ past: [], future: [], at: 0 });

export function record<T>(h: History<T>, before: T, key: string | undefined, now: number): History<T> {
  const merge = key !== undefined && key === h.key && now - h.at < COALESCE_MS && h.past.length > 0;
  return { past: merge ? h.past : [...h.past, before].slice(-MAX_STEPS), future: [], key, at: now };
}
export function undo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (!h.past.length) return null;
  const value = h.past[h.past.length - 1];
  return { value, history: { past: h.past.slice(0, -1), future: [current, ...h.future], at: 0 } };
}
export function redo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  if (!h.future.length) return null;
  const [value, ...rest] = h.future;
  return { value, history: { past: [...h.past, current], future: rest, at: 0 } };
}
