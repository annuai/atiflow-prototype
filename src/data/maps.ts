import { createStore } from 'zustand/vanilla';
import { registerStoreInit } from '@/data/storeInit';
import { createPersister } from '@/data/persist';
import { useStore } from 'zustand';
import { services } from '@/services';
import { localized } from '@/i18n';

const t = localized('devices');

export interface MapStation {
  id: string;
  name: string;
}
/** A site map known to the system. Stations belong to the map, so a fleet can only group materials at its own map's stations. */
export interface FleetMap {
  id: string;
  name: string;
  version: number;
  tag: string;
  /** The lane-map fleet that runs this map: its lanes, areas and stations are what the thumbnail draws ('' for an imported map: no fleet runs it yet). */
  fleetLive: string;
  /** When the map was last changed (epoch ms). */
  updatedAt: number;
  stations: MapStation[];
  /** 'imported' = made from a Deployment Manager map file (its picture is a stored floor image). */
  source?: 'imported';
}

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
const savedNames = (): Record<string, string> => services().mapNames.read();
const withNames = (maps: FleetMap[]) => {
  const n = savedNames();
  return maps.map((m) => (n[m.id] ? { ...m, name: n[m.id] } : m));
};
/** Maps that were imported from a file: the built-in ones are code, these are saved. */
const allMaps = () => withNames([...SYSTEM_MAPS, ...services().mapCatalog.read()]);
const catalogPersist = createPersister('imported maps', (v: FleetMap[]) => services().mapCatalog.save(v));

const namePersist = createPersister('map names', (v: Record<string, string>) => services().mapNames.save(v));
export const mapsStore = createStore<{ maps: FleetMap[] }>(() => ({ maps: allMaps() }));
/** The text of a refused map name ('' = fine): not empty, not used by another map (ignoring case). */
export const mapNameError = (id: string, name: string): string => {
  const n = name.trim();
  if (!n) return t.maps.nameEmpty;
  return mapsStore.getState().maps.some((m) => m.id !== id && m.name.toLowerCase() === n.toLowerCase())
    ? t.maps.nameTaken
    : '';
};
/** Rename a map; returns an error text, or '' when it was saved. */
export function renameMap(id: string, name: string): string {
  const e = mapNameError(id, name);
  if (e) return e;
  const n = name.trim();
  mapsStore.setState({ maps: mapsStore.getState().maps.map((m) => (m.id === id ? { ...m, name: n } : m)) });
  namePersist.queue({ ...savedNames(), [id]: n });
  return '';
}
/** Add a map made by an import (it stays until someone removes it; the first version is created by the caller). */
export function addImportedMap(map: FleetMap) {
  mapsStore.setState({ maps: [...mapsStore.getState().maps, map] });
  catalogPersist.queue(mapsStore.getState().maps.filter((m) => m.source === 'imported'));
}
registerStoreInit(() => mapsStore.setState({ maps: allMaps() }));
export const useMaps = () => useStore(mapsStore, (s) => s.maps);
export const useMap = (id: string | null) => useStore(mapsStore, (s) => s.maps.find((m) => m.id === id) ?? null);
export const mapById = (id: string | null) => mapsStore.getState().maps.find((m) => m.id === id) ?? null;
if (import.meta.env.DEV && typeof window !== 'undefined') Object.assign(window, { __maps: mapsStore }); // dev-only handle (e.g. empty the list to see the empty state)
