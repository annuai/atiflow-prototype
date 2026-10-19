import type { MapData, MapRoad, MapStation } from '@/features/map-editor';
import type { PyObj } from '../pyjson';
import type { Doc } from '../tree';

export type P = [number, number];
/** Our road points are rounded to 0.01 m: that much difference is not an edit. */
export const TOL = 0.0075;
export const near = (a: P, b: P, t = TOL) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= t;
export const rad = (deg: number) => (deg * Math.PI) / 180;

/** Everything the parts of the v2 patch share. */
export interface V2 {
  data: MapData;
  wp: Doc;
  attrs: Doc | null;
  /** `map_editor` of waypoints.json: the stations, routes and waypoints of the map */
  stations: PyObj;
  routes: PyObj;
  nodes: PyObj;
  /** the Deployment Manager's own copies: station records and the pieces every route is cut into */
  aStations: PyObj;
  aLines: PyObj;
  placed: Map<string, { x: number; y: number }>;
}

export interface Spec {
  ext?: string;
  from: string;
  to: string;
  direction: 'forward' | 'reverse';
  radius: number;
  /** the radius at each waypoint */
  radii: number[];
  /** station, waypoints, station */
  points: P[];
  inplace?: number;
  /** the road this route is (a two-way road is two routes) */
  road: MapRoad;
  back: boolean;
}

/** Our roads as routes: each road runs between the nodes of two stations; a two-way road is two routes (the second the same way back). */
export function specsOf(data: MapData): Spec[] {
  const byNode = new Map(data.stations.map((s) => [s.nodeId, s]));
  const lane0 = (r: MapRoad) => data.lanes.find((l) => l.id === r.laneIds[0]);
  const nodeAt = new Map(data.nodes.map((n) => [n.id, n]));
  // the two ends of a route are its stations, wherever they stand now
  const ends = (r: MapRoad, a: MapStation, b: MapStation): P[] => {
    const na = nodeAt.get(a.nodeId),
      nb = nodeAt.get(b.nodeId);
    return [
      na ? [na.x, na.y] : r.points[0],
      ...r.points.slice(1, -1),
      nb ? [nb.x, nb.y] : r.points[r.points.length - 1],
    ] as P[];
  };
  const out: Spec[] = [];
  for (const r of data.roads) {
    const l = lane0(r);
    const a = l && byNode.get(l.from),
      b = l && byNode.get(l.to);
    if (!a?.externalId || !b?.externalId) continue; // a route of a point-to-point map joins two stations
    const dm = (r.extra?.dm ?? {}) as { externalId?: unknown; reverseId?: unknown; inplace?: unknown };
    const nodeRadii = r.points.slice(1, -1).map((_, i) => r.nodeRadii?.[i] ?? r.radius ?? 1);
    const common = {
      radius: r.radius ?? 1,
      direction: r.heading === 'backward' ? ('reverse' as const) : ('forward' as const),
    };
    out.push({
      ext: dm.externalId !== undefined ? String(dm.externalId) : undefined,
      from: a.externalId,
      to: b.externalId,
      points: ends(r, a, b),
      radii: nodeRadii,
      inplace: typeof dm.inplace === 'number' ? dm.inplace : undefined,
      road: r,
      back: false,
      ...common,
    });
    if (!r.oneWay)
      out.push({
        ext: dm.reverseId !== undefined ? String(dm.reverseId) : undefined,
        from: b.externalId,
        to: a.externalId,
        points: ends(r, a, b).reverse(),
        radii: [...nodeRadii].reverse(),
        road: r,
        back: true,
        ...common,
      });
  }
  return out;
}
