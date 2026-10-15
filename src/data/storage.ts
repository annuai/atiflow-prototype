import type { z } from 'zod';

/**
 * Editable storage for one JSON document. The app's shared data lives in one such document (see `dataset.ts`).
 * Today the backend is the browser's localStorage; a server later means writing another `StorageBackend` (or making it async) and nothing else changes.
 */
export interface StorageBackend {
  read(): string | null;
  write(text: string): void;
  remove(): void;
}

/** Browser storage under one key. Quietly does nothing where storage is unavailable (tests, private mode). */
export const localBackend = (key: string): StorageBackend => ({
  read() { try { return localStorage.getItem(key); } catch { return null; } },
  write(text) { try { localStorage.setItem(key, text); } catch { /* no storage */ } },
  remove() { try { localStorage.removeItem(key); } catch { /* no storage */ } },
});

export interface Document<T> {
  /** The saved document, or the seed when nothing valid is saved. */
  load(): T;
  save(value: T): void;
  /** Forget everything saved and return the seed. */
  reset(): T;
  /** The document as JSON text (for backup or editing by hand). */
  exportText(value: T): string;
  /** Parse text; returns the document, or an error message. */
  parse(text: string): { value: T } | { error: string };
}

export function createDocument<T>(backend: StorageBackend, seed: () => T, valid: (v: unknown) => v is T): Document<T> {
  const parse = (text: string): { value: T } | { error: string } => {
    try { const v: unknown = JSON.parse(text); return valid(v) ? { value: v } : { error: 'The JSON does not have the shape of the dataset.' }; } catch { return { error: 'This is not valid JSON.' }; }
  };
  return {
    load() { const raw = backend.read(); const r = raw ? parse(raw) : null; return r && 'value' in r ? r.value : seed(); },
    save: (value) => backend.write(JSON.stringify(value)),
    reset() { backend.remove(); return seed(); },
    exportText: (value) => JSON.stringify(value, null, 2),
    parse,
  };
}

/**
 * A document checked against a schema (zod) every time it is read. Replaces the hand-written "is this the right shape" guards and per-store upgrade code:
 *  - valid saved data is used as is;
 *  - data that does not match is given to `migrate` (older shapes), and used if the result matches;
 *  - anything else is reported and the seed is used, WITHOUT erasing what was saved (it is only replaced by the next save), so a bad document never crashes a page.
 */
export function createValidatedDocument<S extends z.ZodType>(opts: {
  backend: StorageBackend; schema: S; seed: () => z.infer<S>; /** turn an older or damaged shape into the current one (return anything; it is validated again) */ migrate?: (raw: unknown) => unknown;
  /** told when saved data was unusable (for logging) */ onInvalid?: (reason: string) => void;
}): Document<z.infer<S>> {
  type T = z.infer<S>; const { backend, schema, seed, migrate, onInvalid } = opts;
  const describe = (e: z.ZodError) => e.issues.slice(0, 3).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  const check = (raw: unknown): { value: T } | { error: string } => {
    const first = schema.safeParse(raw); if (first.success) return { value: first.data };
    if (migrate) { try { const second = schema.safeParse(migrate(raw)); if (second.success) return { value: second.data }; } catch { /* fall through to the error */ } }
    return { error: describe(first.error) };
  };
  const parse = (text: string): { value: T } | { error: string } => { try { return check(JSON.parse(text)); } catch { return { error: 'This is not valid JSON.' }; } };
  return {
    load() { const raw = backend.read(); if (!raw) return seed(); const r = parse(raw); if ('value' in r) return r.value; onInvalid?.(r.error); return seed(); },
    save: (value) => backend.write(JSON.stringify(value)),
    reset() { backend.remove(); return seed(); },
    exportText: (value) => JSON.stringify(value, null, 2),
    parse,
  };
}
