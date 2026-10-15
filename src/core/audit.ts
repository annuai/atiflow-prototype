import { LaneGraph } from './lanes';
import { segDist } from './geom';
import type { NavGraph } from './types';

export interface NavAudit {
  lanes: number;
  intersections: number;
  largestIntersection: number;
  /** Share (0-1) of sampled lane points whose opposite-direction lane is closer than a robot pair needs (0.95 m). */
  narrowShare: number;
  narrowestLane: number;
  stationsOnThroughRoads: string[];
  stationsInIntersections: string[];
  /** The busiest intersections and the share (0-1) of all station-to-station routes that pass through each. */
  hubs: { id: string; share: number }[];
  warnings: string[];
}

/**
 * Checks a lane map for the layouts that make robot traffic jam, before any robot drives on it: lanes too close for two robots to pass,
 * stations parked on through roads, stations inside intersections, and intersections that most routes depend on. Works on any nav.json.
 */
export function auditNav(nav: NavGraph, maxRoutes = 800): NavAudit {
  const g = new LaneGraph(nav);
  const xs = g.intersections;
  // 1. lanes too close to the lane running the other way
  const segs: { id: string; a: [number, number]; b: [number, number]; h: number }[] = [];
  for (const l of nav.lanes)
    for (let i = 0; i + 1 < l.geom.length; i++) {
      const a = l.geom[i],
        b = l.geom[i + 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05)
        segs.push({ id: l.id, a, b, h: Math.atan2(b[1] - a[1], b[0] - a[0]) });
    }
  let sampled = 0,
    narrow = 0,
    narrowest = Infinity;
  for (const s of segs) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    for (let d = 0.5; d < len; d += 0.5) {
      const px = s.a[0] + ((s.b[0] - s.a[0]) * d) / len,
        py = s.a[1] + ((s.b[1] - s.a[1]) * d) / len;
      let best = Infinity;
      for (const o of segs)
        if (o.id !== s.id && Math.cos(s.h - o.h) < -0.92)
          best = Math.min(best, segDist(px, py, o.a[0], o.a[1], o.b[0], o.b[1]).d);
      if (best < 9) {
        sampled++;
        if (best < 0.95 && best > 0.3) narrow++;
        if (best > 0.3) narrowest = Math.min(narrowest, best);
      } // (below 0.3 m the lanes simply cross)
    }
  }
  // 2. stations
  const nb = new Map<string, Set<string>>();
  for (const l of nav.lanes) {
    (nb.get(l.from) ?? nb.set(l.from, new Set()).get(l.from)!).add(l.to);
    (nb.get(l.to) ?? nb.set(l.to, new Set()).get(l.to)!).add(l.from);
  }
  const onRoad = nav.stations.filter((s) => (nb.get(s.nodeId)?.size ?? 0) >= 2).map((s) => s.id);
  const inX = nav.stations
    .filter((s) => {
      const n = g.nodes.get(s.nodeId)!;
      return xs.near(n.x, n.y).length > 0;
    })
    .map((s) => s.id);
  // 3. hubs: how many station-to-station routes pass through each intersection
  const use = new Map<string, number>();
  let routes = 0;
  outer: for (const f of nav.fleets) {
    const own = nav.stations.filter((s) => s.fleets.includes(f.id));
    for (const a of own)
      for (const b of own) {
        if (a === b) continue;
        if (routes >= maxRoutes) break outer;
        const l = g.route(a.nodeId, b.nodeId, f.id);
        if (!l) continue;
        routes++;
        const plan = g.plan(l);
        const seen = new Set<string>();
        for (let i = 0; i < plan.pts.length; i += 3)
          for (const id of xs.near(plan.pts[i].x, plan.pts[i].y)) seen.add(id);
        seen.forEach((id) => use.set(id, (use.get(id) ?? 0) + 1));
      }
  }
  const hubs = [...use.entries()]
    .map(([id, n]) => ({ id, share: routes ? n / routes : 0 }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 5);
  const narrowShare = sampled ? narrow / sampled : 0;
  const warnings: string[] = [];
  if (narrowShare > 0.02)
    warnings.push(
      `${Math.round(narrowShare * 100)}% of the lane length has the opposite lane closer than 0.95 m (narrowest ${narrowest.toFixed(2)} m): two robots cannot pass there, so it works like a one-lane road. Widen the keep-right lane offset to at least 0.6 m.`,
    );
  if (onRoad.length)
    warnings.push(
      `${onRoad.length} of ${nav.stations.length} stations sit on through roads (${onRoad.slice(0, 6).join(', ')}${onRoad.length > 6 ? '...' : ''}): a robot parked there blocks the road. Move them to dead-end spurs where possible.`,
    );
  if (inX.length > nav.stations.length / 3)
    warnings.push(
      `${inX.length} of ${nav.stations.length} stations are inside an intersection area: robots leaving or arriving there compete with through traffic.`,
    );
  if (hubs[0] && hubs[0].share > 0.5)
    warnings.push(
      `${Math.round(hubs[0].share * 100)}% of all routes pass through intersection ${hubs[0].id}: it will be the bottleneck. Add a parallel route or spread the stations.`,
    );
  return {
    lanes: nav.lanes.length,
    intersections: xs.clusters.size,
    largestIntersection: Math.max(0, ...xs.clusters.values()),
    narrowShare,
    narrowestLane: Number.isFinite(narrowest) ? narrowest : 0,
    stationsOnThroughRoads: onRoad,
    stationsInIntersections: inX,
    hubs,
    warnings,
  };
}
