import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { services } from '@/services';
import type { FleetMap } from './types';

const NOW = Date.now(),
  MIN = 60_000,
  H = 60 * MIN,
  DAY = 24 * H; // PLACEHOLDER update times until real maps carry their own

/** The maps that are part of the system. (Generating or importing new maps is not defined yet, so this is the whole list.) */
export const SYSTEM_MAPS: FleetMap[] = [
  {
    id: 'main-assembly',
    name: 'Main_Assembly_Hall_Engine_Bay_All',
    version: 5,
    tag: 'Waypoint v5',
    fleetLive: 'line-side',
    updatedAt: NOW - 62 * MIN,
    stations: [
      { id: 'ST-01', name: 'Engine Bay Line 2' },
      { id: 'ST-02', name: 'Kitting Area' },
      { id: 'ST-03', name: 'Assembly Line 1' },
      { id: 'ST-04', name: 'Packing Zone' },
    ],
  },
  {
    id: 'assembly-east',
    name: 'Assembly_Hall_East_All',
    version: 2,
    tag: 'Waypoint v2',
    fleetLive: 'asrs',
    updatedAt: NOW - 9 * DAY,
    stations: [
      { id: 'ST-01', name: 'Line A Feeder' },
      { id: 'ST-02', name: 'Sub-Assembly Cell' },
      { id: 'ST-03', name: 'Inspection Bay' },
    ],
  },
];

/** Names chosen in the Map Editor, saved in this browser (the name is not part of a map version: renaming never needs a draft). */
const savedNames = (): Record<string, string> => services().mapNames.read() ?? {};
const withNames = (maps: FleetMap[]) => {
  const n = savedNames();
  return maps.map((m) => (n[m.id] ? { ...m, name: n[m.id] } : m));
};

export const mapsStore = createStore<{ maps: FleetMap[] }>(() => ({ maps: withNames(SYSTEM_MAPS) }));
/** The text of a refused map name ('' = fine): not empty, not used by another map (ignoring case). */
export const mapNameError = (id: string, name: string): string => {
  const n = name.trim();
  if (!n) return 'Enter a name for the map.';
  return mapsStore.getState().maps.some((m) => m.id !== id && m.name.toLowerCase() === n.toLowerCase())
    ? 'Another map already has this name.'
    : '';
};
/** Rename a map; returns an error text, or '' when it was saved. */
export function renameMap(id: string, name: string): string {
  const e = mapNameError(id, name);
  if (e) return e;
  const n = name.trim();
  mapsStore.setState({ maps: mapsStore.getState().maps.map((m) => (m.id === id ? { ...m, name: n } : m)) });
  void services().mapNames.save({ ...savedNames(), [id]: n });
  return '';
}
export const useMaps = () => useStore(mapsStore, (s) => s.maps);
export const useMap = (id: string | null) => useStore(mapsStore, (s) => s.maps.find((m) => m.id === id) ?? null);
export const mapById = (id: string | null) => mapsStore.getState().maps.find((m) => m.id === id) ?? null;
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __maps: mapsStore }); // dev-only handle (e.g. empty the list to see the empty state)
