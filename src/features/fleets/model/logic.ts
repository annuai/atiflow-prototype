import type { FleetMap, StationGroup } from './types';
import { t } from '../text';
import type { FleetId } from '@/data/fleets';

/** The maps a fleet may be given: a map belongs to ONE fleet, so those another fleet already runs on are left out (the fleet's own map stays, it is the current one). */
export const availableMaps = <M extends { id: string }>(
  maps: M[],
  profiles: Record<string, { mapId: string | null }>,
  fleet: FleetId,
): M[] => maps.filter((m) => !Object.entries(profiles).some(([name, p]) => name !== fleet && p.mapId === m.id));

/** Station ids whose group holds this material (the "Station goods at" column). */
export const stationsOfMaterial = (groups: StationGroup[], code: string) =>
  groups.filter((g) => g.codes.includes(code)).map((g) => g.stationId);

/** Stations of the map that do not have a group yet (a station can be grouped once). */
export const freeStations = (map: FleetMap | null, groups: StationGroup[]) =>
  (map?.stations ?? []).filter((s) => !groups.some((g) => g.stationId === s.id));

export function validateGroupForm(
  v: { name: string; stationId: string; codes: string[] },
  groups: StationGroup[],
  editing?: string,
): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = t.fleets.errors.groupName;
  else if (groups.some((g) => g.id !== editing && g.name.trim().toLowerCase() === v.name.trim().toLowerCase()))
    e.name = t.fleets.errors.groupExists(v.name.trim());
  if (!editing && !v.stationId) e.stationId = t.fleets.errors.station;
  else if (!editing && groups.some((g) => g.stationId === v.stationId)) e.stationId = t.fleets.errors.stationHasGroup;
  if (!editing && v.codes.length === 0) e.codes = t.fleets.errors.codes;
  return e;
}

export const addGroup = (
  groups: StationGroup[],
  g: { name: string; stationId: string; codes: string[] },
): StationGroup[] => [...groups, { id: g.stationId, stationId: g.stationId, name: g.name.trim(), codes: g.codes }];
export const renameGroup = (groups: StationGroup[], id: string, name: string) =>
  groups.map((g) => (g.id === id ? { ...g, name: name.trim() } : g));
export const deleteGroup = (groups: StationGroup[], id: string) => groups.filter((g) => g.id !== id);
export const addToGroup = (groups: StationGroup[], id: string, codes: string[]) =>
  groups.map((g) => (g.id === id ? { ...g, codes: [...new Set([...g.codes, ...codes])] } : g));
export const removeFromGroup = (groups: StationGroup[], id: string, code: string) =>
  groups.map((g) => (g.id === id ? { ...g, codes: g.codes.filter((c) => c !== code) } : g));
/** A material left the fleet: it also leaves every group. */
export const pruneMaterial = (groups: StationGroup[], code: string) =>
  groups.map((g) => (g.codes.includes(code) ? { ...g, codes: g.codes.filter((c) => c !== code) } : g));

/** A fleet can be made once the site has at least one map (a fleet is where a map and robots come together). Later fleets may be made without a map when every map is already taken by another fleet. */
export const canCreateFleet = (maps: number) => maps > 0;
