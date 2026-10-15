import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { addGroup, addToGroup, deleteGroup, pruneMaterial, removeFromGroup, renameGroup } from './logic';
import { EMPTY_PROFILE, SEED_PROFILES } from './seed';
import type { FleetProfile } from './types';

const KEY = 'atiflow.fleets.v1';
export interface FleetsState {
  profiles: Record<string, FleetProfile>;
  /** Point the fleet at a map. Station groups belong to the old map's stations, so they are cleared when the map changes. */
  assignMap(fleet: string, mapId: string): void;
  /** The fleet was renamed: move its profile to the new name. */
  renameProfile(from: string, to: string): void;
  createGroup(fleet: string, g: { name: string; stationId: string; codes: string[] }): void;
  renameGroup(fleet: string, id: string, name: string): void;
  deleteGroup(fleet: string, id: string): void;
  addToGroup(fleet: string, id: string, codes: string[]): void;
  removeFromGroup(fleet: string, id: string, code: string): void;
  /** A material was unassigned from the fleet: drop it from the fleet's groups. */
  pruneMaterial(fleet: string, code: string): void;
}
function load(): Record<string, FleetProfile> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw === 'object') return raw;
  } catch {
    /* fall through */
  }
  return SEED_PROFILES;
}
export const profileOf = (profiles: Record<string, FleetProfile>, fleet: string) => profiles[fleet] ?? EMPTY_PROFILE;

export const fleetsStore = createStore<FleetsState>((set, get) => {
  const edit = (fleet: string, f: (g: FleetProfile['groups']) => FleetProfile['groups']) => {
    const p = profileOf(get().profiles, fleet);
    set({ profiles: { ...get().profiles, [fleet]: { ...p, groups: f(p.groups) } } });
  };
  return {
    profiles: load(),
    renameProfile: (from, to) => {
      const { [from]: p, ...rest } = get().profiles;
      if (p) set({ profiles: { ...rest, [to]: p } });
    },
    assignMap: (fleet, mapId) => {
      const p = profileOf(get().profiles, fleet);
      if (p.mapId === mapId) return;
      set({ profiles: { ...get().profiles, [fleet]: { mapId, groups: [] } } });
    },
    createGroup: (fleet, g) => edit(fleet, (gs) => addGroup(gs, g)),
    renameGroup: (fleet, id, name) => edit(fleet, (gs) => renameGroup(gs, id, name)),
    deleteGroup: (fleet, id) => edit(fleet, (gs) => deleteGroup(gs, id)),
    addToGroup: (fleet, id, codes) => edit(fleet, (gs) => addToGroup(gs, id, codes)),
    removeFromGroup: (fleet, id, code) => edit(fleet, (gs) => removeFromGroup(gs, id, code)),
    pruneMaterial: (fleet, code) => edit(fleet, (gs) => pruneMaterial(gs, code)),
  };
});
export const useFleets = <T>(sel: (s: FleetsState) => T) => useStore(fleetsStore, sel);

let timer: ReturnType<typeof setTimeout> | undefined;
fleetsStore.subscribe((s, p) => {
  if (s.profiles === p.profiles) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s.profiles));
    } catch {
      /* no storage */
    }
  }, 250);
});
