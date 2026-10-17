import type { MasterDataDocument, MasterDataService } from '../ports';

const DB = 'atiflow-master-data',
  STORE = 'docs',
  KEY = 'doc',
  CHANNEL = 'atiflow-master-data';

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
async function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = f(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
const valid = (v: unknown): v is MasterDataDocument => {
  const d = v as Partial<MasterDataDocument> | undefined;
  return !!d && Array.isArray(d.materials) && Array.isArray(d.groups) && Array.isArray(d.areas);
};

/**
 * Master data kept in IndexedDB instead of localStorage: a full ERP import is tens of thousands of materials, which is more than localStorage's 5 MB and would block the page
 * while it is serialised. `fallback` (the localStorage adapter) supplies the starting data: what an earlier version saved there, or the fixtures. Once the document is written to
 * IndexedDB the old localStorage copy is removed. Other tabs are told through a BroadcastChannel. Without IndexedDB (tests) the fallback is used as it is.
 */
export function createIdbMasterData(fallback: MasterDataService): MasterDataService {
  if (typeof indexedDB === 'undefined') return fallback;
  let current: MasterDataDocument = fallback.read();
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  const fromDb = () => run<unknown>('readonly', (s) => s.get(KEY));
  return {
    read: () => current,
    async hydrate() {
      const stored = await fromDb();
      current = valid(stored) ? stored : await fallback.hydrate();
      return current;
    },
    async save(value) {
      current = value;
      await run('readwrite', (s) => s.put(value, KEY));
      fallback.clear(); // the document lives here now
      channel?.postMessage('changed');
    },
    subscribe(listener) {
      if (!channel) return () => {};
      const on = async () => {
        const stored = await fromDb();
        if (valid(stored)) {
          current = stored;
          listener(stored);
        }
      };
      channel.addEventListener('message', on);
      return () => channel.removeEventListener('message', on);
    },
    clear() {
      fallback.clear();
      void run('readwrite', (s) => s.delete(KEY));
    },
  };
}
