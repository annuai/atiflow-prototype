import { pointInPoly } from './geom';
import type { LaneGraph } from './lanes';
import { fitRect, rectCorners } from './rect';
import type { TrafficZone, Vec2 } from './types';

/** A ring of `n` points around a centre: a point grown by `r` (the hull of these is the area within `r` of the point). */
const ring = (c: Vec2, r: number, n = 8): Vec2[] =>
  Array.from({ length: n }, (_, i) => ({
    x: c.x + r * Math.cos((2 * Math.PI * (i + 0.5)) / n),
    y: c.y + r * Math.sin((2 * Math.PI * (i + 0.5)) / n),
  }));

/**
 * One traffic zone (a rotated rectangle) for every junction of the lane map: the area where lanes of different flows meet, cross or split, grown by `margin` metres (the robot's body and its swing), with junctions
 * whose zones would overlap (points closer than `mergeGap`, twice the margin) merged into one: a crossing is one zone, never two overlapping ones. Capacity 1: one robot at a time. Pure: the same lanes give the same zones.
 */
export function junctionZones(graph: LaneGraph, margin = 1.2, mergeGap = 2 * margin, stationClear = 0): TrafficZone[] {
  const stations = graph.nav.stations.flatMap((s) => (graph.nodes.get(s.nodeId) ? [graph.nodes.get(s.nodeId)!] : []));
  const areas = graph.intersections
    .areas()
    .map((a) => ({
      ...a,
      pts: a.pts.filter((p) => !stations.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < stationClear)),
    }))
    .filter((a) => a.pts.length > 0);
  const parent = areas.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < areas.length; i++)
    for (let j = i + 1; j < areas.length; j++) {
      const close = areas[i].pts.some((p) => areas[j].pts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < mergeGap));
      if (close) parent[find(i)] = find(j);
    }
  const groups = new Map<number, Vec2[]>();
  areas.forEach((a, i) => (groups.get(find(i)) ?? groups.set(find(i), []).get(find(i))!).push(...a.pts));
  const sm = graph.smoothLanes();
  const lanes = graph.nav.lanes;
  const zones = [...groups.values()]
    .map((pts) => rectCorners(fitRect(pts.flatMap((p) => ring(p, margin)).map((p) => [p.x, p.y] as [number, number]))))
    .map((c) => c.map(([x, y]) => ({ x, y })))
    .sort((a, b) => a[0].x - b[0].x || a[0].y - b[0].y);
  return zones.map((poly, n) => {
    const fleets = new Set<string>();
    sm.forEach((l, li) => {
      if (
        l.pts.some((q) =>
          pointInPoly(
            q.x,
            q.y,
            poly.map((v) => [v.x, v.y]),
          ),
        )
      )
        lanes[li].fleets.forEach((f) => fleets.add(f));
    });
    const id = `TZ-${String(n + 1).padStart(2, '0')}`;
    return {
      id,
      name: `Traffic Zone ${n + 1}`,
      capacity: 1,
      fleets: [...fleets].sort(),
      polygon: poly.map((v) => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100] as [number, number]),
    };
  });
}
