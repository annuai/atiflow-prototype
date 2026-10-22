import { DrawingEngine } from '../core/engine';
import { DrawingError, type Built, type RowStats, type Rules, type Summary } from '../core/types';
import type { Ask, Reply } from './protocol';

/** An opened drawing: ask it for the layer rows of the blocks that are opened, and for what the rules make of it. Close it when done (the worker is stopped). */
export interface DrawingSession {
  summary: Summary;
  rows(blockRules: Rules['blocks'], unit: number): Promise<RowStats[]>;
  build(rules: Rules, unit: number): Promise<Built>;
  close(): void;
}

/** Opens a drawing file (DXF, a converted DWG, or Illustrator) off the page's thread. Where there are no workers (tests) the same engine runs here. */
export async function openDrawing(name: string, bytes: Uint8Array): Promise<DrawingSession> {
  if (typeof Worker === 'undefined') {
    const engine = new DrawingEngine();
    const summary = engine.open(name, bytes);
    return {
      summary,
      rows: async (b, u) => engine.rows(b, u),
      build: async (r, u) => engine.build(r, u),
      close: () => undefined,
    };
  }
  const worker = new Worker(new URL('./drawingWorker.ts', import.meta.url), { type: 'module' });
  let seq = 0;
  const waiting = new Map<number, { ok(v: unknown): void; fail(e: Error): void }>();
  worker.onmessage = (e: MessageEvent<Reply>) => {
    const w = waiting.get(e.data.id);
    if (!w) return;
    waiting.delete(e.data.id);
    if (e.data.ok) w.ok(e.data.result);
    else w.fail(new DrawingError(e.data.code, e.data.message));
  };
  worker.onerror = (e) => {
    for (const w of waiting.values()) w.fail(new Error(e.message || 'The drawing reader failed'));
    waiting.clear();
  };
  const ask = <T>(req: Ask, transfer: Transferable[] = []) =>
    new Promise<T>((ok, fail) => {
      const id = ++seq;
      waiting.set(id, { ok: ok as (v: unknown) => void, fail });
      worker.postMessage({ ...req, id }, transfer);
    });
  try {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const summary = await ask<Summary>({ type: 'open', name, buffer }, [buffer]);
    return {
      summary,
      rows: (blockRules, unit) => ask<RowStats[]>({ type: 'rows', blockRules, unit }),
      build: (rules, unit) => ask<Built>({ type: 'build', rules, unit }),
      close: () => worker.terminate(),
    };
  } catch (e) {
    worker.terminate();
    throw e;
  }
}
