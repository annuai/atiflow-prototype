import { segDist } from './geom';
import type { Lane, NavGraph, NavNode, Vec2 } from './types';

export interface PathPlan {
  pts: Vec2[];
  laneAt: (string | null)[];
  cum: number[];
  total: number;
}

/** Lane geometry at junctions: every lane is cut short of the node it meets other lanes at, and each turn is one smooth curve from the end of one lane to the start of the next (no overshoot, no doubling back). */
const SETBACK_JUNCTION = 1.5,
  SETBACK_BEND = 1.0; // m cut off a lane end at a junction (3+ lanes) / at a simple bend (2 lanes)
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const polyLen = (p: Vec2[]) => p.reduce((a, q, i) => (i ? a + dist(p[i - 1], q) : 0), 0);
/** The part of a polyline between `from` m after its start and `to` m before its end. */
function trimPoly(p: Vec2[], from: number, to: number): Vec2[] {
  const total = polyLen(p);
  const a = from,
    b = total - to;
  if (b - a < 0.05) {
    const m = pointAtArc(p, Math.min(Math.max(from, 0), total)).p;
    return [m, m];
  }
  const out: Vec2[] = [pointAtArc(p, a).p];
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    acc += dist(p[i - 1], p[i]);
    if (acc > a + 1e-6 && acc < b - 1e-6) out.push(p[i]);
  }
  out.push(pointAtArc(p, b).p);
  return out;
}
function pointAtArc(p: Vec2[], s: number): { p: Vec2; d: Vec2 } {
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const l = dist(p[i - 1], p[i]);
    if (acc + l >= s || i === p.length - 1) {
      const t = l > 1e-9 ? Math.min(Math.max((s - acc) / l, 0), 1) : 0;
      return {
        p: { x: p[i - 1].x + (p[i].x - p[i - 1].x) * t, y: p[i - 1].y + (p[i].y - p[i - 1].y) * t },
        d: l > 1e-9 ? { x: (p[i].x - p[i - 1].x) / l, y: (p[i].y - p[i - 1].y) / l } : { x: 1, y: 0 },
      };
    }
    acc += l;
  }
  return { p: p[0], d: { x: 1, y: 0 } };
}
/** A cubic curve leaving `p0` along `d0` and arriving at `p3` along `d3` (the end points are not included). */
function turnCurve(p0: Vec2, d0: Vec2, p3: Vec2, d3: Vec2): Vec2[] {
  const chord = dist(p0, p3);
  if (chord < 0.06) return [];
  const h = 0.4 * chord;
  const p1 = { x: p0.x + d0.x * h, y: p0.y + d0.y * h },
    p2 = { x: p3.x - d3.x * h, y: p3.y - d3.y * h };
  const n = Math.max(2, Math.ceil(chord / 0.2));
  const out: Vec2[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n,
      u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** Directed lane graph. Routing is fleet-aware: a fleet can only use lanes tagged with it. */
export class LaneGraph {
  nodes = new Map<string, NavNode>();
  lanes = new Map<string, Lane>();
  out = new Map<string, Lane[]>();
  constructor(public nav: NavGraph) {
    nav.nodes.forEach((n) => {
      this.nodes.set(n.id, n);
      this.out.set(n.id, []);
    });
    for (const l of nav.lanes) {
      this.lanes.set(l.id, l);
      this.out.get(l.from)?.push(l);
    }
  }
  private xings: Intersections | null = null;
  /** The map's intersections (derived from the lanes, cached). */
  get intersections() {
    return (this.xings ??= new Intersections(this));
  }
  station(id: string) {
    return this.nav.stations.find((s) => s.id === id);
  }
  stationNode(id: string) {
    const s = this.station(id);
    return s ? this.nodes.get(s.nodeId) : undefined;
  }
  /** Dijkstra over lanes with a binary heap (a lane is only traversed forward, and never straight back into its paired lane: robots do not U-turn mid-route). Returns lanes or null. */
  route(
    from: string,
    to: string,
    fleet: string,
    avoid?: ReadonlySet<string>,
    cost?: (l: Lane) => number,
  ): Lane[] | null {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return null;
    const dist = new Map<string, number>(),
      prev = new Map<string, Lane | null>(),
      done = new Set<string>();
    let end: Lane | null = null;
    const heap: [number, Lane][] = [];
    const push = (d: number, l: Lane) => {
      heap.push([d, l]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1,
            r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const relax = (l: Lane, d: number, p: Lane | null) => {
      if (!l.fleets.includes(fleet) || (avoid?.has(l.to) && l.to !== to)) return;
      const nd = d + l.len + 0.5 + (cost?.(l) ?? 0);
      if (nd < (dist.get(l.id) ?? Infinity)) {
        dist.set(l.id, nd);
        prev.set(l.id, p);
        push(nd, l);
      }
    };
    for (const l of this.out.get(from) ?? []) relax(l, 0, null);
    while (heap.length) {
      const [d, cur] = pop();
      if (done.has(cur.id) || d > (dist.get(cur.id) ?? Infinity)) continue;
      if (cur.to === to) {
        end = cur;
        break;
      }
      done.add(cur.id);
      for (const l of this.out.get(cur.to) ?? []) if (l.to !== cur.from) relax(l, d, cur);
    }
    if (!end) return null;
    const lanes: Lane[] = [];
    for (let l: Lane | null = end; l; l = prev.get(l.id) ?? null) lanes.unshift(l);
    return lanes;
  }

  /** How much of a lane end is cut off at its node: nothing at a dead end (the lane really goes there), more at a junction than at a simple bend, never more than 45% of the lane. */
  private setback(l: Lane, end: 'from' | 'to'): number {
    const deg = this.out.get(end === 'from' ? l.from : l.to)?.length ?? 0;
    if (deg < 2) return 0;
    return Math.min(deg >= 3 ? SETBACK_JUNCTION : SETBACK_BEND, 0.45 * polyLen(l.geom.map(([x, y]) => ({ x, y }))));
  }
  /** A lane as driven: cut short at junctions (`from` / `to` choose which ends), optionally starting at a given vertex. */
  private piece(l: Lane, cutStart: boolean, cutEnd: boolean, fromVertex = 0): Vec2[] {
    const raw = l.geom.slice(fromVertex).map(([x, y]) => ({ x, y }));
    return trimPoly(raw, cutStart ? this.setback(l, 'from') : 0, cutEnd ? this.setback(l, 'to') : 0);
  }
  private curves = new Map<string, Vec2[]>();
  /** The curve from the (cut) end of lane `a` to the (cut) start of lane `b`, end points excluded. Cached. */
  private turn(a: Lane, b: Lane): Vec2[] {
    const key = a.id + '>' + b.id;
    const c = this.curves.get(key);
    if (c) return c;
    const pa = this.piece(a, false, true),
      pb = this.piece(b, true, false);
    const ea = pointAtArc(pa, polyLen(pa)),
      sb = pointAtArc(pb, 0);
    return this.curves.set(key, turnCurve(ea.p, ea.d, sb.p, sb.d)).get(key)!;
  }
  /** Concatenate lane geometries (consecutive lanes are joined by a short connector segment). `start` is the robot's current pose. */
  plan(lanes: Lane[], start?: Vec2, midLane = false): PathPlan {
    const pts: Vec2[] = [],
      laneAt: (string | null)[] = [];
    const add = (q: Vec2, id: string) => {
      const last = pts[pts.length - 1];
      if (last && dist(q, last) < 0.02) {
        laneAt[laneAt.length - 1] = id;
        return;
      }
      pts.push(q);
      laneAt.push(id);
    }; // (zero-length lanes / repeated points would hide reversals below)
    if (start) {
      pts.push(start);
      laneAt.push(lanes[0]?.id ?? null);
    }
    lanes.forEach((l, li) => {
      const first = li === 0,
        last = li === lanes.length - 1;
      let from = 0;
      if (midLane && first && start) {
        // the robot is part-way along the first lane: continue from the segment it is on
        let best = Infinity;
        for (let i = 0; i + 1 < l.geom.length; i++) {
          const d = segDist(start.x, start.y, l.geom[i][0], l.geom[i][1], l.geom[i + 1][0], l.geom[i + 1][1]).d;
          if (d < best) {
            best = d;
            from = i + 1;
          }
        }
      }
      let curveFrom: { p: Vec2; d: Vec2 } | null = null;
      if (first && from > 0 && start) {
        // part-way along the first lane: drive on from where the robot is; when it is already inside the cut-off part near the junction the turn starts right here
        const rest = [start, ...l.geom.slice(from).map(([x, y]) => ({ x, y }))];
        const cutLen = last ? 0 : this.setback(l, 'to');
        if (polyLen(rest) - cutLen > 0.05) trimPoly(rest, 0, cutLen).forEach((q) => add(q, l.id));
        else if (!last) {
          const d = pointAtArc(rest, 0).d;
          curveFrom = { p: start, d };
        }
      } else this.piece(l, !first, !last).forEach((q) => add(q, l.id));
      if (!last) {
        const nxt = lanes[li + 1];
        let curve: Vec2[];
        if (curveFrom) {
          const sb = pointAtArc(this.piece(nxt, true, false), 0);
          curve = turnCurve(curveFrom.p, curveFrom.d, sb.p, sb.d);
        } else curve = this.turn(l, nxt);
        curve.forEach((q, i) => add(q, i < curve.length / 2 ? l.id : nxt.id));
      }
    });
    const sm = smoothPolyline(pts, laneAt);
    const cum = [0];
    for (let i = 1; i < sm.pts.length; i++)
      cum.push(cum[i - 1] + Math.hypot(sm.pts[i].x - sm.pts[i - 1].x, sm.pts[i].y - sm.pts[i - 1].y));
    return { pts: sm.pts, laneAt: sm.laneAt, cum, total: cum[cum.length - 1] };
  }
  /** Every way a robot can pass from one lane into the next at a node, as a short curve (the lane network drawn with its junctions). */
  connectors(): { fleets: string[]; pts: Vec2[] }[] {
    const out: { fleets: string[]; pts: Vec2[] }[] = [];
    for (const a of this.nav.lanes)
      for (const b of this.out.get(a.to) ?? []) {
        const fleets = a.fleets.filter((f) => b.fleets.includes(f));
        if (!fleets.length) continue;
        if (b.to === a.from && (this.out.get(a.to)?.length ?? 0) > 1) continue; // robots never turn back into the paired lane except at a dead end
        const pa = this.piece(a, false, true),
          pb = this.piece(b, true, false);
        out.push({ fleets, pts: [pa[pa.length - 1], ...this.turn(a, b), pb[0]] });
      }
    return out;
  }
  /** The lanes as drawn and driven: each cut short at its junctions (the turns between them are `connectors()`). */
  roadLanes(): { id: string; fleets: string[]; pts: Vec2[] }[] {
    return this.nav.lanes.map((l) => {
      const raw = this.piece(l, true, true);
      return {
        id: l.id,
        fleets: l.fleets,
        pts: smoothPolyline(
          raw,
          raw.map(() => null),
        ).pts,
      };
    });
  }
  /** Each lane as the smooth curve robots actually drive. */
  smoothLanes(): { id: string; fleets: string[]; pts: Vec2[] }[] {
    return this.nav.lanes.map((l) => {
      const raw = l.geom.map(([x, y]) => ({ x, y }));
      return {
        id: l.id,
        fleets: l.fleets,
        pts: smoothPolyline(
          raw,
          raw.map(() => null),
        ).pts,
      };
    });
  }
}

/** Every place where two robots cannot pass each other: lanes of different flows closer than a robot pair needs (crossings, merges, forks, tight opposite lanes). Found from the lane geometry alone, so any map works. Each cluster is one intersection. */
export class Intersections {
  readonly clusters = new Map<string, number>();
  private pts: { x: number; y: number; c: string }[] = [];
  private cell = new Map<string, number[]>();
  private reach: number;
  constructor(graph: LaneGraph, gap = 0.9, reach = 2.0, join = 0) {
    this.reach = reach;
    const sm = graph.smoothLanes();
    type P = { x: number; y: number; lane: number };
    const all: P[] = [];
    sm.forEach((l, li) => {
      l.pts.forEach((q, i) => {
        all.push({ ...q, lane: li });
        if (i === 0) return;
        const a = l.pts[i - 1];
        const len = Math.hypot(q.x - a.x, q.y - a.y);
        for (let d = 0.4; d < len - 0.2; d += 0.4)
          all.push({ x: a.x + ((q.x - a.x) * d) / len, y: a.y + ((q.y - a.y) * d) / len, lane: li });
      });
    }); // a point every 0.4 m along every lane, long straight lanes included
    const lanes = graph.nav.lanes;
    const grid = new Map<string, number[]>();
    const key = (x: number, y: number) => Math.floor(x) + ',' + Math.floor(y);
    all.forEach((p, i) => {
      const k = key(p.x, p.y);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    });
    const parent = all.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const flagged = new Set<number>();
    const follows = (a: number, b: number) => lanes[a].to === lanes[b].from && lanes[b].to !== lanes[a].from; // b continues a (not a U-turn into the paired lane)
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const cx = Math.floor(p.x),
        cy = Math.floor(p.y);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const j of grid.get(cx + dx + ',' + (cy + dy)) ?? []) {
            if (j <= i) continue;
            const q = all[j];
            if (q.lane === p.lane || follows(p.lane, q.lane) || follows(q.lane, p.lane)) continue;
            if (Math.hypot(p.x - q.x, p.y - q.y) < gap) {
              flagged.add(i);
              flagged.add(j);
              parent[find(i)] = find(j);
            }
          }
    }
    const fl = [...flagged];
    if (join > 0)
      for (const i of fl) {
        const p = all[i];
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (const j of grid.get(Math.floor(p.x) + dx + ',' + (Math.floor(p.y) + dy)) ?? [])
              if (j > i && flagged.has(j) && Math.hypot(p.x - all[j].x, p.y - all[j].y) < join)
                parent[find(i)] = find(j);
      }
    const ids = new Map<number, string>();
    let n = 0;
    for (const i of fl) {
      const r = find(i);
      if (!ids.has(r)) ids.set(r, 'X' + ++n);
      const c = ids.get(r)!;
      this.pts.push({ x: all[i].x, y: all[i].y, c });
      this.clusters.set(c, (this.clusters.get(c) ?? 0) + 1);
    }
    this.pts.forEach((p, i) => {
      const k = key(p.x, p.y);
      (this.cell.get(k) ?? this.cell.set(k, []).get(k)!).push(i);
    });
  }
  /** Every intersection whose area (within `reach` of one of its points) contains the position. */
  near(x: number, y: number): string[] {
    const cx = Math.floor(x),
      cy = Math.floor(y),
      out = new Set<string>();
    const R = Math.ceil(this.reach) + 1;
    for (let dx = -R; dx <= R; dx++)
      for (let dy = -R; dy <= R; dy++)
        for (const i of this.cell.get(cx + dx + ',' + (cy + dy)) ?? []) {
          const p = this.pts[i];
          if (Math.hypot(p.x - x, p.y - y) < this.reach) out.add(p.c);
        }
    return [...out];
  }
}

export const CORNER_RADIUS = 0.75;
/** Rounds every corner of a polyline with a quadratic curve (corner radius `R`), so a robot follows a continuous tangent instead of turning on the spot at each vertex. */
export function smoothPolyline(
  src: Vec2[],
  laneSrc: (string | null)[],
  R = CORNER_RADIUS,
  step = 0.18,
): { pts: Vec2[]; laneAt: (string | null)[] } {
  const p: Vec2[] = [],
    l: (string | null)[] = [];
  src.forEach((q, i) => {
    const a = p[p.length - 1];
    if (!a || Math.hypot(q.x - a.x, q.y - a.y) > 0.05) {
      p.push(q);
      l.push(laneSrc[i]);
    }
  });
  if (p.length < 3) return { pts: p, laneAt: l };
  const pts: Vec2[] = [p[0]],
    laneAt: (string | null)[] = [l[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1],
      b = p[i],
      c = p[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y),
      l2 = Math.hypot(c.x - b.x, c.y - b.y);
    const d1 = { x: (b.x - a.x) / l1, y: (b.y - a.y) / l1 },
      d2 = { x: (c.x - b.x) / l2, y: (c.y - b.y) / l2 };
    const phi = Math.acos(Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y)));
    if (phi < 0.03) {
      pts.push(b);
      laneAt.push(l[i]);
      continue;
    }
    const t = Math.min(R * Math.tan(Math.min(phi, Math.PI - 0.05) / 2), 0.5 * l1, 0.5 * l2);
    const A = { x: b.x - d1.x * t, y: b.y - d1.y * t },
      B = { x: b.x + d2.x * t, y: b.y + d2.y * t };
    const n = Math.max(4, Math.ceil((2 * t * (0.6 + phi / Math.PI)) / step));
    for (let k = 0; k <= n; k++) {
      const u = k / n,
        w = 1 - u;
      pts.push({ x: w * w * A.x + 2 * w * u * b.x + u * u * B.x, y: w * w * A.y + 2 * w * u * b.y + u * u * B.y });
      laneAt.push(l[i]);
    }
  }
  pts.push(p[p.length - 1]);
  laneAt.push(l[p.length - 1]);
  return { pts, laneAt };
}
export function pointAt(p: PathPlan, s: number): { x: number; y: number; heading: number; lane: string | null } {
  const c = p.cum;
  let lo = 0,
    hi = c.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (c[m] <= s) lo = m;
    else hi = m;
  }
  const a = p.pts[lo],
    b = p.pts[Math.min(lo + 1, p.pts.length - 1)],
    L = c[lo + 1] - c[lo] || 1e-9,
    t = Math.max(0, Math.min(1, (s - c[lo]) / L));
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    heading: Math.atan2(b.y - a.y, b.x - a.x),
    lane: p.laneAt[Math.min(lo + 1, p.laneAt.length - 1)],
  };
}
