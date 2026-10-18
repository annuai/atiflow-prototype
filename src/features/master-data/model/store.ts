import { createStore } from 'zustand/vanilla';
import { registerStoreInit } from '@/data/storeInit';
import { createPersister, withoutSaving } from '@/data/persist';
import { useStore } from 'zustand';
import { services } from '@/services';
import { applyEdit, pushLog, releaseCells, normaliseAreas, type CellEdit, type CellError } from './cells';
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
  /**
   * Change cells of an area (the area comes from its map; only what it holds is kept here): fill them with a material, empty them or block them. All or nothing; returns what went wrong, or
   * null. `allowed` = the codes the area's fleet may hold (the editor passes them).
   */
  editCells(
    area: StagingArea,
    keys: string[],
    edit: CellEdit,
    by: string,
    allowed?: ReadonlySet<string> | null,
  ): { error: CellError; key: string } | null;
  /** A person lets go of reservations. */
  releaseCells(area: StagingArea, keys: string[], by: string): void;
}

const load = (): Pick<MasterDataState, 'materials' | 'groups' | 'areas'> => {
  const d = services().masterData.read();
  return { ...d, areas: normaliseAreas(d.areas as never) }; // (data saved before cells held materials is upgraded here)
};

export const masterDataStore = createStore<MasterDataState>((set, get) => {
  /** Save new contents of one area (creating its record the first time: until then only the map knows it). */
  const write = (base: StagingArea, patch: Partial<StagingArea>) => {
    const next = { ...base, ...patch };
    set({
      areas: get().areas.some((a) => a.id === base.id)
        ? get().areas.map((a) => (a.id === base.id ? next : a))
        : [...get().areas, next],
    });
  };
  return {
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
    editCells(area, keys, edit, by, allowed = null) {
      const cur = get().areas.find((a) => a.id === area.id);
      const base = cur ?? { id: area.id, name: area.name, rows: area.rows, cols: area.cols, cells: {} };
      const r = applyEdit(base.cells, keys, edit, by, Date.now(), {
        known: new Set(get().materials.map((m) => m.code)),
        allowed,
      });
      if (!r.ok) return { error: r.error, key: r.key };
      write(base, { cells: r.cells, log: pushLog(base.log, r.log) });
      return null;
    },
    releaseCells(area, keys, by) {
      const base = get().areas.find((a) => a.id === area.id) ?? { ...area, cells: {} };
      const r = releaseCells(base.cells, keys, by, Date.now());
      if (r.ok && r.log.length) write(base, { cells: r.cells, log: pushLog(base.log, r.log) });
    },
  };
});
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
