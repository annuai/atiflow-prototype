import type { ErpQuery, ErpResult, ErpRow, MaterialSource } from '@/features/master-data/sources/types';
import { createCatalog, type CatalogFile } from './catalog';
import type { WorkerRequest, WorkerResponse } from './protocol';

const LATENCY_MS = 120; // a network call's worth of waiting, so the loading states are real

/**
 * DUMMY ERP: answers "Import from API" from public/dummy-api/materials.json (built from a real BOM export by `npm run build:dummy-erp`).
 * The file is fetched lazily on the first call and searched in a Web Worker, so 47,000 materials never block typing or scrolling. Without Worker support (tests) the same
 * catalogue runs on the calling thread. A real adapter implements MaterialSource over the ERP's HTTP API; nothing else changes.
 */
export function createDummyMaterialSource(opts: { url?: string; latencyMs?: number } = {}): MaterialSource {
  const url = opts.url ?? `${import.meta.env.BASE_URL}dummy-api/materials.json`;
  const latency = opts.latencyMs ?? LATENCY_MS;
  let worker: Worker | null = null;
  let seq = 0;
  const pending = new Map<number, { ok(v: unknown): void; fail(e: Error): void }>();
  let local: Promise<ReturnType<typeof createCatalog>> | null = null;

  const startWorker = (): Worker => {
    const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.ok(e.data.result);
      else p.fail(new Error(e.data.error));
    };
    w.onerror = () => {
      pending.forEach((p) => p.fail(new Error('The catalogue worker stopped')));
      pending.clear();
      w.terminate();
      worker = null;
    };
    return w;
  };
  const call = <T>(req: DistributiveOmit<WorkerRequest, 'id' | 'url'>): Promise<T> => {
    const wait = new Promise<void>((r) => setTimeout(r, latency));
    const run =
      typeof Worker !== 'undefined'
        ? new Promise<T>((ok, fail) => {
            const id = ++seq;
            pending.set(id, { ok: ok as (v: unknown) => void, fail });
            (worker ??= startWorker()).postMessage({ ...req, id, url } as WorkerRequest);
          })
        : (local ??= fetch(url)
            .then((r) => r.json() as Promise<CatalogFile>)
            .then(createCatalog)).then((c) => (req.op === 'search' ? c.search(req.q) : c.all(req.q)) as T);
    return Promise.all([run, wait]).then(([v]) => v);
  };
  return {
    search: (q: ErpQuery) => call<ErpResult>({ op: 'search', q }),
    all: (q) => call<ErpRow[]>({ op: 'all', q }),
  };
}
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
