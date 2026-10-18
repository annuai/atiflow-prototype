import { useEffect, useState } from 'react';
import { fleetsStore } from '@/features/fleets';
import { mapVersionsStore } from '@/features/map-editor';
import { areasOfHistory } from './mapAreas';
import { masterDataStore } from './store';
import type { StagingArea } from './types';

/**
 * The staging areas of a fleet as they are NOW: its map's latest published version (position, size, entry station, retrieval order) with the contents Master Data keeps. Reads the stores directly
 * (requests, the workflow builder and search ask at the moment they need it). `usable` = has an entry station, so a workflow can send a robot there.
 */
export function fleetAreas(fleet: string | null): StagingArea[] {
  const mapId = fleet ? fleetsStore.getState().profiles[fleet]?.mapId : null;
  if (!mapId) return [];
  const stored = masterDataStore.getState().areas;
  return areasOfHistory(mapVersionsStore.getState().byMap[mapId], (id) => stored.find((a) => a.id === id))?.areas ?? [];
}
export const usableAreas = (fleet: string | null) => fleetAreas(fleet).filter((a) => !!a.stationId);
export const findFleetArea = (fleet: string | null, areaId: string) => fleetAreas(fleet).find((a) => a.id === areaId);
/** Is this id (a Station step's value) a staging area rather than a station? Areas are named SA-001, SA-002... */
export const isAreaId = (id: string) => /^SA-\d+$/i.test(id);

/** The usable areas of a fleet, kept up to date while the component is on screen. */
export function useFleetAreas(fleet: string | null): StagingArea[] {
  const [list, setList] = useState(() => usableAreas(fleet));
  useEffect(() => {
    const on = () => setList(usableAreas(fleet));
    on();
    const offs = [fleetsStore.subscribe(on), mapVersionsStore.subscribe(on), masterDataStore.subscribe(on)];
    return () => offs.forEach((o) => o());
  }, [fleet]);
  return list;
}
