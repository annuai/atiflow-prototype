import type { Document, StorageBackend } from '@/data/storage';
import type { DocumentRepository } from '../ports';

/**
 * A `DocumentRepository` over one browser-storage document: the shared way every dummy service keeps its data. `afterLoad` can bring a freshly read value up to date (older shapes).
 * Changes saved by another tab arrive through `subscribe` (the browser's `storage` event).
 */
export function createDocumentRepository<T>(opts: {
  key: string;
  backend: StorageBackend;
  doc: Document<T>;
  afterLoad?: (value: T) => T;
}): DocumentRepository<T> {
  const { key, backend, doc, afterLoad = (v: T) => v } = opts;
  let cache: T | null = null;
  const read = () => (cache = afterLoad(doc.load()));
  return {
    snapshot: () => cache ?? read(),
    hydrate: async () => read(),
    save: async (value) => {
      cache = value;
      doc.save(value);
    },
    subscribe(listener) {
      if (typeof window === 'undefined') return () => {};
      const on = (e: StorageEvent) => {
        if (e.key !== key || !e.newValue) return;
        const r = doc.parse(e.newValue);
        if ('value' in r) listener((cache = afterLoad(r.value)));
      };
      window.addEventListener('storage', on);
      return () => window.removeEventListener('storage', on);
    },
    resetToSeed() {
      backend.remove();
      return (cache = afterLoad(doc.reset()));
    },
  };
}
