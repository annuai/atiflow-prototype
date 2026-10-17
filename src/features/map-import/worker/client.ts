import { prepareImport, type PreparedImport } from '../core/prepare';
import { ImportError, type ImportOptions } from '../core/types';
import type { WorkerReply } from './importWorker';

/**
 * Imports a zip in a Web Worker and resolves with the prepared result; `signal` cancels (the worker is stopped). Where workers do not exist (old browsers, tests) it runs on the page's
 * thread instead: slower for a big map but the same result.
 */
export function importInWorker(
  zip: Uint8Array,
  options: ImportOptions = {},
  signal?: AbortSignal,
): Promise<PreparedImport> {
  if (typeof Worker === 'undefined') return Promise.resolve().then(() => prepareImport(zip, options));
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./importWorker.ts', import.meta.url), { type: 'module' });
    const done = () => {
      signal?.removeEventListener('abort', abort);
      w.terminate();
    };
    const abort = () => {
      done();
      reject(new DOMException('Import cancelled', 'AbortError'));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort);
    w.onmessage = (e: MessageEvent<WorkerReply>) => {
      done();
      if (e.data.ok) resolve(e.data.result);
      else reject(new ImportError(e.data.code, e.data.message));
    };
    w.onerror = (e) => {
      done();
      reject(new Error(e.message || 'The import worker failed'));
    };
    w.postMessage({ zip, options });
  });
}
