import { createStore, type StoreApi } from 'zustand/vanilla';
import { createPersister, withoutSaving, type PersistOptions } from './persist';
import { registerStoreInit } from './storeInit';

/**
 * How a store that is saved through a service is built. Every such store used to repeat the same dozen lines (read the service, create the store, make a persister, watch the state,
 * re-read when the services are replaced, take over another window's change, a handle for the console); this is the one place that does it, so a new store is its state and its rules only.
 *
 * - `read()` is what the service holds; `apply(data)` turns it into state (migrations and clean-up belong here), `pick(state)` turns state back into what the service takes.
 * - `watch` lists the state keys that are saved: when one of them changes (a new object, as zustand needs anyway) `pick(state)` is queued for saving.
 * - `listen(cb)` (optional) calls `cb` when ANOTHER window saved; what it gives is taken over without being saved back.
 * - `devHandle` (optional) is the name of the `window` property that gives the store to the console in development.
 */
export interface PersistedStoreOptions<S, D> extends PersistOptions {
  /** shown in the "your changes were not saved" notice */
  name: string;
  read(): D;
  save(data: D): Promise<void>;
  pick(state: S): D;
  apply(data: D): Partial<S>;
  watch: readonly (keyof S)[];
  listen?(onChange: (data: D) => void): () => void;
  /** also save what was read at the start (a store that upgraded old data saves the upgraded form straight away) */
  saveOnStart?: boolean;
  devHandle?: string;
}

/** The store's own rules: its actions (and any state that is not read from the service). The saved data comes from `apply(read())` and is added to it. */
export type Creator<S> = (set: StoreApi<S>['setState'], get: StoreApi<S>['getState'], api: StoreApi<S>) => Partial<S>;

export function createPersistedStore<S extends object, D>(
  opts: PersistedStoreOptions<S, D>,
  creator: Creator<S>,
): StoreApi<S> {
  const { delayMs, retries, backoffMs } = opts;
  const store = createStore<S>((set, get, api) => ({ ...creator(set, get, api), ...opts.apply(opts.read()) }) as S);
  const persist = createPersister(opts.name, opts.save, { delayMs, retries, backoffMs });
  store.subscribe((s, p) => {
    if (opts.watch.some((k) => s[k] !== p[k])) persist.queue(opts.pick(s));
  });
  const adopt = (data: D) => withoutSaving(() => store.setState(opts.apply(data)));
  let unlisten = opts.listen?.(adopt);
  if (opts.saveOnStart) persist.queue(opts.pick(store.getState()));
  // the services were replaced (a test, hot reload, another tenant): read the new ones and listen to them
  registerStoreInit(() => {
    unlisten?.();
    adopt(opts.read());
    unlisten = opts.listen?.(adopt);
    if (opts.saveOnStart) persist.queue(opts.pick(store.getState()));
  });
  if (opts.devHandle && import.meta.env?.DEV && typeof window !== 'undefined')
    Object.assign(window, { [opts.devHandle]: store });
  return store;
}
