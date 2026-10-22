/// <reference lib="webworker" />
import { DrawingEngine } from '../core/engine';
import { DrawingError } from '../core/types';
import type { Request, Reply } from './protocol';

const engine = new DrawingEngine();
self.onmessage = (e: MessageEvent<Request>) => {
  const m = e.data;
  try {
    const result =
      m.type === 'open'
        ? engine.open(m.name, new Uint8Array(m.buffer))
        : m.type === 'rows'
          ? engine.rows(m.blockRules, m.unit)
          : engine.build(m.rules, m.unit);
    (self as unknown as Worker).postMessage({ id: m.id, ok: true, result } satisfies Reply);
  } catch (err) {
    const code = err instanceof DrawingError ? err.code : 'broken';
    (self as unknown as Worker).postMessage({
      id: m.id,
      ok: false,
      code,
      message: err instanceof Error ? err.message : String(err),
    } satisfies Reply);
  }
};
