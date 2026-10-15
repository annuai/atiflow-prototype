import type { StorageBackend } from '../../src/data/storage';

/** An in-memory stand-in for browser storage, one store shared by every key: pass `backend` to `createDummyServices` / `createDummyIdentity`. */
export function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const backend = (key: string): StorageBackend => ({
    read: () => data.get(key) ?? null,
    write: (text) => void data.set(key, text),
    remove: () => void data.delete(key),
  });
  return { backend, data };
}
