import type { z } from 'zod';
import { localBackend, type StorageBackend } from '@/data/storage';
import { log } from '@/platform';
import type { SavedState } from '../ports';

/**
 * A `SavedState` over one browser-storage document, checked with a schema when read. Data that does not match is logged and ignored (the store starts from its fixtures) but NOT erased,
 * so a bug never destroys what a person saved. `backend` is a function from key to storage, so tests can pass an in-memory one.
 */
export function createSavedState<S extends z.ZodType>(opts: {
  key: string;
  schema: S;
  /** the starting data of the dummy, returned while nothing valid is stored */
  seed: () => z.infer<S>;
  backend?: (key: string) => StorageBackend;
}): SavedState<z.infer<S>> {
  type T = z.infer<S>;
  const { key, schema, seed, backend = localBackend } = opts;
  const b = backend(key);
  const parse = (text: string): T | null => {
    try {
      const r = schema.safeParse(JSON.parse(text));
      if (r.success) return r.data;
      log
        .child('saved-state')
        .warn(`saved ${key} ignored: ${r.error.issues[0]?.path.join('.') || '(root)'}: ${r.error.issues[0]?.message}`);
    } catch {
      log.child('saved-state').warn(`saved ${key} ignored: not valid JSON`);
    }
    return null;
  };
  const read = (): T => {
    const raw = b.read();
    return (raw ? parse(raw) : null) ?? seed();
  };
  return {
    read,
    hydrate: async () => read(),
    save: async (value) => b.write(JSON.stringify(value)),
    subscribe(listener) {
      if (typeof window === 'undefined') return () => {};
      const on = (e: StorageEvent) => {
        if (e.key !== key || !e.newValue) return;
        const v = parse(e.newValue);
        if (v !== null) listener(v);
      };
      window.addEventListener('storage', on);
      return () => window.removeEventListener('storage', on);
    },
    clear: () => b.remove(),
  };
}
