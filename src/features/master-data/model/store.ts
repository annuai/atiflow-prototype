import { createPersistedStore } from '@/data/persistedStore';
import { useStore } from 'zustand';
import { services } from '@/services';
import {
  applyEdit,
  commitDrop,
  giveBack,
  normaliseAreas,
  planPick,
  pushLog,
  releaseCells,
  releaseDrop,
  reserveDrop,
  takePick,
  type CellEdit,
  type CellError,
} from './cells';
import { assignToFleet, ensureGroup, mergeMaterials, unassignFromFleet } from './logic';
import type { CellPlan, IncomingMaterial, Material, MaterialGroup, StagingArea } from './types';

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
  /**
   * A request takes material out of an area (pieces are removed now, in the area's FIFO / LIFO order) and / or reserves a cell in an area for what arrives. All or nothing: when an area does not
   * hold enough, or is full, nothing changes and the reason is returned.
   */
  reserveForTrip(spec: {
    tripId: string;
    pick?: { area: StagingArea; code: string; qty: number };
    drop?: { area: StagingArea; code: string; qty: number };
  }):
    | { ok: true; plan: CellPlan }
    | {
        ok: false;
        reason: { kind: 'not-enough' | 'full'; areaId: string; areaName: string; code: string; have: number };
      };
  /** The trip is over: its material arrived (`committed`: the reserved cell is filled) or it will not happen (`released`: the pieces go back, the cell is free). */
  settleTrip(
    plan: CellPlan,
    tripId: string,
    how: 'committed' | 'released',
    areas: (id: string) => StagingArea | undefined,
  ): CellPlan;
  /** A person lets go of reservations. */
  releaseCells(area: StagingArea, keys: string[], by: string): void;
}

const load = (): Pick<MasterDataState, 'materials' | 'groups' | 'areas'> => {
  const d = services().masterData.read();
  return { ...d, areas: normaliseAreas(d.areas as never) }; // (data saved before cells held materials is upgraded here)
};

export const masterDataStore = createPersistedStore<
  MasterDataState,
  Pick<MasterDataState, 'materials' | 'groups' | 'areas'>
>(
  {
    name: 'master data',
    read: load,
    save: (v) => services().masterData.save(v),
    pick: (s) => ({ materials: s.materials, groups: s.groups, areas: s.areas }),
    apply: (d) => ({ ...d }),
    watch: ['materials', 'groups', 'areas'],
    delayMs: 250,
  },
  (set, get) => {
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
      unassignMaterial: (code, fleet) =>
        set({ materials: unassignFromFleet(get().materials, code, fleet, Date.now()) }),
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
      reserveForTrip({ tripId, pick, drop }) {
        const now = Date.now();
        const stored = (id: string) => get().areas.find((a) => a.id === id)?.cells ?? {};
        const plan: CellPlan = {};
        // check both before changing anything
        let pickItems: ReturnType<typeof planPick> = null;
        if (pick) {
          pickItems = planPick({ cells: stored(pick.area.id), retrieval: pick.area.retrieval }, pick.code, pick.qty);
          if (!pickItems) {
            const have = Object.values(stored(pick.area.id)).reduce(
              (n, c) => n + (c.state === 'filled' && c.materialCode === pick.code ? (c.quantity ?? 1) : 0),
              0,
            );
            return {
              ok: false,
              reason: { kind: 'not-enough', areaId: pick.area.id, areaName: pick.area.name, code: pick.code, have },
            };
          }
        }
        // (taking out first, so that a trip that picks up and drops off in the same area can use the room it makes)
        let working: StagingArea | undefined;
        if (pick && pickItems) {
          const base = get().areas.find((a) => a.id === pick.area.id) ?? { ...pick.area, cells: {} };
          const taken = takePick(base.cells, { areaId: pick.area.id, code: pick.code, items: pickItems }, tripId, now);
          working = { ...base, cells: taken.cells, log: pushLog(base.log, taken.log) };
          plan.pick = { areaId: pick.area.id, code: pick.code, items: pickItems };
        }
        let reservedKey: string | null = null;
        if (drop) {
          const same = working && working.id === drop.area.id;
          const base = same
            ? working!
            : (get().areas.find((a) => a.id === drop.area.id) ?? { ...drop.area, cells: {} });
          const r = reserveDrop(
            { rows: drop.area.rows, cols: drop.area.cols, cells: base.cells },
            drop.code,
            drop.qty,
            tripId,
            now,
          );
          if (!r)
            return {
              ok: false,
              reason: { kind: 'full', areaId: drop.area.id, areaName: drop.area.name, code: drop.code, have: 0 },
            };
          reservedKey = r.key;
          const next = { ...base, cells: r.cells, log: pushLog(base.log, r.log) };
          if (same) working = next;
          else write(base, { cells: next.cells, log: next.log });
          plan.drop = { areaId: drop.area.id, code: drop.code, key: r.key, qty: drop.qty };
        }
        if (working) write(working, { cells: working.cells, log: working.log });
        void reservedKey;
        return { ok: true, plan };
      },
      settleTrip(plan, tripId, how, areas) {
        if (plan.settled) return plan;
        const now = Date.now();
        const rec = (id: string) =>
          get().areas.find((a) => a.id === id) ?? (areas(id) ? { ...areas(id)!, cells: {} } : undefined);
        if (plan.drop) {
          const a = rec(plan.drop.areaId);
          if (a) {
            const r =
              how === 'committed'
                ? commitDrop(a.cells, plan.drop.key, tripId, now)
                : releaseDrop(a.cells, plan.drop.key, tripId, now);
            if (r.log.length) write(a, { cells: r.cells, log: pushLog(a.log, r.log) });
          }
        }
        if (plan.pick && how === 'released') {
          const a = rec(plan.pick.areaId);
          if (a) {
            const r = giveBack(a, plan.pick, tripId, now);
            write(a, { cells: r.cells, log: pushLog(a.log, r.log) });
          }
        }
        return { ...plan, settled: how };
      },
      releaseCells(area, keys, by) {
        const base = get().areas.find((a) => a.id === area.id) ?? { ...area, cells: {} };
        const r = releaseCells(base.cells, keys, by, Date.now());
        if (r.ok && r.log.length) write(base, { cells: r.cells, log: pushLog(base.log, r.log) });
      },
    };
  },
);
export const useMasterData = <T>(sel: (s: MasterDataState) => T) => useStore(masterDataStore, sel);
