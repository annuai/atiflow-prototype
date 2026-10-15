import { createStore } from 'zustand/vanilla';
import { log, reportError } from '@/platform';

/**
 * How a store hands its data to a service without losing it quietly. `queue(value)` keeps only the newest value, waits `delayMs` (so a burst of edits is one save), saves ONE at a
 * time, retries a failed save with growing pauses, and when it finally gives up it reports the error and marks the persister failed (`persistence` store: the app shows a message and
 * the next change, or `retryAll()`, tries again). Whatever is still waiting is saved when the page is hidden or closed (`flushAll`). With the dummy services a save never fails; with an
 * API it will, and this is the one place that decides what happens then.
 */
export interface Persister<T> {
  /** save this value soon (replaces one that is still waiting) */
  queue(value: T): void;
  /** save now what is waiting; resolves when the save has finished (or given up) */
  flush(): Promise<void>;
  /** try again the value that could not be saved */
  retry(): void;
  readonly name: string;
}
export interface PersistOptions {
  /** wait this long after the last `queue` before saving (default 0) */
  delayMs?: number;
  /** extra attempts after the first (default 3) */
  retries?: number;
  /** pause before the first retry; doubles each time (default 500) */
  backoffMs?: number;
}

/** Names of the persisters that gave up, with the message of the last error. */
export const persistence = createStore<{ failed: Record<string, string> }>(() => ({ failed: {} }));
const set = (name: string, error: string | null) =>
  persistence.setState((s) => {
    const { [name]: _gone, ...rest } = s.failed;
    return { failed: error === null ? rest : { ...rest, [name]: error } };
  });

const all = new Set<Persister<never>>();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const NONE = Symbol('none');

export function createPersister<T>(
  name: string,
  save: (value: T) => Promise<void>,
  { delayMs = 0, retries = 3, backoffMs = 500 }: PersistOptions = {},
): Persister<T> {
  let pending: T | typeof NONE = NONE;
  let failedValue: T | typeof NONE = NONE;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | null = null;

  const attempt = async (value: T) => {
    let last: unknown;
    for (let n = 0; n <= retries; n++) {
      try {
        await save(value);
        failedValue = NONE;
        set(name, null);
        return;
      } catch (e) {
        last = e;
        log.child('persist').warn(`saving ${name} failed (attempt ${n + 1} of ${retries + 1})`, e);
        if (n < retries) await sleep(backoffMs * 2 ** n);
      }
    }
    failedValue = value;
    set(name, last instanceof Error ? last.message : 'The data could not be saved.');
    reportError(last, { where: `persist:${name}` });
  };
  const run = (): Promise<void> => {
    if (running) return running;
    running = (async () => {
      try {
        while (pending !== NONE) {
          const v = pending;
          pending = NONE;
          await attempt(v);
        }
      } finally {
        running = null;
      }
    })();
    return running;
  };
  const p: Persister<T> = {
    name,
    queue(value) {
      pending = value;
      clearTimeout(timer);
      timer = setTimeout(() => void run(), delayMs);
    },
    flush() {
      clearTimeout(timer);
      return run();
    },
    retry() {
      if (failedValue !== NONE && pending === NONE) pending = failedValue;
      void p.flush();
    },
  };
  all.add(p as Persister<never>);
  return p;
}

/** Save everything that is waiting now (the page is being hidden or closed). */
export const flushAll = () => Promise.all([...all].map((p) => p.flush())).then(() => undefined);
/** Try again everything that could not be saved. */
export const retryAll = () => all.forEach((p) => p.retry());
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flushAll());
  window.addEventListener('online', retryAll);
}

/**
 * One-off operations that must not be lost either (set a password, delete credentials): same retry and reporting, no debouncing, nothing replaced by a newer call.
 * Resolves true when it worked.
 */
export async function persistOnce(
  name: string,
  op: () => Promise<void>,
  { retries = 3, backoffMs = 500 }: PersistOptions = {},
) {
  let last: unknown;
  for (let n = 0; n <= retries; n++) {
    try {
      await op();
      return true;
    } catch (e) {
      last = e;
      if (n < retries) await sleep(backoffMs * 2 ** n);
    }
  }
  set(name, last instanceof Error ? last.message : 'The change could not be saved.');
  reportError(last, { where: `persist:${name}` });
  return false;
}
