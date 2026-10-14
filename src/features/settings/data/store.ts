import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { createDocument, localBackend } from '@/data/storage';
import { connectionById } from '../model/connections';
import { seedSettings } from '../model/seed';
import type { ConnectionId, GeneralSettings, SettingsData, TestResult } from '../model/types';
import { connectionTester } from './tester';

/** The settings of the site, saved in the browser (`StorageBackend`: a server later means another backend, nothing else changes). */
const KEY = 'atiflow.settings.v1';
const valid = (v: unknown): v is SettingsData => { const d = v as SettingsData; return !!d && d.version === 1 && !!d.connections?.['fleet-manager'] && !!d.connections?.mes && !!d.general; };
export const settingsDoc = createDocument<SettingsData>(localBackend(KEY), () => seedSettings(), valid);

export interface SettingsState extends SettingsData {
  saveConnection(id: ConnectionId, values: Record<string, string>): void;
  /** Checks the connection with the tester and keeps the answer. */
  test(id: ConnectionId): Promise<TestResult>;
  sync(id: ConnectionId): Promise<void>;
  saveGeneral(g: GeneralSettings): void;
  reset(): void;
}
export const settingsStore = createStore<SettingsState>((set, get) => ({
  ...settingsDoc.load(),
  saveConnection(id, values) { const c = get().connections[id]; set({ connections: { ...get().connections, [id]: { ...c, values, lastTest: undefined } } }); },      // new values: the old test result no longer counts
  async test(id) {
    const c = get().connections[id], r = await connectionTester.test(connectionById(id), c.values); const result: TestResult = { ...r, at: Date.now() };
    set({ connections: { ...get().connections, [id]: { ...get().connections[id], lastTest: result } } }); return result;
  },
  async sync(id) { const at = await connectionTester.sync(connectionById(id)); set({ connections: { ...get().connections, [id]: { ...get().connections[id], lastSynced: at } } }); },
  saveGeneral(general) { set({ general }); },
  reset() { set({ ...settingsDoc.reset() }); },
}));
export const useSettings = <T,>(sel: (s: SettingsState) => T) => useStore(settingsStore, sel);
settingsStore.subscribe((s, p) => { if (s.connections !== p.connections || s.general !== p.general) settingsDoc.save({ version: 1, connections: s.connections, general: s.general }); });
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __settings: settingsStore });
