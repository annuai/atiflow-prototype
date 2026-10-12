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
