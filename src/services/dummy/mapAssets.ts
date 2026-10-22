import { activeProfile } from '@/data/profile';
import type { MapAssetService } from '../ports';

const DB = () => 'atiflow-map-assets' + activeProfile().idbSuffix,
  STORE = 'assets';
type Row = { bytes: Uint8Array; mime: string };

async function sha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB(), 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = f(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
};

/**
 * Map binary files in this browser. IndexedDB holds them (localStorage cannot: 5 MB, text only, blocks the page); where there is no IndexedDB (tests) a plain in-memory table does.
 * The id is the SHA-256 of the bytes, so importing the same picture twice stores it once.
 */
export function createDummyMapAssets(): MapAssetService {
  const memory = new Map<string, Row>();
  const hasIdb = () => typeof indexedDB !== 'undefined';
  return {
    async put(bytes, mime) {
      const id = await sha256(bytes);
      if (hasIdb()) await run('readwrite', (s) => s.put({ bytes, mime } satisfies Row, id));
      else memory.set(id, { bytes, mime });
      return id;
    },
    async get(id) {
      const row = hasIdb() ? await run<Row | undefined>('readonly', (s) => s.get(id)) : memory.get(id);
      return row ?? null;
    },
    async remove(id) {
      if (hasIdb()) await run('readwrite', (s) => s.delete(id));
      else memory.delete(id);
    },
  };
}
