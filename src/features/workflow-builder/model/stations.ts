import { useEffect, useState } from 'react';
import { fleetDirectory } from '@/data/fleetDirectory';
import type { SceneModel } from '@/core/scene';
import type { NavGraph, SiteLayout, Station } from '@/core/types';
import { feed } from '@/features/live-floor';
import type { WfNode } from './types';

/**
 * The stations of a workflow are the stations of the MAP (the same site and lane map the Live Floor shows), not a list of names: a fleet offers the work stations of its lane map
 * (pick, drop, buffer, ASRS; never parking spots or chargers). The map is loaded once and kept; until it is there a fleet has no stations.
 */
export interface MapData {
  /** The BASE site and lane map: what a first version of a map is seeded from. */
  site: SiteLayout;
  nav: NavGraph;
  /** What the floor runs on now: the stations of every fleet that has a map (use this for anything a fleet can drive to). */
  live: NavGraph;
  /** one scene per fleet that is on the floor: its map's building and the network that fleet drives on (the latest PUBLISHED version of its map) */
  scenes?: SceneModel[];
}
let loaded: MapData | null = null;
let loading: Promise<MapData> | null = null;
const listeners = new Set<() => void>();
export function loadMap(): Promise<MapData> {
  return (loading ??= feed.ready().then((m) => {
    loaded = { ...m, scenes: m.world.scenes };
    listeners.forEach((l) => l());
    // a fleet that got a map, a map that was published: the stations a fleet can use changed
    feed.onWorld(
      () => void feed.ready().then((n) => ((loaded = { ...n, scenes: n.world.scenes }), listeners.forEach((l) => l()))),
    );
    return m;
  }));
}
export const mapNow = () => loaded;
export function useMapData(): MapData | null {
  const [m, setM] = useState(loaded);
  useEffect(() => {
    const on = () => setM(loaded);
    listeners.add(on);
    void loadMap();
    on();
    return () => {
      listeners.delete(on);
    };
  }, []);
  return m;
}

const isWork = (s: Station) => s.type !== 'charge' && s.type !== 'park';
/** The lane-map fleet id a fleet name stands for. */
export const liveIdOf = (fleet: string | null) => {
  const f = fleet ? fleetDirectory.byName(fleet) : null;
  return f ? (f.liveId ?? f.id) : null;
};
/** The work stations a fleet can use on the map (ids like STA-101), in map order. Empty until the map is loaded or for a fleet that has no map. */
export function fleetStations(fleet: string | null, map: MapData | null = loaded): Station[] {
  const id = liveIdOf(fleet);
  return map && id ? map.live.stations.filter((s) => isWork(s) && s.fleets.includes(id)) : [];
}
export function useFleetStations(fleet: string | null): Station[] {
  const m = useMapData();
  return m ? fleetStations(fleet, m) : [];
}
/**
 * The map of a fleet as the configurator draws it (flat, 2D): that fleet's own scene, built from the LATEST PUBLISHED version of the map it runs on (a map nobody edited is the base lane
 * map). `undefined` while the floor is still loading; `null` when the fleet has no published map to show.
 */
export function fleetScene(
  fleet: string | null,
  map: MapData | null = loaded,
): { site: SiteLayout; nav: NavGraph } | null | undefined {
  if (!map?.scenes) return undefined;
  const id = liveIdOf(fleet);
  const sc = id ? map.scenes.find((s) => s.fleetId === id) : undefined;
  return sc ? { site: sc.site, nav: sc.network } : null;
}
export function useFleetScene(fleet: string | null) {
  const m = useMapData();
  return fleetScene(fleet, m);
}
export const stationLabel = (s: Station) => `${s.id} · ${s.name}`;

/** The station field of a node (Station and If Logic nodes), if it has one: its current value(s) and whether it holds several (branch stations). */
export function stationField(n: WfNode | null | undefined): { ids: string[]; multi: boolean } | null {
  if (!n || (n.t !== 'station' && n.t !== 'logic')) return null;
  const v = n.f.station;
  return { ids: (Array.isArray(v) ? v : [v as string]).filter(Boolean) as string[], multi: Array.isArray(v) };
}
