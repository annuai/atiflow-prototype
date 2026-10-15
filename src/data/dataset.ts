import { createStore } from 'zustand/vanilla';
import { createPersister } from './persist';
import { useStore } from 'zustand';
import { services } from '@/services';
import type { FleetRecord } from './fleets';
import type { DatasetData } from './datasetTypes';
import type { DatasetDevice as Device } from './datasetTypes';

type DeviceKindId = 'robot' | 'hardware';
type FieldValue = string | string[];

/**
 * THE shared dataset: fleets, robots and hardware. Configurator pages, the Live Floor, the Dashboard and the simulator all read it from here,
 * so a fleet or robot has one name and one assignment everywhere. The starting data is `dataset.json`; edits are saved through the storage document
 * (browser storage today, a backend later: write another `StorageBackend`, the rest stays).
 * Fleets are referred to by NAME in other stores (renaming cascades through `renameFleet`).
 */
export type { DatasetData } from './datasetTypes';
export interface DatasetState extends DatasetData {
  addFleet(name: string): FleetRecord;
  /** Renames the fleet and every robot / hardware assigned to it. */
  renameFleet(from: string, to: string): void;
  addDevice(kind: DeviceKindId, values: Record<string, FieldValue>): void;
  updateDevice(kind: DeviceKindId, name: string, values: Record<string, FieldValue>): void;
  removeDevice(kind: DeviceKindId, name: string): void;
  /** Replace everything (import / restore). */
  replace(data: DatasetData): void;
  /** Back to `dataset.json`. */
  reset(): void;
}

const COLORS = ['#14b8a6', '#f59e0b', '#6366f1', '#ec4899', '#22c55e', '#0ea5e9', '#a855f7'];
const isDataset = (v: unknown): v is DatasetData => {
  const d = v as DatasetData;
  return !!d && d.version === 1 && Array.isArray(d.fleets) && Array.isArray(d.robot) && Array.isArray(d.hardware);
};
/** Backup / restore helpers for the dev handle and tests: the dataset as text, and text back into a dataset (checked). Saving itself goes through the `dataset` service. */
export const datasetDoc = {
  exportText: (value: DatasetData) => JSON.stringify(value, null, 2),
  parse(text: string): { value: DatasetData } | { error: string } {
    try {
      const v: unknown = JSON.parse(text);
      return isDataset(v) ? { value: v } : { error: 'The JSON does not have the shape of the dataset.' };
    } catch {
      return { error: 'This is not valid JSON.' };
    }
  },
  reset(): DatasetData {
    services().dataset.clear();
    return services().dataset.read();
  },
};

const nameOf = (d: Device) => String(d.values.name ?? '');
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'fleet';

export const datasetStore = createStore<DatasetState>((set, get) => ({
  ...services().dataset.read(),
  addFleet(name) {
    const { fleets } = get();
    let id = slug(name);
    for (let n = 2; fleets.some((f) => f.id === id); n++) id = `${slug(name)}-${n}`;
    const f: FleetRecord = { id, name, color: COLORS[fleets.length % COLORS.length] };
    set({ fleets: [...fleets, f] });
    return f;
  },
  renameFleet(from, to) {
    const move = (list: Device[]) =>
      list.map((d) => (d.values.fleet === from ? { ...d, values: { ...d.values, fleet: to } } : d));
    set({
      fleets: get().fleets.map((f) => (f.name === from ? { ...f, name: to } : f)),
      robot: move(get().robot),
      hardware: move(get().hardware),
    });
  },
  // new records start Offline: they have not connected yet
  addDevice: (kind, values) => set({ [kind]: [...get()[kind], { status: 'offline', values }] } as Partial<DatasetData>),
  updateDevice: (kind, name, values) =>
    set({
      [kind]: get()[kind].map((d) => (nameOf(d) === name ? { ...d, values: { ...d.values, ...values } } : d)),
    } as Partial<DatasetData>),
  removeDevice: (kind, name) => set({ [kind]: get()[kind].filter((d) => nameOf(d) !== name) } as Partial<DatasetData>),
  replace: (data) => set({ ...data }),
  reset: () => set({ ...datasetDoc.reset() }),
}));
export const useDataset = <T>(sel: (s: DatasetState) => T) => useStore(datasetStore, sel);

const persist = createPersister('fleets, robots and hardware', (v: DatasetData) => services().dataset.save(v), {
  delayMs: 250,
});
datasetStore.subscribe((s, p) => {
  if (s.fleets === p.fleets && s.robot === p.robot && s.hardware === p.hardware) return;
  persist.queue({ version: 1, fleets: s.fleets, robot: s.robot, hardware: s.hardware });
});
// another tab (e.g. a configurator editing robots while a supervisor watches the floor) saved the dataset: take it over, so every window shows the same robots
services().dataset.subscribe((data) => datasetStore.setState({ ...data }));
if (import.meta.env?.DEV && typeof window !== 'undefined')
  Object.assign(window, { __dataset: datasetStore, __datasetDoc: datasetDoc }); // dev-only: inspect / export / import from the console
