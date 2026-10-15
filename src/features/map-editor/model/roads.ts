import type { Lane, NavNode } from '@/core/types';
import type { MapData, MapRoad, RoadHeading } from './types';

/**
 * Roads (pure). A road is one drawn line; it becomes TWO paired one-way lanes (keep right, 0.5 m off the centre line) joined to the nodes at its ends, or one lane when one-way.
 * Robots never reverse, so a two-way aisle is always two lanes. Ends snap to a node that is already there (a station, a junction, another road's end).
 */
export const LANE_OFFSET = 0.5,
  SNAP = 1.5,
  LANE_SPEED = 1.2;
type P = [number, number];
const round = (v: number) => Math.round(v * 100) / 100;
export const pathLength = (pts: P[]) =>
  pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/** The line moved `d` metres to the RIGHT of its direction of travel; bends use the mean of the two neighbouring normals (limited, so a sharp bend does not spike). */
export function offsetPolyline(pts: P[], d: number): P[] {
  const normal = (a: P, b: P): P => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l];
  };
  return pts.map((p, i) => {
    const n0 = i > 0 ? normal(pts[i - 1], p) : null,
      n1 = i < pts.length - 1 ? normal(p, pts[i + 1]) : null;
    const n = n0 && n1 ? [n0[0] + n1[0], n0[1] + n1[1]] : (n0 ?? n1 ?? [0, 0]);
    const l = Math.hypot(n[0], n[1]) || 1;
    const miter = n0 && n1 ? Math.min(2, 2 / l) : 1;
    return [round(p[0] + (n[0] / l) * d * miter), round(p[1] + (n[1] / l) * d * miter)] as P;
  });
}
const numOf = (id: string, prefix: string) => (id.startsWith(prefix) ? parseInt(id.slice(prefix.length), 10) || 0 : 0);
const nextLane = (d: MapData) => Math.max(0, ...d.lanes.map((l) => numOf(l.id, 'L'))) + 1;
const nextRoad = (d: MapData) => Math.max(0, ...d.roads.map((r) => numOf(r.id, 'R'))) + 1;
export const nearestNode = (nodes: NavNode[], x: number, y: number, within: number): NavNode | null => {
  let best: NavNode | null = null,
    bd = within;
  for (const n of nodes) {
    const dd = Math.hypot(n.x - x, n.y - y);
    if (dd <= bd) {
      bd = dd;
      best = n;
    }
  }
  return best;
};

export interface RoadOptions {
  oneWay?: boolean;
  fleetLive: string;
  name?: string;
  /** Keep this id (a road that is rebuilt after an edit). */ id?: string;
  /** Use these nodes for the two ends instead of snapping. */ nodeA?: string;
  nodeB?: string;
  heading?: RoadHeading;
}
/** Draw a road along `points` (at least two). Returns the new data and the road's id; unchanged data when the line is too short to be a road. */
export function addRoad(data: MapData, points: P[], opt: RoadOptions): { data: MapData; id: string | null } {
  const pts = points.reduce<P[]>(
    (a, p) =>
      !a.length || Math.hypot(p[0] - a[a.length - 1][0], p[1] - a[a.length - 1][1]) > 0.05
        ? [...a, [round(p[0]), round(p[1])]]
        : a,
    [],
  );
  if (pts.length < 2 || pathLength(pts) < 1) return { data, id: null };
  const num = opt.id ? numOf(opt.id, 'R') : nextRoad(data);
  const nodes = [...data.nodes];
  const end = (p: P, tag: string, forced?: string): NavNode => {
    const f = forced ? nodes.find((n) => n.id === forced) : undefined;
    if (f) return f;
    const hit = nearestNode(nodes, p[0], p[1], SNAP);
    if (hit) return hit;
    const n: NavNode = { id: `N-R${num}${tag}`, x: p[0], y: p[1], kind: 'waypoint' };
    nodes.push(n);
    return n;
  };
  const a = end(pts[0], 'a', opt.nodeA),
    b = end(pts[pts.length - 1], 'b', opt.nodeB);
  pts[0] = [a.x, a.y];
  pts[pts.length - 1] = [b.x, b.y];
  let n = nextLane(data);
  const lanes: Lane[] = [];
  const mk = (from: NavNode, to: NavNode, line: P[]): Lane => ({
    id: `L${n++}`,
    from: from.id,
    to: to.id,
    geom: offsetPolyline(line, LANE_OFFSET),
    fleets: [opt.fleetLive],
    speed: LANE_SPEED,
    len: round(pathLength(line)),
  });
  lanes.push(mk(a, b, pts));
  if (!opt.oneWay) lanes.push(mk(b, a, [...pts].reverse()));
  const road: MapRoad = {
    id: `R${num}`,
    name: opt.name?.trim() || `Road ${num}`,
    oneWay: !!opt.oneWay,
    points: pts,
    laneIds: lanes.map((l) => l.id),
    ...(opt.heading ? { heading: opt.heading } : {}),
  };
  return { id: road.id, data: { ...data, nodes, lanes: [...data.lanes, ...lanes], roads: [...data.roads, road] } };
}
export interface RoadPatch {
  points?: P[];
  oneWay?: boolean;
  heading?: RoadHeading;
  /** Reverse the direction of travel. */ swap?: boolean;
}
/**
 * Change a road: its end points, one lane or two, the direction, the heading setting. A change to the shape or lanes rebuilds the road's lanes (same id, same name); an end that was not moved keeps its
 * node, so the road stays joined to its neighbours and stations. The heading is only stored.
 */
export function updateRoad(data: MapData, id: string, patch: RoadPatch): MapData {
  const road = data.roads.find((r) => r.id === id);
  if (!road) return data;
  if (patch.points === undefined && patch.oneWay === undefined && !patch.swap)
    return { ...data, roads: data.roads.map((r) => (r.id === id ? { ...r, heading: patch.heading ?? r.heading } : r)) };
  const lane0 = data.lanes.find((l) => l.id === road.laneIds[0]);
  if (!lane0) return data;
  let pts = (patch.points ?? road.points).map((p) => [...p] as P);
  let nodeA: string | undefined = lane0.from,
    nodeB: string | undefined = lane0.to;
  const same = (p: P, q: P) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.005;
  if (patch.points) {
    if (!same(pts[0], road.points[0])) nodeA = undefined;
    if (!same(pts[pts.length - 1], road.points[road.points.length - 1])) nodeB = undefined;
  }
  if (patch.swap) {
    pts = pts.reverse();
    [nodeA, nodeB] = [nodeB, nodeA];
  }
  const lanes = data.lanes.filter((l) => !road.laneIds.includes(l.id));
  const base: MapData = { ...data, lanes, roads: data.roads.filter((r) => r.id !== id) };
  const r = addRoad(base, pts, {
    oneWay: patch.oneWay ?? road.oneWay,
    fleetLive: lane0.fleets[0],
    name: road.name,
    id,
    nodeA,
    nodeB,
    heading: patch.heading ?? road.heading,
  });
  if (!r.id) return data;
  const used = new Set([...r.data.lanes.flatMap((l) => [l.from, l.to]), ...r.data.stations.map((s) => s.nodeId)]);
  return {
    ...r.data,
    roads: [...r.data.roads].sort((a, b) => numOf(a.id, 'R') - numOf(b.id, 'R')),
    nodes: r.data.nodes.filter((n) => used.has(n.id) || !n.id.startsWith('N-R')),
  };
}
/** Direction of a road from its first to its last point in degrees (0 = east, counter-clockwise, 0..360). */
export const roadAngle = (r: Pick<MapRoad, 'points'>): number => {
  const a = r.points[0],
    b = r.points[r.points.length - 1];
  return Math.round(((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 360) % 360);
};
export const renameRoad = (data: MapData, id: string, name: string): MapData => ({
  ...data,
  roads: data.roads.map((r) => (r.id === id ? { ...r, name } : r)),
});
/** Delete a road and its lanes; nodes the road made (not stations, not used by another lane) go with it. */
export function deleteRoad(data: MapData, id: string): MapData {
  const road = data.roads.find((r) => r.id === id);
  if (!road) return data;
  const lanes = data.lanes.filter((l) => !road.laneIds.includes(l.id));
  const used = new Set([...lanes.flatMap((l) => [l.from, l.to]), ...data.stations.map((s) => s.nodeId)]);
  return {
    ...data,
    roads: data.roads.filter((r) => r.id !== id),
    lanes,
    nodes: data.nodes.filter((n) => used.has(n.id) || !n.id.startsWith('N-R')),
  };
}
export const roadLength = (r: MapRoad) => Math.round(pathLength(r.points) * 10) / 10;
export function nameProblem(data: MapData, id: string, name: string): string {
  const t = name.trim();
  if (!t) return 'Give the road a name';
  return data.roads.some((r) => r.id !== id && r.name.trim().toLowerCase() === t.toLowerCase())
    ? 'Another road already has this name'
    : '';
}

/** Group the lanes of an imported network into roads: two lanes running between the same two nodes in opposite directions are one road; a lane without a partner is a one-way road. */
export function roadsFromLanes(lanes: Lane[]): MapRoad[] {
  const byPair = new Map<string, Lane[]>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const l of lanes) byPair.set(key(l.from, l.to), [...(byPair.get(key(l.from, l.to)) ?? []), l]);
  return [...byPair.values()]
    .sort((x, y) => numOf(x[0].id, 'L') - numOf(y[0].id, 'L'))
    .map((ls, i) => {
      const fwd = ls.length > 1 && ls.some((l) => l.from !== ls[0].from) ? ls : ls;
      return {
        id: `R${i + 1}`,
        name: `Road ${i + 1}`,
        oneWay: fwd.length === 1,
        points: offsetPolyline(
          ls[0].geom.map((g) => [...g] as P),
          -LANE_OFFSET,
        ),
        laneIds: ls.map((l) => l.id),
      };
    });
}
