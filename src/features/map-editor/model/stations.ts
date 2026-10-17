import type { StationType } from '@/core/types';
import { text } from '../text';
import type { MapData, MapStation } from './types';

/** Pure edits of the stations of a map (the draft). Each returns a NEW MapData and never touches the published versions. */
/** What a station is for on the floor. Pick-up / drop-off / buffer are not types: what happens at a station comes from the workflow, so those three all show as a plain Station. */
const stationType = (id: 'drop' | 'asrs' | 'charge' | 'park', color: string) => ({
  id: id as StationType,
  get label() {
    return text.stationTypes[id];
  },
  color,
});
export const STATION_TYPES: { id: StationType; label: string; color: string }[] = [
  stationType('drop', '#f59e0b'),
  stationType('asrs', '#14b8a6'),
  stationType('charge', '#3b82f6'),
  stationType('park', '#64748b'),
];
export const plainType = (t: StationType): StationType => (t === 'pick' || t === 'buffer' ? 'drop' : t);
export const stationColor = (t: StationType) => STATION_TYPES.find((x) => x.id === plainType(t))?.color ?? '#64748b';
export const stationTypeLabel = (t: StationType) => STATION_TYPES.find((x) => x.id === plainType(t))?.label ?? t;

const num = (id: string) => parseInt(id.replace(/\D/g, ''), 10) || 0;
/** The next free station id (STA-134...): above every id the map uses and every id in `taken` (stations of other maps, so an id means one place everywhere). */
export function nextStationId(data: MapData, taken: string[] = []): string {
  return `STA-${Math.max(100, ...data.stations.map((s) => num(s.id)), ...taken.map(num)) + 1}`;
}
export const nodeOf = (data: MapData, s: MapStation) => data.nodes.find((n) => n.id === s.nodeId);

/** A new station at a point of the floor. It is a point with no road yet (the roads come with the Routes tab). */
export function addStation(
  data: MapData,
  fleetLive: string,
  at: { x: number; y: number },
  taken: string[] = [],
  type: StationType = 'drop',
): { data: MapData; id: string } {
  const id = nextStationId(data, taken);
  const nodeId = `N-${id}`;
  const n = data.stations.length + 1;
  return {
    id,
    data: {
      ...data,
      nodes: [...data.nodes, { id: nodeId, x: round(at.x), y: round(at.y), kind: 'station' }],
      stations: [
        ...data.stations,
        { id, name: text.defaultNames.station(n), nodeId, type, zone: null, fleets: [fleetLive] },
      ],
    },
  };
}
const round = (v: number) => Math.round(v * 100) / 100;
export const updateStation = (
  data: MapData,
  id: string,
  patch: Partial<Pick<MapStation, 'name' | 'type' | 'angle' | 'onLane'>>,
): MapData => ({ ...data, stations: data.stations.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
export function moveStation(data: MapData, id: string, to: { x: number; y: number }): MapData {
  const s = data.stations.find((q) => q.id === id);
  if (!s) return data;
  return {
    ...data,
    nodes: data.nodes.map((n) => (n.id === s.nodeId ? { ...n, x: round(to.x), y: round(to.y) } : n)),
    // a station that was waiting for a position has one now
    stations: s.unplaced ? data.stations.map((q) => (q.id === id ? { ...q, unplaced: undefined } : q)) : data.stations,
  };
}
/** Delete a station. Its node goes too unless a lane still uses it (then it stays as a plain waypoint). */
export function deleteStation(data: MapData, id: string): MapData {
  const s = data.stations.find((q) => q.id === id);
  if (!s) return data;
  const inUse = data.lanes.some((l) => l.from === s.nodeId || l.to === s.nodeId);
  return {
    ...data,
    stations: data.stations.filter((q) => q.id !== id),
    nodes: inUse
      ? data.nodes.map((n) => (n.id === s.nodeId ? { ...n, kind: 'waypoint' as const } : n))
      : data.nodes.filter((n) => n.id !== s.nodeId),
  };
}
/** What is wrong with a name ('' = fine): empty, or already used by another station of the map (ignoring case). */
export function nameProblem(data: MapData, id: string, name: string): string {
  const t = name.trim();
  if (!t) return text.nameProblems.station.empty;
  return data.stations.some((s) => s.id !== id && s.name.trim().toLowerCase() === t.toLowerCase())
    ? text.nameProblems.station.taken
    : '';
}
