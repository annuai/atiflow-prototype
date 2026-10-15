import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { cellKey, toggleBlocked } from './areas';
import { assignToFleet, ensureGroup, mergeMaterials, unassignFromFleet } from './logic';
import { seedAreas, seedGroups, seedMaterials } from './seed';
import type { IncomingMaterial, Material, MaterialGroup, StagingArea } from './types';

const KEY = 'atiflow.masterdata.v1';
export interface MasterDataState {
  materials: Material[]; groups: MaterialGroup[]; areas: StagingArea[];
  /** Merge rows into the list (existing codes are skipped). Returns how many were added. */
  addMaterials(rows: IncomingMaterial[]): number;
  updateMaterial(code: string, patch: { name?: string; groupName?: string }): void;
  setMaterialFleets(code: string, fleets: string[]): void;
  assignMaterials(codes: string[], fleet: string): void;
  /** The fleet was renamed: assigned materials follow it. */
  renameFleet(from: string, to: string): void;
  unassignMaterial(code: string, fleet: string): void;
  /** Block / release one cell of an area (the area comes from its map; only its cell states are kept here). */
  toggleCell(area: StagingArea, row: number, col: number): void;
}

function load(): Pick<MasterDataState, 'materials' | 'groups' | 'areas'> {
  try { const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (Array.isArray(raw?.materials) && Array.isArray(raw?.groups) && Array.isArray(raw?.areas)) return raw; } catch { /* fall through */ }
  const now = Date.now(); const groups = seedGroups(now);
  return { groups, materials: seedMaterials(now, groups), areas: seedAreas() };
}

export const masterDataStore = createStore<MasterDataState>((set, get) => ({
  ...load(),
  addMaterials(rows) { const r = mergeMaterials(get().materials, get().groups, rows, Date.now()); if (r.added) set({ materials: r.materials, groups: r.groups }); return r.added; },
  updateMaterial(code, patch) {
    const now = Date.now(); const { materials, groups } = get(); const g = patch.groupName === undefined ? { groups, id: undefined } : ensureGroup(groups, patch.groupName, now);
    set({ groups: g.groups, materials: materials.map((m) => (m.code === code ? { ...m, name: patch.name ?? m.name, group: g.id ?? m.group, updatedAt: now } : m)) });
  },
  setMaterialFleets: (code, fleets) => set({ materials: get().materials.map((m) => (m.code === code ? { ...m, fleets, updatedAt: Date.now() } : m)) }),
  renameFleet: (from, to) => set({ materials: get().materials.map((m) => (m.fleets.includes(from) ? { ...m, fleets: m.fleets.map((f) => (f === from ? to : f)) } : m)) }),
  assignMaterials: (codes, fleet) => set({ materials: assignToFleet(get().materials, codes, fleet, Date.now()) }),
  unassignMaterial: (code, fleet) => set({ materials: unassignFromFleet(get().materials, code, fleet, Date.now()) }),
  toggleCell(area, row, col) {
    const cur = get().areas.find((a) => a.id === area.id); const next = toggleBlocked({ ...area, cells: { ...(cur?.cells ?? {}), ...area.cells } }, row, col);
    // keep cells hidden by a smaller grid, change only the visible one
    const cells = { ...(cur?.cells ?? {}) }; const k = cellKey(row, col); if (next.cells[k]) cells[k] = next.cells[k]; else delete cells[k];
    set({ areas: cur ? get().areas.map((a) => (a.id === area.id ? { ...a, cells } : a)) : [...get().areas, { id: area.id, name: area.name, rows: area.rows, cols: area.cols, cells }] });
  },
}));
export const useMasterData = <T,>(sel: (s: MasterDataState) => T) => useStore(masterDataStore, sel);

let timer: ReturnType<typeof setTimeout> | undefined;
masterDataStore.subscribe((s, p) => {
  if (s.materials === p.materials && s.groups === p.groups && s.areas === p.areas) return;
  clearTimeout(timer); timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify({ materials: s.materials, groups: s.groups, areas: s.areas })); } catch { /* no storage (tests / private mode) */ } }, 250);
});
