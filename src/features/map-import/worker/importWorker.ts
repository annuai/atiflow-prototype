/// <reference lib="webworker" />
import { prepareImport } from '../core/prepare';
import { ImportError, type ImportOptions } from '../core/types';

export type WorkerRequest = { zip: Uint8Array; options?: ImportOptions };
export type WorkerReply =
  { ok: true; result: ReturnType<typeof prepareImport> } | { ok: false; code: string; message: string };

/** Runs the import off the page's thread (a 16-million-cell grid takes a few hundred milliseconds; the page keeps drawing). */
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  let reply: WorkerReply;
  try {
    reply = { ok: true, result: prepareImport(e.data.zip, e.data.options) };
  } catch (err) {
    reply =
      err instanceof ImportError
        ? { ok: false, code: err.code, message: err.message }
        : { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Import failed' };
  }
  const transfer = reply.ok ? reply.result.levels.map((l) => l.bytes.buffer) : [];
  (self as unknown as Worker).postMessage(reply, transfer as Transferable[]);
};
