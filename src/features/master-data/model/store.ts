import { createStore } from 'zustand/vanilla';
import { registerStoreInit } from '@/data/storeInit';
import { createPersister, withoutSaving } from '@/data/persist';
import { useStore } from 'zustand';
import { services } from '@/services';
import { cellKey, toggleBlocked } from './areas';
import { assignToFleet, ensureGroup, mergeMaterials, unassignFromFleet } from './logic';
import type { IncomingMaterial, Material, MaterialGroup, StagingArea } from './types';

export interface MasterDataState {
  materials: Material[];
  groups: MaterialGroup[];
  areas: StagingArea[];
  /** Merge rows into the list (existing codes are skipped). Returns how many were added. */
  addMaterials(rows: IncomingMaterial[]): number;
  updateMaterial(code: string, patch: { name?: string; groupName?: string }): void;
  setMaterialFleets(code: string, fleets: string[]): void;
  assignMaterials(codes: string[], fleet: string): void;
  /** The fleet was renamed: assigned materials follow it. */
  renameFleet(from: string, to: string): void;
  /** The fleet was deleted: no material is assigned to it any more. */
  removeFleet(name: string): void;
  unassignMaterial(code: string, fleet: string): void;
  /** Take a material out of Master Data (callers check that no workflow uses it). */
  removeMaterial(code: string): void;
  /** Block / release one cell of an area (the area comes from its map; only its cell states are kept here). */
  toggleCell(area: StagingArea, row: number, col: number): void;
}

const load = (): Pick<MasterDataState, 'materials' | 'groups' | 'areas'> => services().masterData.read();

export const masterDataStore = createStore<MasterDataState>((set, get) => ({
  ...load(),
  addMaterials(rows) {
    const r = mergeMaterials(get().materials, get().groups, rows, Date.now());
    if (r.added) set({ materials: r.materials, groups: r.groups });
    return r.added;
  },
  updateMaterial(code, patch) {
    const now = Date.now();
    const { materials, groups } = get();
    const g = patch.groupName === undefined ? { groups, id: undefined } : ensureGroup(groups, patch.groupName, now);
    set({
      groups: g.groups,
      materials: materials.map((m) =>
        m.code === code ? { ...m, name: patch.name ?? m.name, group: g.id ?? m.group, updatedAt: now } : m,
      ),
    });
  },
  setMaterialFleets: (code, fleets) =>
    set({ materials: get().materials.map((m) => (m.code === code ? { ...m, fleets, updatedAt: Date.now() } : m)) }),
  removeFleet: (name) =>
    set({
      materials: get().materials.map((m) =>
        m.fleets.includes(name) ? { ...m, fleets: m.fleets.filter((f) => f !== name) } : m,
      ),
    }),
  renameFleet: (from, to) =>
    set({
      materials: get().materials.map((m) =>
        m.fleets.includes(from) ? { ...m, fleets: m.fleets.map((f) => (f === from ? to : f)) } : m,
      ),
    }),
  assignMaterials: (codes, fleet) => set({ materials: assignToFleet(get().materials, codes, fleet, Date.now()) }),
  unassignMaterial: (code, fleet) => set({ materials: unassignFromFleet(get().materials, code, fleet, Date.now()) }),
  removeMaterial: (code) => set({ materials: get().materials.filter((m) => m.code !== code) }),
  toggleCell(area, row, col) {
    const cur = get().areas.find((a) => a.id === area.id);
    const next = toggleBlocked({ ...area, cells: { ...(cur?.cells ?? {}), ...area.cells } }, row, col);
    // keep cells hidden by a smaller grid, change only the visible one
    const cells = { ...(cur?.cells ?? {}) };
    const k = cellKey(row, col);
    if (next.cells[k]) cells[k] = next.cells[k];
    else delete cells[k];
    set({
      areas: cur
        ? get().areas.map((a) => (a.id === area.id ? { ...a, cells } : a))
        : [...get().areas, { id: area.id, name: area.name, rows: area.rows, cols: area.cols, cells }],
    });
  },
}));
export const useMasterData = <T>(sel: (s: MasterDataState) => T) => useStore(masterDataStore, sel);

const persist = createPersister(
  'master data',
  (v: Pick<MasterDataState, 'materials' | 'groups' | 'areas'>) => services().masterData.save(v),
  { delayMs: 250 },
);
masterDataStore.subscribe((s, p) => {
  if (s.materials === p.materials && s.groups === p.groups && s.areas === p.areas) return;
  persist.queue({ materials: s.materials, groups: s.groups, areas: s.areas });
});

registerStoreInit(() => withoutSaving(() => masterDataStore.setState({ ...load() })));
