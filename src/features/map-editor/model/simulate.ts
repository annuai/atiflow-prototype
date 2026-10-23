import { LaneGraph } from '@/core/lanes';
import type { Lane, NavGraph, NavNode, Vec2 } from '@/core/types';
import { approachPath, laneAt } from './approach/geometry';
import { maneuverFor } from './approach/capability';
import { maneuverOf } from './approach/maneuvers';
import { paramValue } from './approach/params';
import { resolveNodes, slotOf } from './approach/nodes';
import { roleOf, type SlotId } from './approach/types';
import { nearestRoad, routable } from './connect';
import type { MapData, MapStation } from './types';

/** The map as a lane graph for the simulation: only this map's own nodes, lanes and stations (each map owns its full network). */
export function navOf(map: MapData, fleet: string): NavGraph {
  const nav = routable(map); // an off-route station gets its way onto the route here, never in the saved map
  return {
    schema: 2,
    siteId: 'map',
    nodes: nav.nodes,
    lanes: nav.lanes,
    stations: nav.stations,
    fleets: [{ id: fleet, name: fleet, color: '#14b8a6', areas: [] }],
    trafficZones: [],
    forbiddenZones: [],
  };
}

/** What the robot does at the two ends: it leaves the start carrying a load (Laden) or empty (Unladen), and arrives at the end to pick a load up (Pick) or to put one down or do nothing (Drop). */
export interface TripOptions {
  laden?: boolean;
  pick?: boolean;
  /** the robot type (its label): a maneuver it cannot drive is replaced by the in-place turn */
  robot?: string;
}
export type TripPlan =
  | {
      ok: true;
      pts: Vec2[];
      len: number;
      /** the tightest turn on the path in metres (null: it never bends) */
      radius: number | null;
      /** the nodes used (1-based, 0 = a station on the lane) */ via: { start: number; end: number };
      notes: { robot: string; maneuver: string }[];
    }
  | { ok: false; reason: 'missing' | 'same' | 'no-route' }
  | { ok: false; reason: 'unlinked'; station: string }
  | { ok: false; reason: 'no-node'; station: string; slot: SlotId };

interface Way {
  /** the network node the route starts or ends at */
  node: NavNode;
  /** the drive between the station and that node (empty for a station on the lane) */
  pts: [number, number][];
  index: number;
  /** how far along the lane the maneuver starts (park) or ends (unpark): the lane drive stops short of the node by this much */
  trim: number;
  note?: { robot: string; maneuver: string };
}
/** A polyline without its first `d` metres / its last `d` metres (unchanged when it is not that long). */
function shorten(pts: Vec2[], d: number, end: boolean): Vec2[] {
  if (d <= 0 || pts.length < 2) return pts;
  const seq = end ? pts.slice().reverse() : pts;
  let left = d;
  for (let i = 1; i < seq.length; i++) {
    const seg = Math.hypot(seq[i].x - seq[i - 1].x, seq[i].y - seq[i - 1].y);
    if (seg >= left) {
      const t = left / (seg || 1);
      const cut = [
        { x: seq[i - 1].x + (seq[i].x - seq[i - 1].x) * t, y: seq[i - 1].y + (seq[i].y - seq[i - 1].y) * t },
        ...seq.slice(i),
      ];
      return end ? cut.reverse() : cut;
    }
    left -= seg;
  }
  return pts;
}
const length = (pts: [number, number][]) =>
  pts.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : n), 0);

/** The ways a robot can leave or enter a station for a slot: one per node that has that slot switched on. A station on the lane has one way, straight to its own node. */
function ways(
  data: MapData,
  nav: NavGraph,
  g: LaneGraph,
  s: MapStation,
  slot: SlotId,
  robot?: string,
): Way[] | 'unlinked' | 'no-node' {
  const here = g.stationNode(s.id);
  if (!here) return 'unlinked';
  if (s.onLane !== false || data.p2p) {
    return nav.lanes.some((l) => l.from === here.id || l.to === here.id)
      ? [{ node: here, pts: [], index: 0, trim: 0 }]
      : 'unlinked';
  }
  const at = data.nodes.find((n) => n.id === s.nodeId);
  const placed = resolveNodes(data, s).filter((r) => r.at);
  if (!at || !placed.length) return 'unlinked';
  const out: Way[] = [];
  let noRoad = 0;
  for (const r of placed) {
    const sl = slotOf(r.node, slot);
    if (!sl || !r.at) continue;
    const road = nearestRoad(data, r.at.x, r.at.y);
    if (!road) {
      noRoad++;
      continue;
    }
    const fit = maneuverFor(sl, robot);
    const path = approachPath({
      role: roleOf(slot),
      slot: fit.fellBack ? { ...sl, maneuver: fit.maneuver } : sl,
      node: [r.at.x, r.at.y],
      lane: laneAt(road.road.points, road.seg),
      station: [at.x, at.y],
      theta: ((s.angle ?? 0) * Math.PI) / 180,
    });
    const eff = fit.fellBack ? fit.maneuver : sl.maneuver;
    out.push({
      node: r.at,
      pts: path.pts,
      index: r.index + 1,
      trim: maneuverOf(eff).params.includes('inlane_dist') ? Math.max(0, paramValue(sl, 'inlane_dist')) : 0,
      ...(fit.fellBack && robot ? { note: { robot, maneuver: sl.maneuver ?? '' } } : {}),
    });
  }
  if (out.length) return out;
  return noRoad === placed.length ? 'unlinked' : 'no-node'; // no road at all is a different problem from a slot that is switched off
}

/** Everything a trip is planned from, built once: a check of every route plans thousands of trips on the same map. */
export interface TripContext {
  data: MapData;
  fleet: string;
  nav: NavGraph;
  g: LaneGraph;
  routes: Map<string, Lane[] | null>;
  ways: Map<string, ReturnType<typeof ways>>;
}
export const tripContext = (data: MapData, fleet: string): TripContext => {
  const nav = navOf(data, fleet);
  return { data, fleet, nav, g: new LaneGraph(nav), routes: new Map(), ways: new Map() };
};
/** The tightest turn along a path (m): the smallest circle through three points a metre apart (closer points only measure the jitter of a drawn curve). Null when the path never bends. */
export function minRadius(pts: Vec2[], step = 1): number | null {
  const keep: Vec2[] = [];
  for (const p of pts)
    if (!keep.length || Math.hypot(p.x - keep[keep.length - 1].x, p.y - keep[keep.length - 1].y) >= step) keep.push(p);
  let best: number | null = null;
  for (let i = 1; i < keep.length - 1; i++) {
    const [a, b, c] = [keep[i - 1], keep[i], keep[i + 1]];
    const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
    if (area2 < 1e-6) continue; // straight
    const r =
      (Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y) * Math.hypot(c.x - a.x, c.y - a.y)) /
      (2 * area2);
    if (best === null || r < best) best = r;
  }
  return best === null ? null : Math.round(best * 100) / 100;
}

/** The path a robot of the fleet drives from one station to another on this map, and its length in metres (see `planWith`). */
export const planTrip = (data: MapData, fleet: string, from: string, to: string, opts: TripOptions = {}): TripPlan =>
  planWith(tripContext(data, fleet), from, to, opts);

/**
 * A station off the lane is left and entered by its nodes: only a node whose Unpark (Laden / Unladen) or Park (Pick / Drop) slot is on can be used, and when several can, the cheapest total
 * drive wins.
 */
export function planWith(ctx: TripContext, from: string, to: string, opts: TripOptions = {}): TripPlan {
  const { data, nav, g, fleet } = ctx;
  const a = data.stations.find((s) => s.id === from),
    b = data.stations.find((s) => s.id === to);
  if (!a || !b || !g.stationNode(from) || !g.stationNode(to)) return { ok: false, reason: 'missing' };
  if (a.id === b.id) return { ok: false, reason: 'same' };
  const leave: SlotId = opts.laden ? 'laden' : 'unladen',
    enter: SlotId = opts.pick ? 'pick' : 'drop';
  const waysOf = (s: MapStation, slot: SlotId) => {
    const key = `${s.id}:${slot}:${opts.robot ?? ''}`;
    if (!ctx.ways.has(key)) ctx.ways.set(key, ways(data, nav, g, s, slot, opts.robot));
    return ctx.ways.get(key)!;
  };
  const start = waysOf(a, leave),
    end = waysOf(b, enter);
  if (start === 'unlinked') return { ok: false, reason: 'unlinked', station: from };
  if (end === 'unlinked') return { ok: false, reason: 'unlinked', station: to };
  if (start === 'no-node') return { ok: false, reason: 'no-node', station: from, slot: leave };
  if (end === 'no-node') return { ok: false, reason: 'no-node', station: to, slot: enter };
  let best: {
    pts: Vec2[];
    len: number;
    via: { start: number; end: number };
    notes: { robot: string; maneuver: string }[];
  } | null = null;
  for (const u of start)
    for (const p of end) {
      const rk = `${u.node.id}>${p.node.id}`;
      if (!ctx.routes.has(rk)) ctx.routes.set(rk, u.node.id === p.node.id ? [] : g.route(u.node.id, p.node.id, fleet));
      const lanes = ctx.routes.get(rk) ?? null;
      if (u.node.id !== p.node.id && !lanes?.length) continue;
      const plan = lanes?.length ? g.plan(lanes, { x: u.node.x, y: u.node.y }) : { pts: [], total: 0 };
      // the lane drive stops short of the node where the maneuver takes over (the unpark path ends, and the park path starts, `trim` metres along the lane)
      const drive = shorten(
        shorten(
          plan.pts.map((q) => ({ x: q.x, y: q.y })),
          u.trim,
          false,
        ),
        p.trim,
        true,
      );
      // both paths are in driving order: the unpark path station -> lane, the lane drive, the park path lane -> station
      const pts: Vec2[] = [...u.pts.map(([x, y]) => ({ x, y })), ...drive, ...p.pts.map(([x, y]) => ({ x, y }))];
      const len = length(u.pts) + Math.max(0, plan.total - u.trim - p.trim) + length(p.pts);
      if (!best || len < best.len)
        best = {
          pts,
          len,
          via: { start: u.index, end: p.index },
          notes: [u.note, p.note].filter((n): n is NonNullable<typeof n> => !!n),
        };
    }
  return best ? { ok: true, ...best, radius: minRadius(best.pts) } : { ok: false, reason: 'no-route' };
}
