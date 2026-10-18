import { createPersistedStore } from '@/data/persistedStore';
import { useStore } from 'zustand';
import { services } from '@/services';
import { addGroup, addToGroup, deleteGroup, pruneMaterial, removeFromGroup, renameGroup } from './logic';
import type { FleetProfile, FleetProfiles } from './types';
import { fleetRef } from '@/data/fleetRef';
import type { FleetId } from '@/data/fleets';

export interface FleetsState {
  profiles: FleetProfiles;
  /** Point the fleet at a map (ignored when another fleet already has it: a map belongs to one fleet only). Station groups belong to the old map's stations, so they are cleared when the map changes. */
  assignMap(fleet: FleetId, mapId: string): void;
  /** Take the map away from the fleet. Its station groups belong to that map's stations, so they are cleared with it. */
  unassignMap(fleet: FleetId): void;
  /** The fleet was deleted: drop its profile (map and station groups). */
  removeProfile(fleet: FleetId): void;
  createGroup(fleet: FleetId, g: { name: string; stationId: string; codes: string[] }): void;
  renameGroup(fleet: FleetId, id: string, name: string): void;
  deleteGroup(fleet: FleetId, id: string): void;
  addToGroup(fleet: FleetId, id: string, codes: string[]): void;
  removeFromGroup(fleet: FleetId, id: string, code: string): void;
  /** A material was unassigned from the fleet: drop it from the fleet's groups. */
  pruneMaterial(fleet: FleetId, code: string): void;
}
const load = (): FleetProfiles => services().fleetProfiles.read();
/** Profiles saved under a fleet NAME are kept under its id from now on. */
const byFleetId = (saved: Record<string, FleetProfile>): FleetProfiles =>
  Object.fromEntries(Object.entries(saved).map(([k, v]) => [fleetRef(k), v])) as FleetProfiles;
/** What a fleet that has no profile yet looks like. */
export const EMPTY_PROFILE: FleetProfile = { mapId: null, groups: [] };
export const profileOf = (profiles: FleetProfiles, fleet: FleetId) => profiles[fleet] ?? EMPTY_PROFILE;

export const fleetsStore = createPersistedStore<FleetsState, Record<string, FleetProfile>>(
  {
    name: 'fleet profiles',
    read: load,
    save: (v) => services().fleetProfiles.save(v),
    pick: (s) => s.profiles,
    apply: (d) => ({ profiles: byFleetId(d) }),
    watch: ['profiles'],
    delayMs: 250,
    devHandle: '__fleets',
  },
  (set, get) => {
    const edit = (fleet: FleetId, f: (g: FleetProfile['groups']) => FleetProfile['groups']) => {
      const p = profileOf(get().profiles, fleet);
      set({ profiles: { ...get().profiles, [fleet]: { ...p, groups: f(p.groups) } } });
    };
    return {
      removeProfile: (fleet) => {
        const { [fleet]: _gone, ...rest } = get().profiles;
        set({ profiles: rest });
      },
      assignMap: (fleet, mapId) => {
        const p = profileOf(get().profiles, fleet);
        if (p.mapId === mapId) return;
        if (Object.entries(get().profiles).some(([name, q]) => name !== fleet && q.mapId === mapId)) return; // a map belongs to one fleet only
        set({ profiles: { ...get().profiles, [fleet]: { mapId, groups: [] } } });
      },
      unassignMap: (fleet) => set({ profiles: { ...get().profiles, [fleet]: { mapId: null, groups: [] } } }),
      createGroup: (fleet, g) => edit(fleet, (gs) => addGroup(gs, g)),
      renameGroup: (fleet, id, name) => edit(fleet, (gs) => renameGroup(gs, id, name)),
      deleteGroup: (fleet, id) => edit(fleet, (gs) => deleteGroup(gs, id)),
      addToGroup: (fleet, id, codes) => edit(fleet, (gs) => addToGroup(gs, id, codes)),
      removeFromGroup: (fleet, id, code) => edit(fleet, (gs) => removeFromGroup(gs, id, code)),
      pruneMaterial: (fleet, code) => edit(fleet, (gs) => pruneMaterial(gs, code)),
    };
  },
);
export const useFleets = <T>(sel: (s: FleetsState) => T) => useStore(fleetsStore, sel);
