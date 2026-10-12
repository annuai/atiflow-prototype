import type { Lane, NavGraph, NavNode, Vec2 } from './types';

export interface PathPlan { pts: Vec2[]; laneAt: (string | null)[]; cum: number[]; total: number }

/** Directed lane graph. Routing is fleet-aware: a fleet can only use lanes tagged with it. */
export class LaneGraph {
  nodes = new Map<string, NavNode>(); lanes = new Map<string, Lane>(); out = new Map<string, Lane[]>();
  constructor(public nav: NavGraph) {
    nav.nodes.forEach((n) => { this.nodes.set(n.id, n); this.out.set(n.id, []); });
    for (const l of nav.lanes) { this.lanes.set(l.id, l); this.out.get(l.from)?.push(l); }
  }
  station(id: string) { return this.nav.stations.find((s) => s.id === id); }
  stationNode(id: string) { const s = this.station(id); return s ? this.nodes.get(s.nodeId) : undefined; }
  /** Dijkstra over lanes (a lane is only traversed forward, and never straight back into its paired lane: robots do not U-turn mid-route). Returns lanes or null. */
  route(from: string, to: string, fleet: string, avoid?: ReadonlySet<string>): Lane[] | null {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return null;
    const dist = new Map<string, number>(), prev = new Map<string, Lane | null>(), done = new Set<string>(); let end: Lane | null = null;
    const relax = (l: Lane, d: number, p: Lane | null) => { if (!l.fleets.includes(fleet) || (avoid?.has(l.to) && l.to !== to)) return; const nd = d + l.len + 0.5; if (nd < (dist.get(l.id) ?? Infinity)) { dist.set(l.id, nd); prev.set(l.id, p); } };
    for (const l of this.out.get(from) ?? []) relax(l, 0, null);
    for (;;) {
      let cur: Lane | null = null, best = Infinity;
      for (const [id, d] of dist) if (!done.has(id) && d < best) { best = d; cur = this.lanes.get(id)!; }
      if (!cur) return null; if (cur.to === to) { end = cur; break; } done.add(cur.id);
      for (const l of this.out.get(cur.to) ?? []) if (!(l.to === cur.from)) relax(l, best, cur);
    }
    const lanes: Lane[] = []; for (let l: Lane | null = end; l; l = prev.get(l.id) ?? null) lanes.unshift(l);
    return lanes;
  }
  /** Concatenate lane geometries (consecutive lanes are joined by a short connector segment). `start` is the robot's current pose. */
  plan(lanes: Lane[], start?: Vec2): PathPlan {
    const pts: Vec2[] = [], laneAt: (string | null)[] = [];
    if (start) { pts.push(start); laneAt.push(lanes[0]?.id ?? null); }
    for (const l of lanes) for (const g of l.geom) {
      const q = { x: g[0], y: g[1] };
      const last = pts[pts.length - 1]; if (last && Math.hypot(q.x - last.x, q.y - last.y) < 0.02) { laneAt[laneAt.length - 1] = l.id; continue; }   // zero-length lanes / repeated points would hide reversals below
      // offset lanes of different edges can join slightly out of order at junctions; drop a lane-end point that would make the path reverse (>107 deg) over a short hop
      for (;;) {
        const n = pts.length; if (n < 2) break; const a = pts[n - 2], b = pts[n - 1];
        const d1x = b.x - a.x, d1y = b.y - a.y, d2x = q.x - b.x, d2y = q.y - b.y, L1 = Math.hypot(d1x, d1y), L2 = Math.hypot(d2x, d2y);
        if (L1 > 1e-6 && L2 > 1e-6 && L2 < 1.5 && (d1x * d2x + d1y * d2y) / (L1 * L2) < -0.3) { pts.pop(); laneAt.pop(); } else break;
      }
      pts.push(q); laneAt.push(l.id);
    }
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
