import { segDist } from './geom';
import type { Lane, NavGraph, NavNode, Vec2 } from './types';

export interface PathPlan { pts: Vec2[]; laneAt: (string | null)[]; cum: number[]; total: number }

/** Directed lane graph. Routing is fleet-aware: a fleet can only use lanes tagged with it. */
export class LaneGraph {
  nodes = new Map<string, NavNode>(); lanes = new Map<string, Lane>(); out = new Map<string, Lane[]>();
  constructor(public nav: NavGraph) {
    nav.nodes.forEach((n) => { this.nodes.set(n.id, n); this.out.set(n.id, []); });
    for (const l of nav.lanes) { this.lanes.set(l.id, l); this.out.get(l.from)?.push(l); }
  }
  private xings: Intersections | null = null;
  /** The map's intersections (derived from the lanes, cached). */
  get intersections() { return (this.xings ??= new Intersections(this)); }
  station(id: string) { return this.nav.stations.find((s) => s.id === id); }
  stationNode(id: string) { const s = this.station(id); return s ? this.nodes.get(s.nodeId) : undefined; }
  /** Dijkstra over lanes with a binary heap (a lane is only traversed forward, and never straight back into its paired lane: robots do not U-turn mid-route). Returns lanes or null. */
  route(from: string, to: string, fleet: string, avoid?: ReadonlySet<string>): Lane[] | null {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return null;
    const dist = new Map<string, number>(), prev = new Map<string, Lane | null>(), done = new Set<string>(); let end: Lane | null = null;
    const heap: [number, Lane][] = [];
    const push = (d: number, l: Lane) => { heap.push([d, l]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const relax = (l: Lane, d: number, p: Lane | null) => { if (!l.fleets.includes(fleet) || (avoid?.has(l.to) && l.to !== to)) return; const nd = d + l.len + 0.5; if (nd < (dist.get(l.id) ?? Infinity)) { dist.set(l.id, nd); prev.set(l.id, p); push(nd, l); } };
    for (const l of this.out.get(from) ?? []) relax(l, 0, null);
    while (heap.length) {
      const [d, cur] = pop(); if (done.has(cur.id) || d > (dist.get(cur.id) ?? Infinity)) continue;
      if (cur.to === to) { end = cur; break; } done.add(cur.id);
      for (const l of this.out.get(cur.to) ?? []) if (l.to !== cur.from) relax(l, d, cur);
    }
    if (!end) return null;
    const lanes: Lane[] = []; for (let l: Lane | null = end; l; l = prev.get(l.id) ?? null) lanes.unshift(l);
    return lanes;
  }
  /** Concatenate lane geometries (consecutive lanes are joined by a short connector segment). `start` is the robot's current pose. */
  plan(lanes: Lane[], start?: Vec2, midLane = false): PathPlan {
    const pts: Vec2[] = [], laneAt: (string | null)[] = [];
    if (start) { pts.push(start); laneAt.push(lanes[0]?.id ?? null); }
    lanes.forEach((l, li) => { let from = 0;
      if (midLane && li === 0 && start) {                                           // the robot is part-way along the first lane: continue from the segment it is on
        let best = Infinity; for (let i = 0; i + 1 < l.geom.length; i++) { const d = segDist(start.x, start.y, l.geom[i][0], l.geom[i][1], l.geom[i + 1][0], l.geom[i + 1][1]).d; if (d < best) { best = d; from = i + 1; } }
      }
      for (const g of l.geom.slice(from)) {
      const q = { x: g[0], y: g[1] };
      const last = pts[pts.length - 1]; if (last && Math.hypot(q.x - last.x, q.y - last.y) < 0.02) { laneAt[laneAt.length - 1] = l.id; continue; }   // zero-length lanes / repeated points would hide reversals below
      pts.push(q); laneAt.push(l.id);
      }
    });
    const sm = smoothPolyline(pts, laneAt);
    const cum = [0]; for (let i = 1; i < sm.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(sm.pts[i].x - sm.pts[i - 1].x, sm.pts[i].y - sm.pts[i - 1].y));
    return { pts: sm.pts, laneAt: sm.laneAt, cum, total: cum[cum.length - 1] };
  }
  /** Every way a robot can pass from one lane into the next at a node, as a short curve (the lane network drawn with its junctions). */
  connectors(): { fleets: string[]; pts: Vec2[] }[] {
    const out: { fleets: string[]; pts: Vec2[] }[] = [];
    for (const a of this.nav.lanes) for (const b of this.out.get(a.to) ?? []) {
      const fleets = a.fleets.filter((f) => b.fleets.includes(f)); if (!fleets.length) continue;
      const raw = [...a.geom.slice(-2), ...b.geom.slice(0, 2)].map(([x, y]) => ({ x, y }));
      out.push({ fleets, pts: smoothPolyline(raw, raw.map(() => null)).pts });
    }
    return out;
  }
  /** Each lane as the smooth curve robots actually drive. */
  smoothLanes(): { id: string; fleets: string[]; pts: Vec2[] }[] {
    return this.nav.lanes.map((l) => { const raw = l.geom.map(([x, y]) => ({ x, y })); return { id: l.id, fleets: l.fleets, pts: smoothPolyline(raw, raw.map(() => null)).pts }; });
  }
}

/** Every place where two robots cannot pass each other: lanes of different flows closer than a robot pair needs (crossings, merges, forks, tight opposite lanes). Found from the lane geometry alone, so any map works. Each cluster is one intersection. */
export class Intersections {
  readonly clusters = new Map<string, number>(); private pts: { x: number; y: number; c: string }[] = []; private cell = new Map<string, number[]>(); private reach: number;
  constructor(graph: LaneGraph, gap = 0.95, reach = 2.0, join = 0) {
    this.reach = reach; const sm = graph.smoothLanes(); type P = { x: number; y: number; lane: number };
    const all: P[] = []; sm.forEach((l, li) => { let acc = 0; l.pts.forEach((q, i) => { if (i === 0) { all.push({ ...q, lane: li }); return; } const a = l.pts[i - 1]; acc += Math.hypot(q.x - a.x, q.y - a.y); if (acc >= 0.4 || i === l.pts.length - 1) { all.push({ ...q, lane: li }); acc = 0; } }); });
    const lanes = graph.nav.lanes; const grid = new Map<string, number[]>(); const key = (x: number, y: number) => Math.floor(x) + ',' + Math.floor(y);
    all.forEach((p, i) => { const k = key(p.x, p.y); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
    const parent = all.map((_, i) => i); const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]))); const flagged = new Set<number>();
    const follows = (a: number, b: number) => lanes[a].to === lanes[b].from && lanes[b].to !== lanes[a].from;      // b continues a (not a U-turn into the paired lane)
    for (let i = 0; i < all.length; i++) {
      const p = all[i]; const cx = Math.floor(p.x), cy = Math.floor(p.y);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(cx + dx + ',' + (cy + dy)) ?? []) {
        if (j <= i) continue; const q = all[j]; if (q.lane === p.lane || follows(p.lane, q.lane) || follows(q.lane, p.lane)) continue;
        if (Math.hypot(p.x - q.x, p.y - q.y) < gap) { flagged.add(i); flagged.add(j); parent[find(i)] = find(j); }
      }
    }
    const fl = [...flagged];
    if (join > 0) for (const i of fl) { const p = all[i]; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(Math.floor(p.x) + dx + ',' + (Math.floor(p.y) + dy)) ?? []) if (j > i && flagged.has(j) && Math.hypot(p.x - all[j].x, p.y - all[j].y) < join) parent[find(i)] = find(j); }
    const ids = new Map<number, string>(); let n = 0;
    for (const i of fl) { const r = find(i); if (!ids.has(r)) ids.set(r, 'X' + ++n); const c = ids.get(r)!; this.pts.push({ x: all[i].x, y: all[i].y, c }); this.clusters.set(c, (this.clusters.get(c) ?? 0) + 1); }
    this.pts.forEach((p, i) => { const k = key(p.x, p.y); (this.cell.get(k) ?? this.cell.set(k, []).get(k)!).push(i); });
  }
  /** Every intersection whose area (within `reach` of one of its points) contains the position. */
  near(x: number, y: number): string[] {
    const cx = Math.floor(x), cy = Math.floor(y), out = new Set<string>(); const R = Math.ceil(this.reach) + 1;
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (const i of this.cell.get(cx + dx + ',' + (cy + dy)) ?? []) { const p = this.pts[i]; if (Math.hypot(p.x - x, p.y - y) < this.reach) out.add(p.c); }
    return [...out];
  }
}

export const CORNER_RADIUS = 0.75;
/** Rounds every corner of a polyline with a quadratic curve (corner radius `R`), so a robot follows a continuous tangent instead of turning on the spot at each vertex. */
export function smoothPolyline(src: Vec2[], laneSrc: (string | null)[], R = CORNER_RADIUS, step = 0.18): { pts: Vec2[]; laneAt: (string | null)[] } {
  const p: Vec2[] = [], l: (string | null)[] = [];
  src.forEach((q, i) => { const a = p[p.length - 1]; if (!a || Math.hypot(q.x - a.x, q.y - a.y) > 0.05) { p.push(q); l.push(laneSrc[i]); } });
  if (p.length < 3) return { pts: p, laneAt: l };
  const pts: Vec2[] = [p[0]], laneAt: (string | null)[] = [l[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const d1 = { x: (b.x - a.x) / l1, y: (b.y - a.y) / l1 }, d2 = { x: (c.x - b.x) / l2, y: (c.y - b.y) / l2 };
    const phi = Math.acos(Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y)));
    if (phi < 0.03) { pts.push(b); laneAt.push(l[i]); continue; }
    const t = Math.min(R * Math.tan(Math.min(phi, Math.PI - 0.05) / 2), 0.5 * l1, 0.5 * l2);
    const A = { x: b.x - d1.x * t, y: b.y - d1.y * t }, B = { x: b.x + d2.x * t, y: b.y + d2.y * t };
    const n = Math.max(4, Math.ceil((2 * t * (0.6 + phi / Math.PI)) / step));
    for (let k = 0; k <= n; k++) { const u = k / n, w = 1 - u; pts.push({ x: w * w * A.x + 2 * w * u * b.x + u * u * B.x, y: w * w * A.y + 2 * w * u * b.y + u * u * B.y }); laneAt.push(l[i]); }
  }
  pts.push(p[p.length - 1]); laneAt.push(l[p.length - 1]);
  return { pts, laneAt };
}
export function pointAt(p: PathPlan, s: number): { x: number; y: number; heading: number; lane: string | null } {
  const c = p.cum; let lo = 0, hi = c.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
  const a = p.pts[lo], b = p.pts[Math.min(lo + 1, p.pts.length - 1)], L = c[lo + 1] - c[lo] || 1e-9, t = Math.max(0, Math.min(1, (s - c[lo]) / L));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, heading: Math.atan2(b.y - a.y, b.x - a.x), lane: p.laneAt[Math.min(lo + 1, p.laneAt.length - 1)] };
}
