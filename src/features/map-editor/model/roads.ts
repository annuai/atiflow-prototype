import { text } from '../text';
import { routeLine } from './fillet';
import type { Lane, NavNode } from '@/core/types';
import type { MapData, MapRoad, RoadHeading } from './types';

/**
 * Roads (pure). A road is one drawn line; it becomes TWO paired one-way lanes (keep right, 0.5 m off the centre line) joined to the nodes at its ends, or one lane when one-way.
 * Robots never reverse, so a two-way aisle is always two lanes. Ends snap to a node that is already there (a station, a junction, another road's end).
 */
const LANE_OFFSET = 0.5,
  SNAP = 1.5,
  LANE_SPEED = 1.2;
type P = [number, number];
const round = (v: number) => Math.round(v * 100) / 100;
const pathLength = (pts: P[]) =>
  pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/** The line moved `d` metres to the RIGHT of its direction of travel; bends use the mean of the two neighbouring normals (limited, so a sharp bend does not spike). */
function offsetPolyline(pts: P[], d: number): P[] {
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
  /** Every fleet that drives the road (default: just `fleetLive`): a road cut in two keeps all of them. */
  fleets?: string[];
  name?: string;
  /** Keep this id (a road that is rebuilt after an edit). */ id?: string;
  /** Use these nodes for the two ends instead of snapping. */ nodeA?: string;
  nodeB?: string;
  heading?: RoadHeading;
  /** Custom router cost of the road (default: its length). */
  weight?: number;
  /** Source fields of an imported road, kept on it. */ extra?: Record<string, unknown>;
  /** How close (m) an end must be to an existing node to join it; default 1.5. An import uses a tight value: its junctions share exact points. */
  snap?: number;
  /** Accept a road shorter than 1 m (the stubs a source map really has). */
  allowShort?: boolean;
  /** Metres between a lane and the centre line (default 0.5, keep right; a point-to-point route is driven on its own line: 0). */
  offset?: number;
  /** Round the corners with turns of this radius (point-to-point routes). */
  radius?: number;
  /** Radius of each bend node (the points between the ends), overriding `radius`. */
  nodeRadii?: number[];
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
  if (pts.length < 2 || pathLength(pts) < (opt.allowShort ? 0.3 : 1)) return { data, id: null };
  const num = opt.id ? numOf(opt.id, 'R') : nextRoad(data);
  const nodes = [...data.nodes];
  const end = (p: P, tag: string, forced?: string): NavNode => {
    const f = forced ? nodes.find((n) => n.id === forced) : undefined;
    if (f) return f;
    const hit = nearestNode(nodes, p[0], p[1], opt.snap ?? SNAP);
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
    geom: offsetPolyline(
      opt.radius
        ? routeLine(line, opt.radius, line === pts ? opt.nodeRadii : [...(opt.nodeRadii ?? [])].reverse())
        : line,
      opt.offset ?? LANE_OFFSET,
    ),
    fleets: opt.fleets ?? [opt.fleetLive],
    speed: LANE_SPEED,
    len: round(pathLength(line)),
    ...(opt.weight ? { weight: opt.weight } : {}),
  });
  lanes.push(mk(a, b, pts));
  if (!opt.oneWay) lanes.push(mk(b, a, [...pts].reverse()));
  const road: MapRoad = {
    id: `R${num}`,
    name: opt.name?.trim() || text.defaultNames.road(num),
    oneWay: !!opt.oneWay,
    points: pts,
    laneIds: lanes.map((l) => l.id),
    ...(opt.heading ? { heading: opt.heading } : {}),
    ...(opt.weight ? { weight: opt.weight } : {}),
    ...(opt.extra ? { extra: opt.extra } : {}),
    ...(opt.radius ? { radius: opt.radius } : {}),
    ...(opt.radius && opt.nodeRadii ? { nodeRadii: opt.nodeRadii } : {}),
  };
  return { id: road.id, data: { ...data, nodes, lanes: [...data.lanes, ...lanes], roads: [...data.roads, road] } };
}
export interface RoadPatch {
  points?: P[];
  oneWay?: boolean;
  heading?: RoadHeading;
  /** The custom router cost (null = back to the default, the length). */
  weight?: number | null;
  /** Reverse the direction of travel. */ swap?: boolean;
  /** Point-to-point (v2) routes: the radius of the turns. */ radius?: number;
  /** Point-to-point (v2) routes: the radius at each bend node. */ nodeRadii?: number[];
}
/**
 * Change a road: its end points, one lane or two, the direction, the heading setting. A change to the shape or lanes rebuilds the road's lanes (same id, same name); an end that was not moved keeps its
 * node, so the road stays joined to its neighbours and stations. The heading is only stored.
 */
/** The settings that change no geometry (heading, custom weight): the road and its lanes are only updated. */
function setRoadSettings(data: MapData, id: string, patch: RoadPatch): MapData {
  const weight = patch.weight === undefined ? undefined : (patch.weight ?? null);
  return {
    ...data,
    roads: data.roads.map((r) => {
      if (r.id !== id) return r;
      const { weight: _w, ...rest } = r;
      const w = weight === undefined ? r.weight : (weight ?? undefined);
      return { ...rest, heading: patch.heading ?? r.heading, ...(w ? { weight: w } : {}) };
    }),
    lanes:
      weight === undefined
        ? data.lanes
        : data.lanes.map((l) => {
            if (!data.roads.find((r) => r.id === id)?.laneIds.includes(l.id)) return l;
            const { weight: _w, ...rest } = l;
            return weight ? { ...rest, weight } : rest;
          }),
  };
}
export function updateRoad(data: MapData, id: string, patch: RoadPatch): MapData {
  const road = data.roads.find((r) => r.id === id);
  if (!road) return data;
  if (
    patch.points === undefined &&
    patch.oneWay === undefined &&
    !patch.swap &&
    patch.radius === undefined &&
    patch.nodeRadii === undefined
  )
    return setRoadSettings(data, id, patch);
  const lane0 = data.lanes.find((l) => l.id === road.laneIds[0]);
  if (!lane0) return data;
  let pts = (patch.points ?? road.points).map((p) => [...p] as P);
  let nodeA: string | undefined = lane0.from,
    nodeB: string | undefined = lane0.to;
  const same = (p: P, q: P) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.005;
  if (patch.points && !data.p2p) {
    // (a point-to-point route always starts and ends at its stations: moving its end points moves nothing)
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
    weight: patch.weight === undefined ? road.weight : (patch.weight ?? undefined),
    extra: road.extra,
    ...(data.p2p
      ? {
          offset: 0,
          radius: patch.radius ?? road.radius ?? 1,
          nodeRadii: patch.nodeRadii ?? (patch.swap ? [...(road.nodeRadii ?? [])].reverse() : road.nodeRadii),
        }
      : {}),
  });
  if (!r.id) return data;
  const used = new Set([...r.data.lanes.flatMap((l) => [l.from, l.to]), ...r.data.stations.map((s) => s.nodeId)]);
  return {
    ...r.data,
    roads: [...r.data.roads].sort((a, b) => numOf(a.id, 'R') - numOf(b.id, 'R')),
    nodes: r.data.nodes.filter((n) => used.has(n.id) || !n.id.startsWith('N-R')),
  };
}
/**
 * Cut a road in two at `node` (already in `data.nodes`, on or next to the road) after point index `after` of its centre line, so something can join the road there. Both halves keep the
 * road's direction, one-way setting, heading and source fields; the first keeps its id and name, the second gets the next free id and "(2)" after the name. Null when the road is unknown or a half
 * would be too short to be a road.
 */
export function splitRoad(data: MapData, roadId: string, after: number, node: NavNode): MapData | null {
  const road = data.roads.find((r) => r.id === roadId);
  const lane0 = road && data.lanes.find((l) => l.id === road.laneIds[0]);
  if (!road || !lane0 || after < 0 || after >= road.points.length - 1) return null;
  const first: P[] = [...road.points.slice(0, after + 1), [node.x, node.y]];
  const second: P[] = [[node.x, node.y], ...road.points.slice(after + 1)];
  if (pathLength(first) < 0.3 || pathLength(second) < 0.3) return null;
  const base: MapData = {
    ...data,
    lanes: data.lanes.filter((l) => !road.laneIds.includes(l.id)),
    roads: data.roads.filter((r) => r.id !== roadId),
  };
  const total = pathLength(road.points) || 1;
  const share = (pts: P[]) =>
    road.weight ? Math.round(road.weight * (pathLength(pts) / total) * 100) / 100 : undefined;
  const common = {
    oneWay: road.oneWay,
    fleetLive: lane0.fleets[0],
    fleets: lane0.fleets,
    heading: road.heading,
    extra: road.extra,
    snap: 0,
    allowShort: true,
  };
  const a = addRoad(base, first, {
    ...common,
    name: road.name,
    id: road.id,
    nodeA: lane0.from,
    nodeB: node.id,
    weight: share(first),
  });
  if (!a.id) return null;
  const b = addRoad(a.data, second, {
    ...common,
    name: `${road.name} (2)`,
    nodeA: node.id,
    nodeB: lane0.to,
    weight: share(second),
  });
  return b.id ? { ...b.data, roads: [...b.data.roads].sort((x, y) => numOf(x.id, 'R') - numOf(y.id, 'R')) } : null;
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
  if (!t) return text.nameProblems.road.empty;
  return data.roads.some((r) => r.id !== id && r.name.trim().toLowerCase() === t.toLowerCase())
    ? text.nameProblems.road.taken
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
        name: text.defaultNames.road(i + 1),
        oneWay: fwd.length === 1,
        points: offsetPolyline(
          ls[0].geom.map((g) => [...g] as P),
          -LANE_OFFSET,
        ),
        laneIds: ls.map((l) => l.id),
      };
    });
}
