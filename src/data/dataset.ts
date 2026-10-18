import { createPersistedStore } from '@/data/persistedStore';
import { useStore } from 'zustand';
import { services } from '@/services';
import { asFleetId, type FleetId, type FleetRecord } from './fleets';
import { fleetIdIn } from './fleetRefs';
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
  /** Gives the fleet another name (robots, workflows, materials... point at its id, so nothing else changes). */
  renameFleet(id: FleetId, name: string): void;
  /** Removes the fleet; its robots and hardware stay registered and become unassigned. */
  removeFleet(id: FleetId): void;
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

/** Robots and hardware saved with a fleet NAME point at the fleet's id from now on. */
const withFleetIds = (d: DatasetData, list: Device[]): Device[] =>
  list.map((x) =>
    x.values.fleet ? { ...x, values: { ...x.values, fleet: fleetIdIn(d.fleets, String(x.values.fleet)) } } : x,
  );
const nameOf = (d: Device) => String(d.values.name ?? '');
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'fleet';

export const datasetStore = createPersistedStore<DatasetState, DatasetData>(
  {
    name: 'fleets, robots and hardware',
    read: () => services().dataset.read(),
    save: (v) => services().dataset.save(v),
    pick: (s) => ({ version: 1, fleets: s.fleets, robot: s.robot, hardware: s.hardware }),
    apply: (d) => ({ ...d, robot: withFleetIds(d, d.robot), hardware: withFleetIds(d, d.hardware) }),
    watch: ['fleets', 'robot', 'hardware'],
    delayMs: 250,
    // another tab (e.g. a configurator editing robots while a supervisor watches the floor) saved the dataset: take it over, so every window shows the same robots
    listen: (cb) => services().dataset.subscribe(cb),
    devHandle: '__dataset',
  },
  (set, get) => ({
    addFleet(name) {
      const { fleets } = get();
      let id = asFleetId(slug(name));
      for (let n = 2; fleets.some((f) => f.id === id); n++) id = asFleetId(`${slug(name)}-${n}`);
      const f: FleetRecord = { id, name, color: COLORS[fleets.length % COLORS.length] };
      set({ fleets: [...fleets, f] });
      return f;
    },
    renameFleet(id, name) {
      set({ fleets: get().fleets.map((f) => (f.id === id ? { ...f, name } : f)) });
    },
    removeFleet(id) {
      const free = (list: Device[]) =>
        list.map((d) => (d.values.fleet === id ? { ...d, values: { ...d.values, fleet: '' } } : d));
      set({
        fleets: get().fleets.filter((f) => f.id !== id),
        robot: free(get().robot),
        hardware: free(get().hardware),
      });
    },
    // new records start Offline: they have not connected yet
    addDevice: (kind, values) =>
      set({ [kind]: [...get()[kind], { status: 'offline', values }] } as Partial<DatasetData>),
    updateDevice: (kind, name, values) =>
      set({
        [kind]: get()[kind].map((d) => (nameOf(d) === name ? { ...d, values: { ...d.values, ...values } } : d)),
      } as Partial<DatasetData>),
    removeDevice: (kind, name) =>
      set({ [kind]: get()[kind].filter((d) => nameOf(d) !== name) } as Partial<DatasetData>),
    replace: (data) => set({ ...data }),
    reset: () => set({ ...datasetDoc.reset() }),
  }),
);
export const useDataset = <T>(sel: (s: DatasetState) => T) => useStore(datasetStore, sel);
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __datasetDoc: datasetDoc }); // dev-only: inspect / export / import from the console
