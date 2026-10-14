import { useEffect, useState } from 'react';
import { fleetDirectory } from '@/data/fleetDirectory';
import type { NavGraph, SiteLayout, Station } from '@/core/types';
import { feed } from '@/features/live-floor/liveFeed';
import type { WfNode } from './types';

/**
 * The stations of a workflow are the stations of the MAP (the same site and lane map the Live Floor shows), not a list of names: a fleet offers the work stations of its lane map
 * (pick, drop, buffer, ASRS; never parking spots or chargers). The map is loaded once and kept; until it is there a fleet has no stations.
 */
export interface MapData { site: SiteLayout; nav: NavGraph }
let loaded: MapData | null = null; let loading: Promise<MapData> | null = null; const listeners = new Set<() => void>();
export function loadMap(): Promise<MapData> {
  return (loading ??= feed.ready().then((m) => { loaded = m; listeners.forEach((l) => l()); return m; }));
}
export const mapNow = () => loaded;
export function useMapData(): MapData | null {
  const [m, setM] = useState(loaded);
  useEffect(() => { const on = () => setM(loaded); listeners.add(on); void loadMap(); on(); return () => { listeners.delete(on); }; }, []);
  return m;
}

const isWork = (s: Station) => s.type !== 'charge' && s.type !== 'park';
/** The lane-map fleet id a fleet name stands for. */
export const liveIdOf = (fleet: string | null) => { const f = fleet ? fleetDirectory.byName(fleet) : null; return f ? f.liveId ?? f.id : null; };
/** The work stations a fleet can use on the map (ids like STA-101), in map order. Empty until the map is loaded or for a fleet that has no map. */
export function fleetStations(fleet: string | null, map: MapData | null = loaded): Station[] {
  const id = liveIdOf(fleet); return map && id ? map.nav.stations.filter((s) => isWork(s) && s.fleets.includes(id)) : [];
}
export function useFleetStations(fleet: string | null): Station[] { const m = useMapData(); return m ? fleetStations(fleet, m) : []; }
export const stationLabel = (s: Station) => `${s.id} · ${s.name}`;

/** The station field of a node (Station, If Logic and Confirm nodes), if it has one: its current value(s) and whether it holds several (branch stations). */
export function stationField(n: WfNode | null | undefined): { ids: string[]; multi: boolean } | null {
  if (!n || (n.t !== 'station' && n.t !== 'logic' && n.t !== 'confirm')) return null; const v = n.f.station;
  return { ids: (Array.isArray(v) ? v : [v as string]).filter(Boolean) as string[], multi: Array.isArray(v) };
}
