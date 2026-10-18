import { createPersistedStore } from '@/data/persistedStore';
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
export const settingsStore = createPersistedStore<SettingsState, SettingsData>(
  {
    name: 'settings',
    read: () => services().settings.read(),
    save: (d) => services().settings.save(d),
    pick: (s) => ({ version: 1, connections: s.connections, general: s.general }),
    apply: (d) => ({ ...d }),
    watch: ['connections', 'general'],
    devHandle: '__settings',
  },
  (set, get) => ({
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
  }),
);
export const useSettings = <T>(sel: (s: SettingsState) => T) => useStore(settingsStore, sel);
