import { createStore } from 'zustand/vanilla';
import { registerStoreInit } from '@/data/storeInit';
import { createPersister, withoutSaving } from '@/data/persist';
import { useStore } from 'zustand';
import { services } from '@/services';
import { addGroup, addToGroup, deleteGroup, pruneMaterial, removeFromGroup, renameGroup } from './logic';
import type { FleetProfile } from './types';

export interface FleetsState {
  profiles: Record<string, FleetProfile>;
  /** Point the fleet at a map. Station groups belong to the old map's stations, so they are cleared when the map changes. */
  assignMap(fleet: string, mapId: string): void;
  /** Take the map away from the fleet. Its station groups belong to that map's stations, so they are cleared with it. */
  unassignMap(fleet: string): void;
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
const load = (): Record<string, FleetProfile> => services().fleetProfiles.read();
/** What a fleet that has no profile yet looks like. */
export const EMPTY_PROFILE: FleetProfile = { mapId: null, groups: [] };
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
    unassignMap: (fleet) => set({ profiles: { ...get().profiles, [fleet]: { mapId: null, groups: [] } } }),
    createGroup: (fleet, g) => edit(fleet, (gs) => addGroup(gs, g)),
    renameGroup: (fleet, id, name) => edit(fleet, (gs) => renameGroup(gs, id, name)),
    deleteGroup: (fleet, id) => edit(fleet, (gs) => deleteGroup(gs, id)),
    addToGroup: (fleet, id, codes) => edit(fleet, (gs) => addToGroup(gs, id, codes)),
    removeFromGroup: (fleet, id, code) => edit(fleet, (gs) => removeFromGroup(gs, id, code)),
    pruneMaterial: (fleet, code) => edit(fleet, (gs) => pruneMaterial(gs, code)),
  };
});
export const useFleets = <T>(sel: (s: FleetsState) => T) => useStore(fleetsStore, sel);

const persist = createPersister(
  'fleet profiles',
  (v: Record<string, FleetProfile>) => services().fleetProfiles.save(v),
  { delayMs: 250 },
);
fleetsStore.subscribe((s, p) => {
  if (s.profiles !== p.profiles) persist.queue(s.profiles);
});

registerStoreInit(() => withoutSaving(() => fleetsStore.setState({ profiles: load() })));
if (import.meta.env?.DEV && typeof window !== 'undefined') Object.assign(window, { __fleets: fleetsStore }); // dev-only handle for console testing
