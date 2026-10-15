import { createStore } from 'zustand/vanilla';
import { registerStoreInit } from '@/data/storeInit';
import { createPersister, withoutSaving } from '@/data/persist';
import { useStore } from 'zustand';
import { services } from '@/services';
import { connectionById } from '../model/connections';
import type { ConnectionId, GeneralSettings, SettingsData, TestResult } from '../model/types';
import { connectionTester } from './tester';

/** The settings of the site: a client-side cache over the `settings` service (the dummy one keeps them in browser storage). */
export interface SettingsState extends SettingsData {
  saveConnection(id: ConnectionId, values: Record<string, string>): void;
  /** Checks the connection with the tester and keeps the answer. */
  test(id: ConnectionId): Promise<TestResult>;
  sync(id: ConnectionId): Promise<void>;
  saveGeneral(g: GeneralSettings): void;
  reset(): void;
}
export const settingsStore = createStore<SettingsState>((set, get) => ({
  ...services().settings.read(),
  saveConnection(id, values) {
    const c = get().connections[id];
    set({ connections: { ...get().connections, [id]: { ...c, values, lastTest: undefined } } });
  }, // new values: the old test result no longer counts
  async test(id) {
    const c = get().connections[id],
      r = await connectionTester.test(connectionById(id), c.values);
    const result: TestResult = { ...r, at: Date.now() };
    set({ connections: { ...get().connections, [id]: { ...get().connections[id], lastTest: result } } });
    return result;
  },
  async sync(id) {
    const at = await connectionTester.sync(connectionById(id));
    set({ connections: { ...get().connections, [id]: { ...get().connections[id], lastSynced: at } } });
  },
  saveGeneral(general) {
    set({ general });
  },
  reset() {
    services().settings.clear();
    set({ ...services().settings.read() });
  },
}));
export const useSettings = <T>(sel: (s: SettingsState) => T) => useStore(settingsStore, sel);
const persist = createPersister('settings', (v: SettingsData) => services().settings.save(v));
settingsStore.subscribe((s, p) => {
  if (s.connections !== p.connections || s.general !== p.general)
    persist.queue({ version: 1, connections: s.connections, general: s.general });
});
registerStoreInit(() => withoutSaving(() => settingsStore.setState({ ...services().settings.read() })));
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __settings: settingsStore });
