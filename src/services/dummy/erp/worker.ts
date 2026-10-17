/// <reference lib="webworker" />
import { createCatalog, type Catalog, type CatalogFile } from './catalog';
import type { WorkerRequest, WorkerResponse } from './protocol';

/** Holds the catalogue off the page's thread: loading, parsing and searching never block the interface. */
let catalog: Promise<Catalog> | null = null;
const load = (url: string) =>
  (catalog ??= fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Catalogue not available (${r.status})`);
      return r.json() as Promise<CatalogFile>;
    })
    .then(createCatalog)
    .catch((e) => {
      catalog = null; // allow a retry
      throw e;
    }));

const reply = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const m = e.data;
  try {
    const c = await load(m.url);
    reply({ id: m.id, ok: true, result: m.op === 'search' ? c.search(m.q) : c.all(m.q) });
  } catch (err) {
    reply({ id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
